import "server-only";
import {
  buildFindMessagesBody,
  latestEvolutionMessageStatus,
  normalizeEvolutionMessagePage,
  resolveEvolutionMessageJid,
} from "@/lib/evolution-payload";
import { isGroupJid, remoteJidToDigits } from "@/lib/phone";
import { extractWhatsAppText } from "@/lib/whatsapp-message";

// Delay curto só para o indicador "digitando..." — 1,2s deixava o envio
// perceptivelmente lento no CRM 1:1. Rajadas em massa é outro caso.
const SEND_DELAY_MS = 350;
const REQUEST_TIMEOUT_MS = 20_000;
const SYNC_TIMEOUT_MS = 60_000;

type EvolutionSendTextResponse = {
  key?: { id?: string };
  // Em recusa, a Evolution devolve o resultado da checagem de cada número.
  response?: { message?: { jid?: string; exists?: boolean; number?: string }[] };
};

/**
 * Erro de envio que carrega uma explicação exibível para o usuário.
 *
 * O motivo real vinha da Evolution e morria num `catch` — a tela mostrava
 * sempre "Não foi possível enviar", inclusive no caso mais comum de todos:
 * o número simplesmente não ter WhatsApp. Sem saber disso, a única leitura
 * possível era "o sistema está quebrado".
 */
export class WhatsAppSendError extends Error {
  readonly safeMessage: string;

  constructor(message: string, safeMessage: string) {
    super(message);
    this.name = "WhatsAppSendError";
    this.safeMessage = safeMessage;
  }
}

function describeSendFailure(
  status: number,
  data: EvolutionSendTextResponse | null,
): string {
  const checked = data?.response?.message;
  if (Array.isArray(checked) && checked.some((item) => item?.exists === false)) {
    return "Este número não tem WhatsApp.";
  }
  if (status === 401 || status === 403) {
    return "A conexão com o WhatsApp está sem autorização. Verifique a instância.";
  }
  return "Não foi possível enviar a mensagem pelo WhatsApp.";
}

export type EvolutionContactProfile = {
  name: string | null;
  status: string | null;
  profilePictureUrl: string | null;
  isBusiness: boolean;
  businessDescription: string | null;
  businessWebsite: string | null;
  businessEmail: string | null;
  businessAddress: string | null;
};

export type EvolutionChatSummary = {
  remoteJid: string;
  lidJid: string | null;
  pushName: string | null;
  profilePictureUrl: string | null;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageFromMe: boolean | null;
};

