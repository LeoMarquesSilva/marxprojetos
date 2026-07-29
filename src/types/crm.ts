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

// Identidade visual por estágio — tons sóbrios que convivem com a paleta
// warm da INSYT (evita azul/âmbar genéricos de template de kanban).
export const STAGE_ACCENT: Record<
  CrmStage,
  { dot: string; pillBg: string; pillText: string; bar: string }
> = {
  lead: {
    dot: "bg-[var(--insyt-muted)]",
    pillBg: "bg-[var(--insyt-canvas-alt)]",
    pillText: "text-[var(--insyt-slate)]",
    bar: "bg-[var(--insyt-muted)]",
  },
  contato_feito: {
    dot: "bg-[var(--insyt-slate)]",
    pillBg: "bg-[var(--insyt-canvas)]",
    pillText: "text-[var(--insyt-black)]",
    bar: "bg-[var(--insyt-slate)]",
  },
  proposta_enviada: {
    dot: "bg-[var(--insyt-primary)]",
    pillBg: "bg-[var(--accent)]",
    pillText: "text-[var(--insyt-primary-dark)]",
    bar: "bg-[var(--insyt-primary)]",
  },
  fechado: {
    dot: "bg-emerald-600",
    pillBg: "bg-emerald-50",
    pillText: "text-emerald-800",
    bar: "bg-emerald-600",
  },
  perdido: {
    dot: "bg-stone-400",
    pillBg: "bg-stone-100",
    pillText: "text-stone-600",
    bar: "bg-stone-300",
  },
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

export type CrmWhatsappMessageStatus =
  | "pending"
  | "server_ack"
  | "delivery_ack"
  | "read"
  | "played"
  | "error";

// Sinal de conversa que o card do kanban precisa mostrar sem carregar a
// thread inteira: quem respondeu, quando, e se está esperando resposta.
export type CrmClientChatSignal = {
  remoteJid: string;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
};

export type CrmBoardClient = CrmClient & {
  chat: CrmClientChatSignal | null;
};

export type CrmWhatsappReaction = {
  emoji: string;
  fromMe: boolean;
};

export type CrmWhatsappMessage = {
  id: string;
  remote_jid: string;
  client_id: string | null;
  from_me: boolean;
  conteudo: string | null;
  status: CrmWhatsappMessageStatus;
  erro: string | null;
  created_at: string;
  provider_message_id?: string | null;
  reactions?: CrmWhatsappReaction[];
};

// Item da inbox estilo WhatsApp: conversa + cliente vinculado (se houver).
// A "etiqueta" da conversa é o stage do cliente no funil.
export type CrmInboxChat = {
  remoteJid: string;
  pushName: string | null;
  profileName: string | null;
  profilePictureUrl: string | null;
  profileStatus: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  inboxNote: string | null;
  client: {
    id: string;
    name: string;
    company: string | null;
    phone: string | null;
    email: string | null;
    source: string | null;
    stage: CrmStage;
    value: number | null;
  } | null;
};

export type CrmInboxProspect = {
  id: string;
  name: string;
  website: string | null;
  address: string | null;
  niche: string;
  city: string;
  status: string;
  rating: number | null;
};
