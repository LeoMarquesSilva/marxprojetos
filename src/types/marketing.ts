export type MarketingPostKind = "imagem" | "carrossel" | "reels";

export type MarketingPostStatus =
  | "rascunho"
  | "agendado"
  | "publicando"
  | "publicado"
  | "erro";

export const POST_KIND_LABELS: Record<MarketingPostKind, string> = {
  imagem: "Foto",
  carrossel: "Carrossel",
  reels: "Reels",
};

export const POST_STATUS_LABELS: Record<MarketingPostStatus, string> = {
  rascunho: "Rascunho",
  agendado: "Agendado",
  publicando: "Publicando",
  publicado: "Publicado",
  erro: "Erro",
};

export type MarketingMedia = {
  /** Caminho no bucket marketing-media (para apagar junto com o post). */
  path: string;
  /** URL pública que a Meta baixa ao criar o container. */
  url: string;
  type: "image" | "video";
};

export type MarketingPost = {
  id: string;
  owner_id: string | null;
  kind: MarketingPostKind;
  caption: string;
  media: MarketingMedia[];
  status: MarketingPostStatus;
  scheduled_at: string | null;
  container_id: string | null;
  ig_media_id: string | null;
  permalink: string | null;
  published_at: string | null;
  error: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
};

export type MetaPageOption = {
  id: string;
  name: string;
  igUserId: string | null;
  igUsername: string | null;
  igPictureUrl: string | null;
};

export type MetaAdAccountOption = {
  id: string;
  name: string;
  currency: string | null;
  /** 1 = ativa; outros valores são contas desativadas/pendentes na Meta. */
  status: number | null;
};

/** O que a tela pode saber da conexão — sem nenhum token. */
export type MarketingConnectionSummary = {
  configured: boolean;
  connected: boolean;
  metaUserName: string | null;
  tokenExpiresAt: string | null;
  connectedAt: string | null;
  page: { id: string; name: string | null } | null;
  instagram: { id: string; username: string | null; pictureUrl: string | null } | null;
  adAccount: { id: string; name: string | null; currency: string | null } | null;
  availablePages: MetaPageOption[];
  availableAdAccounts: MetaAdAccountOption[];
};

export type InstagramProfile = {
  id: string;
  username: string;
  name: string | null;
  biography: string | null;
  pictureUrl: string | null;
  followers: number;
  follows: number;
  mediaCount: number;
};

export type InstagramTotals = {
  reach: number | null;
  views: number | null;
  accountsEngaged: number | null;
  interactions: number | null;
  profileLinkTaps: number | null;
  follows: number | null;
  unfollows: number | null;
};

export type DailyPoint = { date: string; value: number };

export type InstagramMediaItem = {
  id: string;
  caption: string | null;
  mediaType: string;
  productType: string | null;
  thumbnailUrl: string | null;
  permalink: string;
  timestamp: string;
  likes: number;
  comments: number;
  reach: number | null;
  views: number | null;
  saved: number | null;
  shares: number | null;
};

export type AdCampaignRow = {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  objective: string | null;
  dailyBudget: number | null;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number | null;
  cpm: number | null;
  /** Conversas iniciadas no WhatsApp/Direct segundo a Meta. */
  conversations: number;
  /** Leads de formulário (Lead Ads) segundo a Meta. */
  formLeads: number;
  /** Leads que chegaram ao CRM com o anúncio desta campanha. */
  crmLeads: number;
  crmClosed: number;
  crmRevenue: number;
};
