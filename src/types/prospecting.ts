export type ProspectStatus = "novo" | "contatado" | "respondeu" | "descartado";

export const PROSPECT_STATUS_LABELS: Record<ProspectStatus, string> = {
  novo: "Novo",
  contatado: "Contatado",
  respondeu: "Respondeu",
  descartado: "Descartado",
};

export const PROSPECT_STATUS_ORDER: ProspectStatus[] = [
  "novo",
  "contatado",
  "respondeu",
  "descartado",
];

export const PROSPECT_STATUS_ACCENT: Record<
  ProspectStatus,
  { dot: string; pillBg: string; pillText: string }
> = {
  novo: { dot: "bg-slate-400", pillBg: "bg-slate-50", pillText: "text-slate-600" },
  contatado: { dot: "bg-blue-400", pillBg: "bg-blue-50", pillText: "text-blue-700" },
  respondeu: { dot: "bg-emerald-400", pillBg: "bg-emerald-50", pillText: "text-emerald-700" },
  descartado: { dot: "bg-rose-400", pillBg: "bg-rose-50", pillText: "text-rose-700" },
};

/** Site público do estúdio — é o que {{portfolio}} vira na mensagem. */
export const INSYT_STUDIO_URL = "https://www.insytstudio.com.br/";

// Ponto de partida para quem ainda não salvou um modelo. Vale só isso: o
// modelo salvo é usado como está, sem nada acrescentado. Para mandar o
// portfólio, escreva {{portfolio}} onde ele deve aparecer.
export const DEFAULT_PROSPECTING_TEMPLATE = `Olá! Tudo bem?

Me chamo Leonardo, da INSYT (criamos sites para negócios de {{cidade}}). {{site}} Posso te mostrar em 2 minutos como ficaria o site, sem compromisso?`;

export type Prospect = {
  id: string;
  owner_id: string;
  google_place_id: string;
  name: string;
  phone: string | null;
  phone_e164: string | null;
  is_mobile: boolean;
  /** null = ainda não verificado. Ver supabase/sql/prospects-whatsapp-check.sql */
  has_whatsapp: boolean | null;
  whatsapp_checked_at: string | null;
  website: string | null;
  address: string | null;
  rating: number | null;
  rating_count: number | null;
  google_maps_uri: string | null;
  niche: string;
  city: string;
  status: ProspectStatus;
  custom_message: string | null;
  crm_client_id: string | null;
  email: string | null;
  enrich_job_id: string | null;
  created_at: string;
  updated_at: string;
};
