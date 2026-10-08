// Origem de anúncio numa mensagem do WhatsApp (formato Baileys/Evolution).
//
// Quando alguém toca no botão "Enviar mensagem" de um anúncio da Meta
// (Click-to-WhatsApp), a primeira mensagem chega com um `contextInfo`
// carregando o anúncio: `externalAdReply.sourceId` é o id do anúncio no
// Gerenciador, `ctwaClid` identifica o clique. A Evolution às vezes sobe esse
// contextInfo para a raiz do evento, às vezes deixa dentro da mensagem
// (extendedTextMessage, imageMessage...) — por isso a busca nos dois lugares.

export type AdReferral = {
  /** Id do anúncio na Meta (o mesmo do Gerenciador de Anúncios). */
  adId: string | null;
  title: string | null;
  body: string | null;
  sourceUrl: string | null;
  ctwaClid: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const WRAPPERS = [
  "ephemeralMessage",
  "viewOnceMessage",
  "viewOnceMessageV2",
  "viewOnceMessageV2Extension",
  "documentWithCaptionMessage",
];

function contextInfosOf(item: Record<string, unknown>): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const root = asRecord(item.contextInfo);
  if (root) found.push(root);

  let message = asRecord(item.message);
  for (let depth = 0; message && depth < 4; depth++) {
    for (const value of Object.values(message)) {
      const context = asRecord(asRecord(value)?.contextInfo);
      if (context) found.push(context);
    }
    const wrapped = WRAPPERS.map((key) => asRecord(asRecord(message?.[key])?.message)).find(
      Boolean,
    );
    message = wrapped ?? null;
  }
  return found;
}

function isAdContext(context: Record<string, unknown>, reply: Record<string, unknown> | null) {
  const sourceType = text(reply?.sourceType)?.toLowerCase();
  if (sourceType === "ad") return true;
  const conversion = [
    text(context.conversionSource),
    text(context.entryPointConversionSource),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/(fb_ads|ctwa_ad|\bads?\b)/.test(conversion)) return true;
  // Anúncio sem sourceType explícito ainda traz o clique de CTWA.
  return Boolean(text(reply?.ctwaClid) && text(reply?.sourceId));
}

/** Devolve o anúncio de origem, ou null se a mensagem não veio de anúncio. */
export function extractAdReferral(item: unknown): AdReferral | null {
  const record = asRecord(item);
  if (!record) return null;

  for (const context of contextInfosOf(record)) {
    const reply = asRecord(context.externalAdReply);
    if (!isAdContext(context, reply)) continue;
    return {
      adId: text(reply?.sourceId),
      title: text(reply?.title),
      body: text(reply?.body),
      sourceUrl: text(reply?.sourceUrl),
      ctwaClid: text(reply?.ctwaClid),
    };
  }
  return null;
}

/** Rótulo curto para a coluna `source` do CRM. */
export function adSourceLabel(referral: AdReferral): string {
  return referral.title ? `Anúncio · ${referral.title}`.slice(0, 120) : "Anúncio";
}
