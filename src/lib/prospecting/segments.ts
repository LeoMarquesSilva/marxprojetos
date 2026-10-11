// Segmentos em que a INSYT já tem projeto entregue. É daqui que saem as
// sugestões de busca da prospecção, a pontuação de encaixe do lead e o
// projeto parecido que a mensagem cita ({{caso}} / {{caso_link}}).
//
// Para acrescentar um segmento novo, basta um item a mais: `terms` vira
// busca no Google Maps, `keywords` reconhece o lead pelo nome/categoria.

export type PortfolioCase = {
  name: string;
  /** Site publicado. Sem ele, {{caso_link}} cai no portfólio da INSYT. */
  url?: string;
};

export type ProspectSegment = {
  id: string;
  label: string;
  /** Por que esse público faz sentido — aparece na sugestão. */
  angle: string;
  /** Termos de busca no Maps. O primeiro é o principal. */
  terms: string[];
  /** Palavras (sem acento, minúsculas) que reconhecem o lead. */
  keywords: string[];
  /**
   * Contexto obrigatório além da palavra-chave. "Empresarial" sozinho
   * pega contabilidade e centro comercial; só vale junto de advocacia.
   */
  requires?: string[];
  cases: PortfolioCase[];
};

const LEGAL_CONTEXT = ["advoca", "advogad", "juridic", "direito", " law"];

// A ordem importa: o primeiro segmento que casa ganha. Os específicos vêm
// antes do genérico ("advogado criminalista" é criminal, não multi-área), e
// medicina do trabalho vem antes de clínicas.
export const PROSPECT_SEGMENTS: ProspectSegment[] = [
  {
    id: "advocacia-empresarial",
    label: "Advocacia empresarial e holdings",
    angle: "Mesmo público da Pereira Garcia: societário, tributário e sucessão.",
    terms: [
      "advogado empresarial",
      "advocacia societária",
      "advogado tributarista",
      "holding familiar advogado",
      "planejamento sucessório advogado",
    ],
    keywords: [
      "empresarial",
      "societari",
      "tributari",
      "holding",
      "sucessori",
      "contratual",
    ],
    requires: LEGAL_CONTEXT,
    cases: [
      { name: "Pereira Garcia Advocacia", url: "https://pereiragarciaadvocacia.com.br" },
      {
        name: "a landing de Holding Familiar da Pereira Garcia",
        url: "https://holding.pereiragarciaadvocacia.com.br",
      },
    ],
  },
  {
    id: "advocacia-criminal",
    label: "Advocacia criminal",
    angle: "Já fizemos Outeiral (penal) e WASA (júri e defesa de policiais).",
    terms: [
      "advogado criminalista",
      "advocacia criminal",
      "escritório de direito penal",
      "advogado tribunal do júri",
    ],
    // " juri " com espaços: "jurídico" também começa com "juri".
    keywords: ["criminal", "penal", " juri ", "tribunal do juri"],
    requires: LEGAL_CONTEXT,
    cases: [{ name: "Outeiral Advocacia", url: "https://outeiraladvocacia.com.br" }],
  },
  {
    id: "reestruturacao",
    label: "Recuperação judicial e reestruturação",
    angle: "Case Bismarchi | Pires: crise empresarial e reestruturação.",
    terms: [
      "advogado recuperação judicial",
      "reestruturação empresarial advocacia",
      "advogado falência",
    ],
    keywords: ["recuperacao judicial", "reestrutura", "falencia", "insolvencia"],
    requires: LEGAL_CONTEXT,
    cases: [{ name: "Bismarchi | Pires", url: "https://bismarchipires.com.br" }],
  },
  {
    id: "direito-medico",
    label: "Direito médico e da saúde",
    angle: "Case Beatriz Bertho: advocacia preventiva para médicos.",
    terms: [
      "advogado direito médico",
      "advocacia da saúde",
      "advogado para médicos",
      "advogado plano de saúde",
    ],
    keywords: ["medic", "saude"],
    requires: LEGAL_CONTEXT,
    cases: [
      { name: "Beatriz Bertho Advocacia", url: "https://beatrizberthoadv.com.br" },
    ],
  },
  {
    id: "marketing-juridico",
    label: "Agências de marketing jurídico",
    angle: "Case Ordem Digital — e agência vira parceira que repassa sites.",
    terms: [
      "agência de marketing jurídico",
      "marketing para advogados",
      "social media para advogados",
    ],
    keywords: ["marketing juridico", "marketing para advogados", "social media"],
    cases: [{ name: "Ordem Digital" }],
  },
  {
    id: "advocacia-geral",
    label: "Escritórios de advocacia (multi-área)",
    angle: "Nosso público principal — trabalhista, família, previdenciário.",
    terms: [
      "escritório de advocacia",
      "advogado trabalhista",
      "advogado de família",
      "advogado previdenciário",
      "advogado imobiliário",
    ],
    keywords: [
      "advoca",
      "advogad",
      "juridic",
      "direito",
      "trabalhista",
      "previdenci",
      "lawyer",
      "law firm",
    ],
    cases: [
      { name: "Pereira Garcia Advocacia", url: "https://pereiragarciaadvocacia.com.br" },
      { name: "Outeiral Advocacia", url: "https://outeiraladvocacia.com.br" },
    ],
  },
  {
    id: "rh-nr1",
    label: "RH, saúde ocupacional e NR-1",
    angle: "Confiara (NR-1) e Camila Gracioli (liderança e saúde mental).",
    terms: [
      "consultoria de RH",
      "medicina do trabalho",
      "segurança do trabalho",
      "psicologia organizacional",
      "consultoria organizacional",
    ],
    keywords: [
      "recursos humanos",
      " rh ",
      "ocupacional",
      "seguranca do trabalho",
      "medicina do trabalho",
      "organizacional",
      "nr-1",
      "nr1",
      "sesmt",
    ],
    cases: [{ name: "Confiara", url: "https://www.confiara.com.br" }],
  },
  {
    id: "clinicas",
    label: "Clínicas e saúde",
    angle: "Casa Ampla (geriatria) e o sistema Clinke para clínicas.",
    terms: [
      "clínica geriátrica",
      "casa de repouso",
      "clínica médica",
      "clínica de fisioterapia",
      "clínica de psicologia",
    ],
    keywords: [
      "clinica",
      "geriatri",
      "repouso",
      "consultorio",
      "fisioterap",
      "psicolog",
      "medicina",
      "odonto",
    ],
    cases: [{ name: "Casa Ampla" }],
  },
];

