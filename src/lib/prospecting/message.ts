// Monta a mensagem de prospecção de um lead a partir do modelo.
//
// É a mesma função na prévia, no envio individual e no disparo em lote — o
// texto que aparece na tela é exatamente o que sai.

import { fillTemplate } from "@/lib/phone";
import { matchSegment, PROSPECT_SEGMENTS } from "@/lib/prospecting/segments";
import { auditPitches } from "@/lib/prospecting/site-audit";
import {
  INSYT_STUDIO_URL,
  type Prospect,
  type ProspectingSettings,
} from "@/types/prospecting";

export type MessageLead = Pick<Prospect, "id" | "name" | "city" | "niche" | "website"> &
  Partial<
    Pick<
      Prospect,
      "category" | "site_status" | "site_issues" | "site_audit" | "rating" | "rating_count"
    >
  >;

// Sem segmento reconhecido, o case citado é o do público principal.
const FALLBACK_CASE = PROSPECT_SEGMENTS.find((segment) => segment.id === "advocacia-geral")
  ?.cases[0] ?? { name: "INSYT" };

// Muitos nomes no Google Maps vêm recheados de palavra-chave ("Dra. Ana
// Lima - Advogada Trabalhista em Campinas"). Na mensagem, isso denuncia o
// disparo automático; fica só o nome de verdade.
const NAME_SEPARATOR = /\s+[-–—|:•]\s*|\s*\|\s*|,\s+/;
const GENERIC_PREFIX = /^escrit[óo]rio de advocacia(?: e consultoria)?\s+(?=\S)/i;

export function shortBusinessName(name: string): string {
  const [first] = name.trim().split(NAME_SEPARATOR);
  const head = first && first.length >= 3 ? first.trim() : name.trim();
  const withoutPrefix = head.replace(GENERIC_PREFIX, "");
  return withoutPrefix.length >= 4 ? withoutPrefix : head;
}

/** Os problemas do site que valem citar, já em frase (até 3). */
export function siteDiagnosis(lead: MessageLead): string[] {
  if (!lead.website || lead.site_status !== "ok") return [];
  return auditPitches(lead.site_audit);
}

/**
 * Qual modelo usar. Quem tem site e a auditoria achou o que citar recebe o
 * modelo com diagnóstico; o resto (sem site, fora do ar, rede social) fica
 * com o modelo de primeiro contato, em que {{site}} explica a situação.
 */
export function templateFor(
  settings: Pick<ProspectingSettings, "template" | "siteTemplate" | "followupTemplate">,
  lead: MessageLead,
  kind: "primeira" | "followup",
): string {
  if (kind === "followup") return settings.followupTemplate;
  return siteDiagnosis(lead).length > 0 ? settings.siteTemplate : settings.template;
}

function lowerFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

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

/* ------------------------------------------------------------------ */
/* Peças da mensagem                                                   */
/* ------------------------------------------------------------------ */
//
// Como a mensagem é pensada (prospecção fria por WhatsApp):
//
// - A primeira linha é sobre o lead, nunca sobre a INSYT.
// - Um problema concreto e verificável do site dele (ou a falta do site),
//   não uma lista: lista soa como crítica; os outros pontos viram o motivo
//   para ele responder.
// - O problema traduzido no que ele perde, no contexto da área dele.
// - Quem somos em uma linha, com um case parecido (prova social), sem link:
//   link na primeira mensagem derruba resposta e aumenta risco de spam.
// - Uma pergunta só, fácil de responder, oferecendo algo antes de pedir
//   (a lista completa, uma prévia) em vez de pedir reunião.
// - Follow-up traz algo novo; o último dá permissão para dizer "não".

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const NAME_WORD = "[A-ZÀ-Ý][a-zà-ÿ]+";
const TITLED_NAME = new RegExp(`^(Dra|DRA|Dr|DR)\\.?\\s*(${NAME_WORD})`);
const LAWYER_FIRST = new RegExp(`^Advogad([oa])\\s+(${NAME_WORD})`);
// "Advogado"/"Advogada" no singular diz que é uma pessoa e o gênero;
// "Advogados" é sociedade.
const LAWYER_SINGULAR = /\bAdvogad([oa])\b/;
const FIRM_WORDS = /advocacia|advogados|associados|sociedade|escrit[oó]rio|jur[ií]dic|consultoria|&|\bltda\b/i;
const NAME_CONNECTOR = /^(d[aeo]s?|e)$/;

