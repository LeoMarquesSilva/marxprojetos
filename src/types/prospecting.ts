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
  /** null = ainda não verificado pela Evolution. */
  has_whatsapp: boolean | null;
  whatsapp_checked_at: string | null;
  /** JID real da conta no WhatsApp (pode não ter o nono dígito). */
  whatsapp_jid: string | null;
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
  /** google | apify | localprospects | csv */
  source: string | null;
  /** Categoria do Google Maps ("Advogado criminalista"). */
  category: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  /** Celular publicado como WhatsApp no site do lead. */
  site_whatsapp: string | null;
  /** ok | offline | social (rede social no lugar do site); null = não analisado. */
  site_status: "ok" | "offline" | "social" | null;
  site_issues: string[] | null;
  site_checked_at: string | null;
  contacted_at: string | null;
  replied_at: string | null;
  followup_count: number | null;
  last_followup_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProspectingSettings = {
  template: string;
  followupTemplate: string;
  dailyLimit: number;
};

export const DEFAULT_FOLLOWUP_TEMPLATE = `{Oi|Olá}, tudo bem? Passando só para saber se você chegou a ver minha mensagem sobre o site de {{nome}}. Se fizer sentido, te mostro rapidinho um exemplo do que fizemos para {{caso}}.`;

/** Dias sem resposta para o lead aparecer em "Follow-up". */
export const FOLLOWUP_AFTER_DAYS = 3;

export const DEFAULT_DAILY_LIMIT = 40;
