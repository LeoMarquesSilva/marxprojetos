export type CrmStage =
  | "lead"
  | "contato_feito"
  | "proposta_enviada"
  | "fechado"
  | "perdido";

export const STAGE_LABELS: Record<CrmStage, string> = {
  lead: "Lead",
  contato_feito: "Contato feito",
  proposta_enviada: "Proposta enviada",
  fechado: "Fechado",
  perdido: "Perdido",
};

export const STAGE_COLUMNS: CrmStage[] = [
  "lead",
  "contato_feito",
  "proposta_enviada",
  "fechado",
  "perdido",
];

export const STAGE_ACCENT: Record<
  CrmStage,
  { dot: string; pillBg: string; pillText: string }
> = {
  lead: { dot: "bg-slate-400", pillBg: "bg-slate-50", pillText: "text-slate-600" },
  contato_feito: { dot: "bg-blue-400", pillBg: "bg-blue-50", pillText: "text-blue-700" },
  proposta_enviada: { dot: "bg-amber-400", pillBg: "bg-amber-50", pillText: "text-amber-700" },
  fechado: { dot: "bg-emerald-400", pillBg: "bg-emerald-50", pillText: "text-emerald-700" },
  perdido: { dot: "bg-rose-400", pillBg: "bg-rose-50", pillText: "text-rose-700" },
};

export type CrmClient = {
  id: string;
  owner_id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  stage: CrmStage;
  value: number | null;
  project_id: string | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmTask = {
  id: string;
  client_id: string;
  title: string;
  due_date: string | null;
  done: boolean;
  done_at: string | null;
  created_at: string;
};

export type CrmNote = {
  id: string;
  client_id: string;
  body: string;
  created_at: string;
};
