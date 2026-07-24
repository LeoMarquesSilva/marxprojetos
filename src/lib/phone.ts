// Normalização de telefones brasileiros para links wa.me e detecção de
// celular (provável WhatsApp). A Places API devolve o número formatado
// (ex: "(19) 98198-4137"); aqui reduzimos a dígitos com DDI 55.

export function normalizeBrPhone(raw: string): {
  e164: string | null;
  isMobile: boolean;
} {
  let digits = raw.replace(/\D/g, "");

  // Remove DDI 55 se já veio no número (e sobra um número BR válido).
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }

  // Remove 0 de operadora/prefixo à esquerda (ex: 019...).
  if (digits.startsWith("0")) {
    digits = digits.replace(/^0+/, "");
  }

  // Válido: DDD (2) + 8 dígitos (fixo) ou DDD (2) + 9 dígitos (celular).
  if (digits.length !== 10 && digits.length !== 11) {
    return { e164: null, isMobile: false };
  }

  const isMobile = digits.length === 11 && digits[2] === "9";
  return { e164: `55${digits}`, isMobile };
}

export function buildWaMeUrl(e164: string, message?: string): string {
  const base = `https://wa.me/${e164}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function fillTemplate(
  template: string,
  vars: { nome: string; cidade: string; hasSite: boolean },
): string {
  const sitePhrase = vars.hasSite
    ? "Vi que vocês já têm um site — talvez seja hora de dar uma modernizada nele."
    : "Pesquisando negócios da região, percebi que vocês ainda não têm um site próprio.";

  return template
    .replaceAll("{{nome}}", vars.nome)
    .replaceAll("{{cidade}}", vars.cidade)
    .replaceAll("{{site}}", sitePhrase);
}
