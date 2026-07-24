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

export const DEFAULT_PROSPECTING_TEMPLATE = `Olá, {{nome}}! Tudo bem?

Me chamo Leonardo, sou da INSYT — criamos sites e sistemas para negócios aqui de {{cidade}}. {{site}}

Um site profissional passa credibilidade e ajuda clientes a encontrarem vocês no Google. Posso te mostrar rapidinho, sem compromisso, como ficaria um para o seu negócio?`;

export type Prospect = {
  id: string;
  owner_id: string;
  google_place_id: string;
  name: string;
  phone: string | null;
  phone_e164: string | null;
  is_mobile: boolean;
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
