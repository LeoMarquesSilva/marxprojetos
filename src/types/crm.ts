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
