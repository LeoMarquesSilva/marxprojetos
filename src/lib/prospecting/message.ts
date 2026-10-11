// Monta a mensagem de prospecção de um lead a partir do modelo.
//
// É a mesma função na prévia, no envio individual e no disparo em lote — o
// texto que aparece na tela é exatamente o que sai.

import { fillTemplate } from "@/lib/phone";
import { matchSegment } from "@/lib/prospecting/segments";
import { INSYT_STUDIO_URL, type Prospect } from "@/types/prospecting";

export type MessageLead = Pick<Prospect, "id" | "name" | "city" | "niche" | "website"> &
  Partial<Pick<Prospect, "category" | "site_status" | "site_issues">>;

// Gerador determinístico (mulberry32) semeado pelo id do lead: cada lead
// recebe uma variação diferente, mas sempre a mesma — a prévia não muda a
// cada render e o que foi mostrado é o que vai.
function seededRandom(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Spintax: `{Oi|Olá|Bom dia}` vira uma das opções. Mandar o mesmo texto
 * idêntico para dezenas de números é o que mais faz o WhatsApp marcar a
 * conta como spam; variar a saudação e as frases quebra esse padrão.
 * `{{nome}}` (chaves duplas, sem barra) não é tocado.
 */
export function applySpintax(text: string, seed: string): string {
  const random = seededRandom(seed);
  let result = text;
  // Resolve de dentro para fora, para aceitar {a|{b|c}}.
  for (let guard = 0; guard < 20; guard += 1) {
    const next = result.replace(/\{([^{}]*\|[^{}]*)\}/g, (_, body: string) => {
      const options = body.split("|");
      return options[Math.floor(random() * options.length)] ?? "";
    });
    if (next === result) break;
    result = next;
  }
  return result;
}

export function greetingAt(date: Date, timeZone = "America/Sao_Paulo"): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(
      date,
    ),
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

// Frase de {{site}} quando a análise do site achou algo concreto. É o que
// diferencia a mensagem de um disparo genérico.
export function sitePhraseFor(lead: MessageLead): string | undefined {
  if (!lead.website) return undefined;
  const issues = lead.site_issues ?? [];

  if (lead.site_status === "offline") {
    return `Tentei abrir o site de ${lead.name} e ele está fora do ar — quem pesquisa no Google acaba indo para o concorrente.`;
  }
  if (lead.site_status === "social") {
    return `Vi que ${lead.name} usa a rede social no lugar de um site próprio — um site aparece no Google e passa muito mais confiança para quem ainda não conhece vocês.`;
  }
  if (issues.some((issue) => issue.startsWith("Não é adaptado ao celular"))) {
    return `Abri o site de ${lead.name} pelo celular e ele não está adaptado — hoje é de lá que vem a maior parte das visitas.`;
  }
  if (issues.some((issue) => issue.startsWith("Sem HTTPS"))) {
    return `Vi que o site de ${lead.name} aparece como "não seguro" no navegador, e isso afasta quem ainda está decidindo em quem confiar.`;
  }
  if (issues.some((issue) => issue.startsWith("Site muito lento"))) {
    return `Tentei abrir o site de ${lead.name} e ele demorou bastante para carregar — muita gente desiste antes de ver a página.`;
  }
  if (issues.length > 0) {
    return `Vi o site de ${lead.name} — dá para deixá-lo bem mais moderno e rápido, e isso pesa na hora do cliente decidir.`;
  }
  return undefined;
}

export function renderProspectMessage(
  template: string,
  lead: MessageLead,
  { now = new Date() }: { now?: Date } = {},
): string {
  const segment = matchSegment(lead);
  const featured = segment?.cases[0] ?? null;
  const casoLink = featured?.url ?? INSYT_STUDIO_URL;
  const caso = !featured
    ? INSYT_STUDIO_URL
    : featured.url
      ? `${featured.name} (${featured.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")})`
      : featured.name;

  const filled = fillTemplate(template, {
    nome: lead.name,
    cidade: lead.city,
    hasSite: Boolean(lead.website),
    portfolioUrl: INSYT_STUDIO_URL,
    sitePhrase: sitePhraseFor(lead),
    nicho: lead.niche,
    caso,
    casoLink,
    saudacao: greetingAt(now),
  });

  return applySpintax(filled, lead.id).trim();
}