export function normalizeForMatch(text: string): string {
  return ` ${text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

/**
 * Segmento do portfólio que mais combina com o lead, pelo nicho buscado,
 * nome e categoria do Maps. O primeiro da lista que casa ganha.
 */
export function matchSegment(lead: {
  niche?: string | null;
  name?: string | null;
  category?: string | null;
}): ProspectSegment | null {
  const haystack = normalizeForMatch(
    [lead.niche, lead.category, lead.name].filter(Boolean).join(" "),
  );
  if (!haystack.trim()) return null;

  for (const segment of PROSPECT_SEGMENTS) {
    if (!segment.keywords.some((keyword) => haystack.includes(keyword))) continue;
    if (
      segment.requires &&
      !segment.requires.some((word) => haystack.includes(word))
    ) {
      continue;
    }
    return segment;
  }
  return null;
}

export function findSegment(id: string | null | undefined) {
  return PROSPECT_SEGMENTS.find((segment) => segment.id === id) ?? null;
}

/**
 * Termos de uma busca: o digitado e, na busca ampla, os sinônimos do
 * segmento ("advogado criminalista" + "advocacia criminal" + ...), até 4.
 */
export function searchTermsFor(
  niche: string,
  mode: "padrao" | "ampla" | "varredura",
  segmentId?: string | null,
): string[] {
  const base = niche.trim();
  if (mode !== "ampla") return [base];

  const segment = findSegment(segmentId) ?? matchSegment({ niche: base });
  const seen = new Set([normalizeForMatch(base)]);
  const terms = [base];
  for (const term of segment?.terms ?? []) {
    const key = normalizeForMatch(term);
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
    if (terms.length >= 4) break;
  }
  return terms;
}