export type EvolutionSyncedMessage = {
  providerMessageId: string;
  remoteJid: string;
  fromMe: boolean;
  content: string | null;
  createdAt: string;
  status: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} não configurada. Defina EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE.`,
    );
  }
  return value;
}

function evolutionUrl(path: string): string {
  const base = requireEnv("EVOLUTION_API_URL").replace(/\/+$/, "");
  return `${base}${path}`;
}

async function evolutionFetch(
  path: string,
  {
    method = "POST",
    body,
    timeoutMs = REQUEST_TIMEOUT_MS,
  }: {
    method?: "GET" | "POST";
    body?: unknown;
    timeoutMs?: number;
  } = {},
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const apiKey = requireEnv("EVOLUTION_API_KEY");
  const response = await fetch(evolutionUrl(path), {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const data = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data };
}

async function evolutionPost<T>(path: string, body: unknown): Promise<T | null> {
  const result = await evolutionFetch(path, { body });
  if (!result.ok) return null;
  return result.data as T | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}


function timestampToIso(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const asNumber = Number(value);
    if (!Number.isNaN(asNumber) && asNumber > 0) {
      const ms = asNumber < 1e12 ? asNumber * 1000 : asNumber;
      return new Date(ms).toISOString();
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (typeof value === "number") {
    const ms = value < 1e12 ? value * 1000 : value;
    return new Date(ms).toISOString();
  }
  return null;
}

function normalizeChatList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const record = asRecord(data);
  if (!record) return [];
  if (Array.isArray(record.chats)) return record.chats;
  if (Array.isArray(record.data)) return record.data;
  if (Array.isArray(record.records)) return record.records;
  return [];
}

function mapEvolutionChat(raw: unknown): EvolutionChatSummary | null {
  const chat = asRecord(raw);
  if (!chat) return null;

  const rawRemoteJid =
    (typeof chat.remoteJid === "string" && chat.remoteJid) ||
    (typeof chat.id === "string" && chat.id.includes("@") ? chat.id : null) ||
    (typeof asRecord(chat.key)?.remoteJid === "string"
      ? (asRecord(chat.key)!.remoteJid as string)
      : null);

  if (!rawRemoteJid || isGroupJid(rawRemoteJid)) return null;
  const lastMessage = asRecord(chat.lastMessage);
  const lastKey = asRecord(lastMessage?.key);
  const resolved = resolveEvolutionMessageJid({
    remoteJid: rawRemoteJid,
    remoteJidAlt: lastKey?.remoteJidAlt,
    senderPn: lastKey?.senderPn,
  });
  if (!resolved) return null;
  const { remoteJid, lidJid } = resolved;

  if (remoteJid.endsWith("@broadcast") || remoteJid.includes("status@")) {
    return null;
  }

  const preview =
    extractWhatsAppText(lastMessage?.message) ??
    (typeof chat.lastMessagePreview === "string"
      ? chat.lastMessagePreview
      : null) ??
    (typeof lastMessage?.conversation === "string"
      ? lastMessage.conversation
      : null);

  const lastMessageAt =
    timestampToIso(chat.lastMsgTimestamp) ??
    timestampToIso(chat.updatedAt) ??
    timestampToIso(lastMessage?.messageTimestamp) ??
    timestampToIso(chat.conversationTimestamp);

  return {
    remoteJid,
    lidJid,
    pushName:
      (typeof chat.pushName === "string" && chat.pushName) ||
      (typeof chat.name === "string" && chat.name) ||
      null,
    profilePictureUrl:
      (typeof chat.profilePicUrl === "string" && chat.profilePicUrl) ||
      (typeof chat.profilePictureUrl === "string" && chat.profilePictureUrl) ||
      null,
    unreadCount:
      typeof chat.unreadCount === "number"
        ? chat.unreadCount
        : typeof chat.unreadCount === "string"
          ? Number(chat.unreadCount) || 0
          : 0,
    lastMessageAt,
    lastMessagePreview: preview ? preview.slice(0, 140) : null,
    lastMessageFromMe:
      typeof lastKey?.fromMe === "boolean" ? lastKey.fromMe : null,
  };
}

function mapEvolutionMessage(
  raw: unknown,
  fallbackRemoteJid?: string,
): EvolutionSyncedMessage | null {
  const item = asRecord(raw);
  if (!item) return null;

  const key = asRecord(item.key);
  const providerMessageId =
    (typeof key?.id === "string" && key.id) ||
    (typeof item.id === "string" && item.id) ||
    null;
  const resolved = resolveEvolutionMessageJid({
    remoteJid:
      (typeof key?.remoteJid === "string" && key.remoteJid) ||
      (typeof item.remoteJid === "string" && item.remoteJid) ||
      fallbackRemoteJid,
    remoteJidAlt: key?.remoteJidAlt,
    senderPn: key?.senderPn,
  });

  if (!providerMessageId || !resolved || isGroupJid(resolved.remoteJid)) {
    return null;
  }
  const { remoteJid } = resolved;

  const fromMe = Boolean(key?.fromMe ?? item.fromMe);
  const content = extractWhatsAppText(item.message) ?? "[mensagem sem texto]";
  const createdAt =
    timestampToIso(item.messageTimestamp) ??
    timestampToIso(item.createdAt) ??
    new Date().toISOString();

  const statusRaw =
    latestEvolutionMessageStatus(item) ??
    (fromMe ? "server_ack" : "delivery_ack");

  return {
    providerMessageId,
    remoteJid,
    fromMe,
    content,
    createdAt,
    status: statusRaw,
  };
}

export async function sendWhatsAppText(
  remoteJid: string,
  text: string,
): Promise<{ providerMessageId: string | null }> {
  const instance = requireEnv("EVOLUTION_INSTANCE");

  const result = await evolutionFetch(
    `/message/sendText/${encodeURIComponent(instance)}`,
    {
      body: {
        number: remoteJidToDigits(remoteJid),
        text,
        delay: SEND_DELAY_MS,
      },
    },
  );

  const data = result.data as EvolutionSendTextResponse | null;

  if (!result.ok) {
    const detail = data ? JSON.stringify(data) : `HTTP ${result.status}`;
    throw new WhatsAppSendError(
      `Evolution recusou o envio: ${detail}`,
      describeSendFailure(result.status, data),
    );
  }

  return { providerMessageId: data?.key?.id ?? null };
}

// Docs: POST /chat/fetchProfilePictureUrl/:instance
export async function fetchWhatsAppProfilePicture(
  remoteJid: string,
): Promise<string | null> {
  const instance = requireEnv("EVOLUTION_INSTANCE");
  const data = await evolutionPost<{ profilePictureUrl?: string }>(
    `/chat/fetchProfilePictureUrl/${encodeURIComponent(instance)}`,
    { number: remoteJidToDigits(remoteJid) },
  );
  return data?.profilePictureUrl ?? null;
}

// Docs: POST /chat/fetchProfile/:instance — nome, about, avatar e business.
export async function fetchWhatsAppProfile(
  remoteJid: string,
): Promise<EvolutionContactProfile | null> {
  const instance = requireEnv("EVOLUTION_INSTANCE");
  const number = remoteJidToDigits(remoteJid);

  type ProfileResponse = {
    name?: string;
    pushName?: string;
    status?: string | { status?: string };
    isBusiness?: boolean;
    profilePictureUrl?: string;
    businessProfile?: {
      email?: string;
      description?: string;
      website?: string[] | string;
      address?: string;
    };
  };

  const profile = await evolutionPost<ProfileResponse>(
    `/chat/fetchProfile/${encodeURIComponent(instance)}`,
    { number },
  );

  let picture = profile?.profilePictureUrl ?? null;
  if (!picture) {
    picture = await fetchWhatsAppProfilePicture(remoteJid);
  }

  if (!profile && !picture) return null;

  const statusValue =
    typeof profile?.status === "string"
      ? profile.status
      : profile?.status?.status ?? null;

  const websites = profile?.businessProfile?.website;
  const website = Array.isArray(websites)
    ? (websites[0] ?? null)
    : (websites ?? null);

  return {
    name: profile?.name ?? profile?.pushName ?? null,
    status: statusValue,
    profilePictureUrl: picture,
    isBusiness: Boolean(profile?.isBusiness ?? profile?.businessProfile),
    businessDescription: profile?.businessProfile?.description ?? null,
    businessWebsite: website,
    businessEmail: profile?.businessProfile?.email ?? null,
    businessAddress: profile?.businessProfile?.address ?? null,
  };
}

// Docs: POST /chat/findChats/:instance
export async function findWhatsAppChats(): Promise<EvolutionChatSummary[]> {
  const instance = requireEnv("EVOLUTION_INSTANCE");
  const result = await evolutionFetch(
    `/chat/findChats/${encodeURIComponent(instance)}`,
    { body: {}, timeoutMs: SYNC_TIMEOUT_MS },
  );

  if (!result.ok) {
    throw new Error(
      `Evolution findChats falhou (HTTP ${result.status}): ${JSON.stringify(result.data)}`,
    );
  }

  const chats = normalizeChatList(result.data)
    .map(mapEvolutionChat)
    .filter((chat): chat is EvolutionChatSummary => Boolean(chat));

  // A Evolution pode devolver a mesma conversa uma vez por telefone e outra
  // por LID. Mantemos só o registro mais recente já canonicalizado.
  const byRemoteJid = new Map<string, EvolutionChatSummary>();
  for (const chat of chats) {
    const previous = byRemoteJid.get(chat.remoteJid);
    const previousAt = previous?.lastMessageAt
      ? new Date(previous.lastMessageAt).getTime()
      : 0;
    const nextAt = chat.lastMessageAt
      ? new Date(chat.lastMessageAt).getTime()
      : 0;
    if (!previous || nextAt >= previousAt) {
      byRemoteJid.set(chat.remoteJid, {
        ...previous,
        ...chat,
        lidJid: chat.lidJid ?? previous?.lidJid ?? null,
      });
    }
  }

  return [...byRemoteJid.values()];
}

// Docs: POST /chat/findMessages/:instance
export async function findWhatsAppMessages(
  remoteJid: string,
  limit = 80,
): Promise<EvolutionSyncedMessage[]> {
  const instance = requireEnv("EVOLUTION_INSTANCE");
  const pageSize = Math.max(1, Math.min(Math.trunc(limit), 500));
  const result = await evolutionFetch(
    `/chat/findMessages/${encodeURIComponent(instance)}`,
    {
      body: buildFindMessagesBody(remoteJid, pageSize, 1),
      timeoutMs: SYNC_TIMEOUT_MS,
    },
  );

  if (!result.ok) {
    throw new Error(
      `Evolution findMessages falhou (HTTP ${result.status}): ${JSON.stringify(result.data)}`,
    );
  }

  return normalizeEvolutionMessagePage(result.data)
    .records
    .map((item) => mapEvolutionMessage(item, remoteJid))
    .filter((message): message is EvolutionSyncedMessage => Boolean(message))
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
}
