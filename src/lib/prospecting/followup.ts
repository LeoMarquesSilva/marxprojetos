import { FOLLOWUP_AFTER_DAYS, type Prospect } from "@/types/prospecting";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Quantos follow-ups no máximo antes de o lead sair da fila. */
export const MAX_FOLLOWUPS = 2;

/**
 * Lead abordado que não respondeu há FOLLOWUP_AFTER_DAYS dias (contando do
 * último toque, primeira mensagem ou follow-up anterior).
 */
export function isFollowupDue(
  lead: Pick<Prospect, "status" | "contacted_at" | "replied_at"> &
    Partial<Pick<Prospect, "last_followup_at" | "followup_count">>,
  now = new Date(),
): boolean {
  if (lead.status !== "contatado" || lead.replied_at) return false;
  if ((lead.followup_count ?? 0) >= MAX_FOLLOWUPS) return false;
  const lastTouch = lead.last_followup_at ?? lead.contacted_at;
  if (!lastTouch) return false;
  return now.getTime() - new Date(lastTouch).getTime() >= FOLLOWUP_AFTER_DAYS * DAY_MS;
}
