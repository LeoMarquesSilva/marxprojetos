// Conteúdo da proposta em blocos tipados. Cada proposta tem seções
// diferentes, então criar coluna por seção não escala — mas texto livre puro
// também não serve, porque a página pública precisa saber o que é preço, o
// que é etapa e o que é lista para renderizar cada coisa do seu jeito.

export type ProposalBlock =
  /** Parágrafos corridos. Uma string por parágrafo. */
  | { type: "texto"; id: string; title?: string; paragraphs: string[] }
  /** Lista simples de itens (ex: o que o desenvolvimento contempla). */
  | {
      type: "lista";
      id: string;
      title?: string;
      intro?: string;
      items: string[];
    }
  /** Itens com nome + explicação (ex: as páginas do site). */
  | {
      type: "definicoes";
      id: string;
      title?: string;
      intro?: string;
      items: { term: string; description: string }[];
    }
  /** Etapas numeradas do projeto. */
  | {
      type: "etapas";
      id: string;
      title?: string;
      steps: { title: string; description: string }[];
    }
  /** Valor principal e como ele se divide. */
  | {
      type: "investimento";
      id: string;
      title?: string;
      label: string;
      amount: string;
      paymentTitle?: string;
      installments: { label: string; amount: string }[];
    }
  /** Plano recorrente com o que está incluído. */
  | {
      type: "plano";
      id: string;
      title?: string;
      intro?: string;
      price: string;
      period: string;
      items: string[];
      note?: string;
    }
  /** Palavras-chave em destaque (ex: sobriedade, autoridade). */
  | {
      type: "pilares";
      id: string;
      title?: string;
      intro?: string;
      pillars: string[];
      closing?: string;
    };

export type ProposalStatus = "rascunho" | "enviada" | "aceita" | "recusada";

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  aceita: "Aceita",
  recusada: "Recusada",
};

export type Proposal = {
  id: string;
  owner_id: string;
  crm_client_id: string | null;
  token: string;
  title: string;
  subtitle: string | null;
  client_name: string;
  status: ProposalStatus;
  published: boolean;
  content: ProposalBlock[];
  valid_until: string | null;
  accepted_at: string | null;
  accepted_by_name: string | null;
  sent_at: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

/** O que a página pública recebe — sem owner, sem token, sem vínculo de CRM. */
export type PublicProposal = {
  id: string;
  title: string;
  subtitle: string | null;
  client_name: string;
  status: ProposalStatus;
  content: ProposalBlock[];
  valid_until: string | null;
  accepted_at: string | null;
  accepted_by_name: string | null;
  created_at: string;
};

export type ProposalSession = {
  id: string;
  proposal_id: string;
  started_at: string;
  last_seen_at: string;
  seconds_reading: number;
  max_scroll_percent: number;
  sections_seen: string[];
  reached_end: boolean;
  user_agent: string | null;
};

/** Resumo de leitura mostrado na tela interna. */
export type ProposalReadStats = {
  sessions: number;
  totalSeconds: number;
  bestScrollPercent: number;
  reachedEnd: boolean;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
};

export function summarizeProposalSessions(
  sessions: ProposalSession[],
): ProposalReadStats {
  if (sessions.length === 0) {
    return {
      sessions: 0,
      totalSeconds: 0,
      bestScrollPercent: 0,
      reachedEnd: false,
      firstOpenedAt: null,
      lastOpenedAt: null,
    };
  }

  const ordered = [...sessions].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
  );

  return {
    sessions: sessions.length,
    // Soma das sessões: duas leituras de 2 minutos são 4 minutos de atenção,
    // não 2.
    totalSeconds: sessions.reduce((total, s) => total + s.seconds_reading, 0),
    bestScrollPercent: Math.max(...sessions.map((s) => s.max_scroll_percent)),
    reachedEnd: sessions.some((s) => s.reached_end),
    firstOpenedAt: ordered[0].started_at,
    lastOpenedAt: ordered[ordered.length - 1].started_at,
  };
}

/** "2 min 30s" — mais legível que segundos crus na tela. */
export function formatReadingTime(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds ? `${minutes} min ${seconds}s` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}min`;
}
