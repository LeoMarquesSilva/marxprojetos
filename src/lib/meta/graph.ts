import "server-only";

import { createHmac } from "node:crypto";

// Cliente mínimo da Graph API da Meta (Instagram, Páginas e Marketing API).
// Toda chamada leva appsecret_proof: mesmo que um token vaze, ele não serve
// fora deste servidor (o app exige a prova quando "Require App Secret" está
// ligado no painel da Meta).

const DEFAULT_GRAPH_VERSION = "v23.0";

export function metaConfig() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  return {
    appId: appId ?? null,
    appSecret: appSecret ?? null,
    version: process.env.META_GRAPH_VERSION || DEFAULT_GRAPH_VERSION,
    /** Facebook Login for Business usa uma configuração em vez de `scope`. */
    loginConfigId: process.env.META_LOGIN_CONFIG_ID || null,
    configured: Boolean(appId && appSecret),
  };
}

export class MetaGraphError extends Error {
  readonly code: number | null;
  readonly subcode: number | null;
  readonly status: number;

  constructor(message: string, status: number, code: number | null, subcode: number | null) {
    super(message);
    this.name = "MetaGraphError";
    this.status = status;
    this.code = code;
    this.subcode = subcode;
  }

  /** Token expirado, revogado ou senha trocada: precisa reconectar. */
  get needsReconnect() {
    return this.code === 190 || this.code === 102 || this.code === 463 || this.code === 467;
  }
}

type GraphParams = Record<string, string | number | boolean | null | undefined>;

function appSecretProof(token: string) {
  const { appSecret } = metaConfig();
  if (!appSecret) throw new MetaGraphError("META_APP_SECRET não configurado.", 500, null, null);
  return createHmac("sha256", appSecret).update(token).digest("hex");
}

function graphUrl(path: string) {
  const { version } = metaConfig();
  const clean = path.replace(/^\/+/, "");
  return `https://graph.facebook.com/${version}/${clean}`;
}

function toSearchParams(params: GraphParams, token: string | null) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    search.set(key, String(value));
  }
  if (token) {
    search.set("access_token", token);
    search.set("appsecret_proof", appSecretProof(token));
  }
  return search;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: string; error_user_msg?: string; code?: number; error_subcode?: number } })
    | null;
  if (!response.ok || body?.error) {
    const error = body?.error;
    throw new MetaGraphError(
      error?.error_user_msg || error?.message || `Erro ${response.status} na API da Meta.`,
      response.status,
      error?.code ?? null,
      error?.error_subcode ?? null,
    );
  }
  return body as T;
}

export async function graphGet<T>(path: string, token: string | null, params: GraphParams = {}) {
  const url = `${graphUrl(path)}?${toSearchParams(params, token)}`;
  const response = await fetch(url, { cache: "no-store" });
  return parseResponse<T>(response);
}

export async function graphPost<T>(path: string, token: string, params: GraphParams = {}) {
  const response = await fetch(graphUrl(path), {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: toSearchParams(params, token),
  });
  return parseResponse<T>(response);
}

type GraphPage<T> = {
  data?: T[];
  paging?: { next?: string; cursors?: { after?: string } };
};

/**
 * Percorre as páginas até `max` itens. Usa o cursor `after` em vez da URL
 * `paging.next`, que não traz o appsecret_proof.
 */
export async function graphGetAll<T>(
  path: string,
  token: string,
  params: GraphParams = {},
  max = 500,
): Promise<T[]> {
  const items: T[] = [];
  let page = await graphGet<GraphPage<T>>(path, token, params);
  items.push(...(page.data ?? []));
  while (page.paging?.next && page.paging.cursors?.after && items.length < max) {
    page = await graphGet<GraphPage<T>>(path, token, {
      ...params,
      after: page.paging.cursors.after,
    });
    items.push(...(page.data ?? []));
  }
  return items.slice(0, max);
}

/** Mensagem curta para a tela, sem detalhes internos. */
export function describeMetaError(error: unknown): string {
  if (error instanceof MetaGraphError) {
    if (error.needsReconnect) {
      return "A conexão com a Meta expirou ou foi revogada. Conecte de novo em Marketing → Conexão.";
    }
    if (error.code === 10 || error.code === 200 || error.code === 294) {
      return `A Meta negou a permissão: ${error.message}`;
    }
    if (error.code === 4 || error.code === 17 || error.code === 32 || error.code === 613) {
      return "Limite de chamadas da Meta atingido. Tente de novo em alguns minutos.";
    }
    return error.message;
  }
  return error instanceof Error ? error.message : "Erro inesperado ao falar com a Meta.";
}