function personFirstName(text: string): string | null {
  const words = text.trim().split(/\s+/);
  if (words.length < 2 || words.length > 5) return null;
  const isName = words.every(
    (word) => new RegExp(`^${NAME_WORD}$`).test(word) || NAME_CONNECTOR.test(word),
  );
  return isName ? words[0] : null;
}

/**
 * ", Dra. Janaina" quando o nome do negócio é de uma pessoa ("Dra. Janaina
 * Giacometti", "Giovanni Costa Silva - Advogado Criminal"); vazio quando é
 * uma sociedade ou não dá para saber — aí a saudação fica só "Bom dia!".
 */
export function vocativeFor(name: string): string {
  const short = shortBusinessName(name);
  const titled = short.match(TITLED_NAME);
  if (titled) return `, ${/a$/i.test(titled[1]) ? "Dra." : "Dr."} ${titled[2]}`;
  const first = short.match(LAWYER_FIRST);
  if (first) return `, ${first[1] === "a" ? "Dra." : "Dr."} ${first[2]}`;

  const gender = name.match(LAWYER_SINGULAR);
  if (gender) {
    const person = short.replace(/\s+Advogad[oa]\b.*$/, "");
    const firstName = FIRM_WORDS.test(person) ? null : personFirstName(person);
    if (firstName) return `, ${gender[1] === "a" ? "Dra." : "Dr."} ${firstName}`;
  }
  return "";
}

// O momento de compra do cliente final, por área. É o que liga o problema
// do site a dinheiro perdido — dito no idioma do advogado, não de TI.
const BUYER_MOMENTS: { match: RegExp; text: string }[] = [
  {
    match: /criminal|penal|juri|flagrante/,
    text: "Na área criminal, quem procura advogado geralmente está com pressa, pesquisa pelo celular e chama o primeiro que passa confiança.",
  },
  {
    match: /famil|divorc|pensao|inventario|sucess/,
    text: "Em direito de família, a pessoa costuma comparar dois ou três escritórios pelo celular antes de chamar, e fica com o que passa mais confiança.",
  },
  {
    match: /previd|aposent|inss/,
    text: "Na área previdenciária, muita gente pesquisa pelo celular, às vezes com a ajuda dos filhos, e fica com quem passa mais segurança.",
  },
  {
    match: /trabalh/,
    text: "Na área trabalhista, quem procura advogado pesquisa pelo celular, compara poucos escritórios e chama quem parece mais preparado.",
  },
  {
    match: /saude|medic|plano/,
    text: "Quem precisa brigar com plano de saúde está com pressa, pesquisa pelo celular e fica com o primeiro escritório que passa confiança.",
  },
  {
    match: /tribut|empresar|societ|holding|recupera|falenc|reestrutura/,
    text: "Empresário costuma abrir o site do escritório antes da primeira reunião, e é ali que decide se ele está à altura da empresa.",
  },
  {
    match: /advoca|advogad|juridic/,
    text: "Hoje quase todo cliente novo pesquisa o escritório no Google, pelo celular, antes de entrar em contato.",
  },
  {
    match: /clinica|repouso|geriatr|idoso/,
    text: "Quem procura uma clínica ou casa de repouso para um familiar pesquisa com calma, pelo celular, e escolhe a que transmite mais cuidado.",
  },
  {
    match: /recursos humanos|\brh\b|medicina do trabalho|ocupacional/,
    text: "Empresa que contrata RH ou medicina do trabalho costuma pesquisar o fornecedor no Google antes de pedir orçamento.",
  },
];

