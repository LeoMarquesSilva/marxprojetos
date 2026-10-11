// Prioridade do lead (0–100): quem tem mais chance de virar cliente da
// INSYT e é mais fácil de alcançar vem primeiro. Cada ponto vem com o motivo,
// para a tela explicar a nota em vez de pedir confiança num número.

import type { Prospect } from "@/types/prospecting";
import { matchSegment, type ProspectSegment } from "@/lib/prospecting/segments";

export type ProspectTier = "quente" | "morno" | "frio";

export type ProspectScore = {
  score: number;
  tier: ProspectTier;
  reasons: string[];
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
  Partial<
    Pick<Prospect, "category" | "site_status" | "site_issues" | "instagram">
  >;

export const TIER_LABELS: Record<ProspectTier, string> = {
  quente: "Quente",
  morno: "Morno",
  frio: "Frio",
};

export function scoreProspect(lead: ScoreInput): ProspectScore {
  let score = 0;
  const reasons: string[] = [];

  const segment = matchSegment(lead);
  if (segment) {
    score += 25;
    reasons.push(`Nicho do portfólio: ${segment.label}`);
  }

  // Sem site é o argumento mais forte; site quebrado vale o mesmo.
  if (!lead.website) {
    score += 30;
    reasons.push("Sem site");
  } else if (lead.site_status === "offline") {
    score += 30;
    reasons.push(lead.site_issues?.[0] ?? "Site fora do ar");
  } else if (lead.site_status === "social") {
    score += 28;
    reasons.push(lead.site_issues?.[0] ?? "Usa rede social no lugar de site");
  } else if (lead.site_issues && lead.site_issues.length > 0) {
    score += Math.min(20, lead.site_issues.length * 8);
    reasons.push(...lead.site_issues.slice(0, 2));
  }

  if (!lead.phone_e164) {
    score -= 20;
    reasons.push("Sem telefone válido");
  } else if (lead.has_whatsapp === true) {
    score += 20;
    reasons.push("WhatsApp confirmado");
  } else if (lead.has_whatsapp === false) {
    score -= 15;
    reasons.push("Número sem WhatsApp");
  } else if (lead.is_mobile) {
    score += 12;
    reasons.push("Celular (provável WhatsApp)");
  }

  // Negócio com muitas avaliações está ativo e tem reputação a proteger.
  const reviews = lead.rating_count ?? 0;
  if (reviews >= 50) {
    score += 12;
    reasons.push(`${reviews} avaliações no Google`);
  } else if (reviews >= 15) {
    score += 8;
    reasons.push(`${reviews} avaliações no Google`);
  } else if (reviews >= 5) {
    score += 4;
  }
  if ((lead.rating ?? 0) >= 4.5 && reviews >= 5) score += 3;

  if (lead.email) {
    score += 5;
    reasons.push("Tem e-mail");
  }
  if (lead.instagram) score += 3;

  const clamped = Math.max(0, Math.min(100, score));
  return {
    score: clamped,
    tier: clamped >= 65 ? "quente" : clamped >= 40 ? "morno" : "frio",
    reasons,
    segment,
  };
}
