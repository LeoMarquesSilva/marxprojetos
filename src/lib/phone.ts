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

// Chave de comparação que ignora o nono dígito. O WhatsApp ainda registra
// muitos celulares brasileiros sem o 9 (o JID chega como 551981984137 para
// um lead cadastrado como (19) 98198-4137) — comparando e164 puro, a
// resposta do lead não casava com o lead e o funil nunca andava.
// Celular de 8 dígitos começa com 6–9 e fixo com 2–5, então tirar o 9 não
// faz um celular colidir com um fixo.
export function brPhoneMatchKey(raw: string): string | null {
  const { e164 } = normalizeBrPhone(raw.split("@")[0]);
  if (!e164) return null;
  const local = e164.slice(2);
  if (local.length === 11 && local[2] === "9") {
    return `55${local.slice(0, 2)}${local.slice(3)}`;
  }
  return e164;
}

// As duas grafias possíveis de um celular (com e sem o nono dígito), para
// consultas `in (...)` no banco. Fixo tem uma grafia só.
export function brPhoneVariants(raw: string): string[] {
  const { e164 } = normalizeBrPhone(raw.split("@")[0]);
  if (!e164) return [];
  const local = e164.slice(2);
  if (local.length === 11 && local[2] === "9") {
    return [e164, `55${local.slice(0, 2)}${local.slice(3)}`];
  }
  if (local.length === 10 && /[6-9]/.test(local[2])) {
    return [e164, `55${local.slice(0, 2)}9${local.slice(2)}`];
  }
  return [e164];
}

// "5519981984137" → "(19) 98198-4137". É o formato que o CRM mostra e que
// volta a normalizar para o mesmo e164.
export function formatBrPhone(e164: string): string {
  const local = e164.startsWith("55") ? e164.slice(2) : e164;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return e164;
}

export function buildWaMeUrl(e164: string, message?: string): string {
  const base = `https://wa.me/${e164}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

// JID = identificador de conversa do WhatsApp (Baileys/Evolution). Contatos
// individuais usam o sufixo @s.whatsapp.net; grupos usam @g.us — nunca
// tratamos JID de grupo como número de telefone.
export function phoneToRemoteJid(e164: string): string {
  return `${e164}@s.whatsapp.net`;
}

export function remoteJidToDigits(remoteJid: string): string {
  return remoteJid.split("@")[0];
}

export function isGroupJid(remoteJid: string): boolean {
  return remoteJid.endsWith("@g.us");
}

export function fillTemplate(
  template: string,
  vars: {
    nome: string;
    cidade: string;
    hasSite: boolean;
    portfolioUrl?: string;
    /** Frase própria para {{site}} (ex: site fora do ar); senão, a padrão. */
    sitePhrase?: string;
    nicho?: string;
    /** Projeto do portfólio mais parecido com o lead, já com o link. */
    caso?: string;
    casoLink?: string;
    saudacao?: string;
    /** Lista dos problemas do site encontrados na auditoria. */
    diagnostico?: string;
  },
): string {
  const sitePhrase =
    vars.sitePhrase ??
    (vars.hasSite
      ? `Vi que ${vars.nome} já tem site — talvez seja hora de dar uma modernizada nele.`
      : `Vi que ${vars.nome} ainda não tem site, e hoje é por aí que a maioria dos clientes pesquisa e decide em quem confiar antes de ligar.`);

  const portfolio =
    vars.portfolioUrl?.trim() || "https://www.insytstudio.com.br/";

  // {{site}} primeiro: a frase pode citar o nome, e {{nome}} ainda precisa
  // ser expandido no restante do template.
  //
  // O que o modelo diz é o que sai. O link do portfólio entra só se o texto
  // pedir, escrito à mão ou por {{portfolio}} — nada é acrescentado por
  // conta própria.
  return template
    .replaceAll("{{site}}", sitePhrase)
    .replaceAll("{{diagnostico}}", vars.diagnostico ?? "")
    .replaceAll("{{saudacao}}", vars.saudacao ?? "Olá")
    .replaceAll("{{nome}}", vars.nome)
    .replaceAll("{{cidade}}", vars.cidade)
    .replaceAll("{{nicho}}", vars.nicho ?? "")
    .replaceAll("{{caso_link}}", vars.casoLink ?? portfolio)
    .replaceAll("{{caso}}", vars.caso ?? portfolio)
    .replaceAll("{{portfolio}}", portfolio);
}