export function buyerMoment(lead: Pick<MessageLead, "niche" | "name" | "category">): string {
  const text = normalize(`${lead.niche} ${lead.category ?? ""} ${lead.name}`);
  return (
    BUYER_MOMENTS.find((moment) => moment.match.test(text))?.text ??
    "Hoje quase todo cliente novo pesquisa no Google, pelo celular, antes de entrar em contato."
  );
}

function audienceFor(segmentId: string | undefined, city: string): string {
  if (!segmentId) return `negócios de ${city}`;
  if (segmentId === "clinicas") return "clínicas e casas de repouso";
  if (segmentId === "rh-nr1") return "empresas de RH e saúde ocupacional";
  return "escritórios de advocacia";
}

const COUNT_WORDS = ["zero", "um", "dois", "três", "quatro", "cinco"];

/** Mensagem para uma pessoa ("Dr. Giovanni"): "o seu site", não "o de vocês". */
function isPersonal(lead: Pick<MessageLead, "name">) {
  return Boolean(vocativeFor(lead.name));
}

/** Todos os problemas que valem citar (sem limite), na ordem da mensagem. */
function allPitches(lead: MessageLead): string[] {
  if (!lead.website || lead.site_status !== "ok") return [];
  return auditPitches(lead.site_audit, 10);
}

/** A pergunta final: oferece algo (a lista, a prévia) em vez de pedir reunião. */
export function offerPhrase(lead: MessageLead): string {
  const pitches = allPitches(lead);
  const extra = pitches.length - 1;
  if (extra >= 1) {
    const more = extra === 1 ? "mais um ponto" : `mais ${COUNT_WORDS[extra] ?? extra} pontos`;
    return `{Achei|Encontrei} ${more} desse tipo no site. {Quer que eu te mande a lista?|Faz sentido eu te mandar a lista?|Posso te mandar a lista?}`;
  }
  if (pitches.length === 1) {
    return "{Faz sentido eu te mostrar como ficaria resolvido?|Quer que eu te mostre como ficaria?}";
  }
  const yours = isPersonal(lead) ? "o seu" : "o de vocês";
  return `{Faz sentido eu te mostrar como ficaria ${yours}?|Quer que eu te mostre como ficaria ${yours}?}`;
}

/**
 * Corpo do follow-up. O primeiro traz um ponto novo (o segundo problema do
 * site, ou o case); o último se despede e deixa a porta aberta — dar
 * permissão para dizer "não" é o que mais destrava resposta.
 */
export function followupHook(
  lead: MessageLead & Partial<Pick<Prospect, "followup_count">>,
  caseName: string,
): string {
  const pitches = allPitches(lead);
  if ((lead.followup_count ?? 0) >= 1) {
    return `Imagino que a rotina esteja corrida, então não vou insistir. Se o site virar prioridade em algum momento, é só me chamar por aqui${pitches.length ? " que eu te mando a lista completa do que encontrei" : ""}. {Um abraço!|Sucesso!}`;
  }
  const relief = "{Se não for prioridade agora, sem problema.|Se não for o momento, tudo bem também.}";
  if (pitches[1]) {
    return `Voltando ao ${isPersonal(lead) ? "seu site" : "site de vocês"}: outra coisa que reparei é que ${lowerFirst(pitches[1])}. {Quer que eu te mande o que dá para melhorar?|Faz sentido eu te mandar o que dá para fazer?} ${relief}`;
  }
  return `Voltando ao assunto do site: posso te mandar o que fizemos para ${caseName}, para você ter uma ideia de como ficaria ${isPersonal(lead) ? "o seu" : "o de vocês"}. {Quer ver?|Pode ser?} ${relief}`;
}

function ratingText(lead: MessageLead): string {
  const count = lead.rating_count ?? 0;
  if (!lead.rating || count < 5) return "";
  return `, com nota ${lead.rating.toFixed(1).replace(".", ",")} em ${count} avaliações`;
}

