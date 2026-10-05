import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// parseISO lê "YYYY-MM-DD" como meia-noite local; new Date() leria como UTC
// e, no fuso de Brasília, "2026-09-01" viraria 31 de agosto.
export function formatMonthLabel(month: string) {
  return format(parseISO(month), "MMMM 'de' yyyy", { locale: ptBR });
}

export function formatShortDate(date: string) {
  return format(parseISO(date), "dd/MM/yyyy");
}
