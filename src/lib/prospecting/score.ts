// Prioridade do lead (0–100): quem tem mais chance de virar cliente da
// INSYT e é mais fácil de alcançar vem primeiro. A nota é a soma de quatro
// partes, e cada ponto vem com o motivo, para a tela explicar a nota em vez
// de pedir confiança num número:
//
//   precisa de site  até 40 — sem site, fora do ar ou site ruim
//   porte            até 25 — avaliações no Google: escritório ativo, com
//                              clientes e verba para investir
//   encaixe          até 15 — nicho em que a INSYT já tem case
//   contato        −20 a 20 — WhatsApp confirmado, celular, e-mail

import type { Prospect } from "@/types/prospecting";
import { matchSegment, type ProspectSegment } from "@/lib/prospecting/segments";

export type ProspectTier = "quente" | "morno" | "frio";

export type ScorePart = {
  key: "precisa" | "porte" | "encaixe" | "contato";
  label: string;
  points: number;
  max: number;
};

export type ProspectScore = {
  score: number;
  tier: ProspectTier;
  reasons: string[];
  parts: ScorePart[];
  segment: ProspectSegment | null;
};

export type ScoreInput = Pick<
  Prospect,
  | "name"
  | "niche"
  | "website"
  | "phone_e164"
  | "is_mobile"
  | "has_whatsapp"
  | "rating"
  | "rating_count"
  | "email"
> &
  Partial<Pick<Prospect, "category" | "site_status" | "site_issues" | "instagram" | "site_score">>;

export const TIER_LABELS: Record<ProspectTier, string> = {
  quente: "Quente",
  morno: "Morno",
  frio: "Frio",
};

export const TIER_MIN = { quente: 65, morno: 45 } as const;

function needPoints(lead: ScoreInput, reasons: string[]): number {
  if (!lead.website) {
    reasons.push("Sem site");
    return 40;
  }
  if (lead.site_status === "offline") {
    reasons.push(lead.site_issues?.[0] ?? "Site fora do ar");
    return 40;
  }
  if (lead.site_status === "social") {
    reasons.push(lead.site_issues?.[0] ?? "Usa rede social no lugar de site");
    return 36;
  }
  const issues = lead.site_issues ?? [];
  // Auditado no navegador: a nota do site diz o quanto ele precisa de um novo.
  if (typeof lead.site_score === "number") {
    reasons.push(`Nota do site: ${lead.site_score}/100`, ...issues.slice(0, 2));
    return Math.round((100 - lead.site_score) * 0.4);
  }
  // Só a análise simples (HTML): cada problema vale um pouco.
  if (issues.length > 0) {
    reasons.push(...issues.slice(0, 2));
    return Math.min(24, issues.length * 8);
  }
  return 0;
}

function sizePoints(lead: ScoreInput, reasons: string[]): number {
  // O Google esconde a contagem de muitos perfis (até na ficha, para quem
  // não está logado): nota sem contagem conta como "algumas avaliações".
  if (lead.rating && !lead.rating_count) {
    reasons.push(`Nota ${lead.rating.toFixed(1).replace(".", ",")} no Google`);
    return 7 + (lead.rating >= 4.5 ? 5 : 0);
  }
  const reviews = lead.rating_count ?? 0;
  let points =
    reviews >= 100 ? 20 : reviews >= 50 ? 16 : reviews >= 20 ? 12 : reviews >= 8 ? 7 : reviews >= 3 ? 3 : 0;
  if ((lead.rating ?? 0) >= 4.5 && reviews >= 5) points += 5;
  if (reviews >= 8) {
    reasons.push(
      `${reviews} avaliações no Google${lead.rating ? ` (nota ${String(lead.rating).replace(".", ",")})` : ""}`,
    );
  }
  return Math.min(25, points);
}

function contactPoints(lead: ScoreInput, reasons: string[]): number {
  let points = 0;
  if (!lead.phone_e164) {
    reasons.push("Sem telefone válido");
    points = -20;
  } else if (lead.has_whatsapp === true) {
    reasons.push("WhatsApp confirmado");
    points = 15;
  } else if (lead.has_whatsapp === false) {
    reasons.push("Número sem WhatsApp");
    points = -10;
  } else if (lead.is_mobile) {
    reasons.push("Celular (provável WhatsApp)");
    points = 10;
  } else {
    points = 3;
  }
  if (lead.email) {
    reasons.push("Tem e-mail");
    points += 5;
  }
  return Math.min(20, points);
}

export function scoreProspect(lead: ScoreInput): ProspectScore {
  const reasons: string[] = [];

  const need = needPoints(lead, reasons);
  const segment = matchSegment(lead);
  const fit = segment ? 15 : 0;
  if (segment) reasons.push(`Nicho do portfólio: ${segment.label}`);
  const size = sizePoints(lead, reasons);
  const contact = contactPoints(lead, reasons);

  const parts: ScorePart[] = [
    { key: "precisa", label: "Precisa de site", points: need, max: 40 },
    { key: "porte", label: "Porte", points: size, max: 25 },
    { key: "encaixe", label: "Encaixe", points: fit, max: 15 },
    { key: "contato", label: "Contato", points: contact, max: 20 },
  ];

  const score = Math.max(0, Math.min(100, need + size + fit + contact));
  return {
    score,
    tier: score >= TIER_MIN.quente ? "quente" : score >= TIER_MIN.morno ? "morno" : "frio",
    reasons,
    parts,
    segment,
  };
}

/** "Precisa de site 32/40 · Porte 21/25 · …" — para o tooltip da nota. */
export function scoreBreakdown(score: ProspectScore): string {
  return score.parts.map((part) => `${part.label} ${part.points}/${part.max}`).join(" · ");
}
