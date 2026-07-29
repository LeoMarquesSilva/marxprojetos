import "server-only";
import { remoteJidToDigits } from "@/lib/phone";

// Rajada de envios sem espaçamento é o padrão mais reportado de banimento em
// APIs não oficiais do WhatsApp. O "delay" abaixo é o parâmetro nativo do
// Evolution para simular o indicador de "digitando..." antes de enviar —
// reduz esse risco sem exigir fila/scheduler à parte.
const SEND_DELAY_MS = 1200;
const REQUEST_TIMEOUT_MS = 20_000;

type EvolutionSendTextResponse = {
  key?: { id?: string };
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

export async function sendWhatsAppText(
  remoteJid: string,
  text: string,
): Promise<{ providerMessageId: string | null }> {
  const instance = requireEnv("EVOLUTION_INSTANCE");
  const apiKey = requireEnv("EVOLUTION_API_KEY");

  const response = await fetch(
    evolutionUrl(`/message/sendText/${encodeURIComponent(instance)}`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
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
