import "server-only";
import { remoteJidToDigits } from "@/lib/phone";

// Delay curto só para o indicador "digitando..." — 1,2s deixava o envio
// perceptivelmente lento no CRM 1:1. Rajadas em massa é outro caso.
const SEND_DELAY_MS = 350;
const REQUEST_TIMEOUT_MS = 20_000;

type EvolutionSendTextResponse = {
  key?: { id?: string };
};

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

async function evolutionPost<T>(path: string, body: unknown): Promise<T | null> {
  const apiKey = requireEnv("EVOLUTION_API_KEY");
  const response = await fetch(evolutionUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) return null;
  return (await response.json().catch(() => null)) as T | null;
}

export async function sendWhatsAppText(
  remoteJid: string,
  text: string,
): Promise<{ providerMessageId: string | null }> {
  const instance = requireEnv("EVOLUTION_INSTANCE");

  const response = await fetch(
    evolutionUrl(`/message/sendText/${encodeURIComponent(instance)}`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: requireEnv("EVOLUTION_API_KEY"),
      },
      body: JSON.stringify({
        number: remoteJidToDigits(remoteJid),
        text,
        delay: SEND_DELAY_MS,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );

  const data = (await response.json().catch(() => null)) as
    | EvolutionSendTextResponse
    | null;

  if (!response.ok) {
    const detail = data ? JSON.stringify(data) : `HTTP ${response.status}`;
    throw new Error(`Evolution recusou o envio: ${detail}`);
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