// {{site}}: a observação concreta que abre a mensagem — a falta do site, o
// site fora do ar, a rede social no lugar dele, ou o problema mais forte
// que a auditoria mediu.
export function sitePhraseFor(lead: MessageLead): string {
  const name = shortBusinessName(lead.name);
  const personal = isPersonal(lead);
  const subject = personal ? "o seu site" : `o site de ${name}`;
  const issues = lead.site_issues ?? [];

  if (!lead.website) {
    return `Vi ${personal ? "o seu perfil" : `o perfil de ${name}`} no Google${ratingText(lead)}, mas sem link para um site.`;
  }
  if (lead.site_status === "offline") {
    return `Tentei abrir ${subject} e ele está fora do ar: quem ${personal ? "te procura" : "procura vocês"} no Google cai numa página de erro.`;
  }
  if (lead.site_status === "social") {
    const label = issues[0]?.match(/^Usa (.+) no lugar de site/)?.[1];
    const what = label ? `o ${label}` : "a rede social";
    return `Vi que ${personal ? "você usa" : `${name} usa`} ${what} no lugar de um site próprio.`;
  }
  const [mainPitch] = siteDiagnosis(lead);
  if (mainPitch) return `Abri ${subject} e reparei que ${lowerFirst(mainPitch)}.`;

  // Só a análise simples (sem auditoria no navegador).
  if (issues.some((issue) => issue.startsWith("Não é adaptado ao celular"))) {
    return `Abri ${subject} pelo celular e ele não está adaptado: aparece como no computador, com letra miúda.`;
  }
  if (issues.some((issue) => issue.startsWith("Sem HTTPS"))) {
    return `Reparei que ${subject} aparece como "não seguro" no navegador.`;
  }
  if (issues.some((issue) => issue.startsWith("Site muito lento"))) {
    return `Tentei abrir ${subject} e ele demorou bastante para carregar.`;
  }
  return `Dei uma olhada n${subject.slice(1)} e dá para deixá-lo bem mais moderno e rápido.`;
}

export function renderProspectMessage(
  template: string,
  lead: MessageLead & Partial<Pick<Prospect, "followup_count">>,
  { now = new Date() }: { now?: Date } = {},
): string {
  const segment = matchSegment(lead);
  const featured = segment?.cases[0] ?? FALLBACK_CASE;
  const casoLink = featured.url ?? INSYT_STUDIO_URL;
  const caso = featured.url
    ? `${featured.name} (${featured.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")})`
    : featured.name;
  const [mainPitch] = siteDiagnosis(lead);

  // Peças novas primeiro; o que sobra ({{nome}}, {{site}}...) é do
  // fillTemplate. Nenhuma frase daqui contém {{...}}.
  const prepared = template
    .replaceAll("{{vocativo}}", vocativeFor(lead.name))
    .replaceAll("{{momento}}", buyerMoment(lead))
    .replaceAll("{{publico}}", audienceFor(segment?.id, lead.city))
    .replaceAll("{{caso_nome}}", featured.name)
    .replaceAll("{{oferta}}", offerPhrase(lead))
    .replaceAll("{{gancho}}", followupHook(lead, featured.name))
    .replaceAll("{{problema}}", mainPitch ? lowerFirst(mainPitch) : "");

  const filled = fillTemplate(prepared, {
    nome: shortBusinessName(lead.name),
    cidade: lead.city,
    hasSite: Boolean(lead.website),
    portfolioUrl: INSYT_STUDIO_URL,
    sitePhrase: sitePhraseFor(lead),
    nicho: lead.niche,
    caso,
    casoLink,
    saudacao: greetingAt(now),
    diagnostico: siteDiagnosis(lead)
      .map((pitch) => `• ${pitch}`)
      .join("\n"),
  });

  // Placeholder vazio pode deixar espaço sobrando ("Bom dia !").
  return applySpintax(filled, lead.id)
    .replace(/[ \t]+([!?.,])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
