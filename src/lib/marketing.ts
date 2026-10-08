// Regras da área de marketing sem banco, rede nem React — testáveis direto
// no node:test. Datas trafegam como "YYYY-MM-DD" (data civil de Brasília).

import type {
  AdCampaignRow,
  MarketingMedia,
  MarketingPostKind,
  MarketingPostStatus,
} from "@/types/marketing";

/** Instagram: insights do perfil aceitam no máximo 30 dias por consulta. */
export const PROFILE_RANGES = [7, 28] as const;
export const ADS_RANGES = [7, 30, 90] as const;

export const CAPTION_LIMIT = 2200;
export const HASHTAG_LIMIT = 30;
export const CAROUSEL_MIN = 2;
export const CAROUSEL_MAX = 10;

/** Conversa iniciada pelo botão do anúncio (WhatsApp, Messenger, Direct). */
export const MESSAGING_ACTION = "onsite_conversion.messaging_conversation_started_7d";
export const FORM_LEAD_ACTIONS = ["lead", "onsite_conversion.lead_grouped"];

export function resolveRange<T extends readonly number[]>(
  value: string | undefined,
  allowed: T,
  fallback: T[number],
): T[number] {
  const parsed = Number(value);
  return (allowed as readonly number[]).includes(parsed) ? (parsed as T[number]) : fallback;
}

export function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

/** Janela que termina hoje e tem `days` dias contando hoje. */
export function rangeDates(days: number, today: string) {
  return { since: shiftDate(today, -(days - 1)), until: today };
}

/** Instagram pede since/until em segundos Unix; `until` é exclusivo. */
export function rangeToUnix(range: { since: string; until: string }) {
  const start = Date.parse(`${range.since}T00:00:00-03:00`) / 1000;
  const end = Date.parse(`${shiftDate(range.until, 1)}T00:00:00-03:00`) / 1000;
  return { since: start, until: end };
}

type MetaAction = { action_type?: string; value?: string | number };

export function actionValue(actions: MetaAction[] | null | undefined, types: string[]) {
  if (!actions) return 0;
  let total = 0;
  for (const action of actions) {
    if (action.action_type && types.includes(action.action_type)) {
      total += toNumber(action.value);
    }
  }
  return total;
}

export function toNumber(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : typeof value === "number" ? value : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function divide(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export function countHashtags(caption: string): number {
  return caption.match(/(^|\s)#[\p{L}\p{N}_]+/gu)?.length ?? 0;
}

export type PostDraftInput = {
  kind: MarketingPostKind;
  caption: string;
  media: MarketingMedia[];
  /** ISO; null = rascunho ou publicar agora. */
  scheduledAt: string | null;
};

/** Mesmas regras que a Meta aplica — melhor falhar aqui do que no agendamento. */
export function validatePostDraft(input: PostDraftInput, now = new Date()): string | null {
  if (input.caption.length > CAPTION_LIMIT) {
    return `A legenda passa de ${CAPTION_LIMIT} caracteres.`;
  }
  if (countHashtags(input.caption) > HASHTAG_LIMIT) {
    return `O Instagram aceita no máximo ${HASHTAG_LIMIT} hashtags.`;
  }

  const images = input.media.filter((item) => item.type === "image").length;
  const videos = input.media.filter((item) => item.type === "video").length;

  if (input.kind === "imagem" && (images !== 1 || videos !== 0)) {
    return "Post de foto leva exatamente uma imagem.";
  }
  if (input.kind === "reels" && (videos !== 1 || images !== 0)) {
    return "Reels leva exatamente um vídeo.";
  }
  if (input.kind === "carrossel") {
    if (videos > 0) return "Por enquanto o carrossel aceita só fotos.";
    if (images < CAROUSEL_MIN || images > CAROUSEL_MAX) {
      return `Carrossel leva de ${CAROUSEL_MIN} a ${CAROUSEL_MAX} fotos.`;
    }
  }

  if (input.scheduledAt) {
    const at = Date.parse(input.scheduledAt);
    if (!Number.isFinite(at)) return "Data de agendamento inválida.";
    if (at < now.getTime() + 60_000) return "Agende para pelo menos um minuto à frente.";
  }
  return null;
}

export function isPostDue(
  post: { status: MarketingPostStatus; scheduled_at: string | null },
  now = new Date(),
): boolean {
  if (post.status === "publicando") return true;
  if (post.status !== "agendado" || !post.scheduled_at) return false;
  return Date.parse(post.scheduled_at) <= now.getTime();
}

type CampaignInput = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective?: string | null;
  daily_budget?: string | number | null;
};

type CampaignInsightInput = {
  campaign_id?: string;
  spend?: string | number;
  impressions?: string | number;
  reach?: string | number;
  clicks?: string | number;
  ctr?: string | number;
  cpm?: string | number;
  actions?: MetaAction[];
};

export type CrmAdLead = {
  ad_id: string | null;
  stage: string;
  value: number | string | null;
};

/**
 * Junta campanhas, métricas da Meta e leads do CRM (via ad → campanha).
 * Campanha sem gasto no período e sem lead some — não é o que interessa.
 */
export function buildCampaignRows(
  campaigns: CampaignInput[],
  insights: CampaignInsightInput[],
  campaignByAd: Map<string, string>,
  crmLeads: CrmAdLead[],
): AdCampaignRow[] {
  const insightByCampaign = new Map(
    insights.filter((row) => row.campaign_id).map((row) => [row.campaign_id as string, row]),
  );

  const crmByCampaign = new Map<string, { leads: number; closed: number; revenue: number }>();
  for (const lead of crmLeads) {
    const campaignId = lead.ad_id ? campaignByAd.get(lead.ad_id) : undefined;
    if (!campaignId) continue;
    const current = crmByCampaign.get(campaignId) ?? { leads: 0, closed: 0, revenue: 0 };
    current.leads += 1;
    if (lead.stage === "fechado") {
      current.closed += 1;
      current.revenue += toNumber(lead.value);
    }
    crmByCampaign.set(campaignId, current);
  }

  return campaigns
    .map((campaign) => {
      const insight = insightByCampaign.get(campaign.id);
      const crm = crmByCampaign.get(campaign.id);
      // Orçamento vem em centavos da moeda da conta.
      const budget = campaign.daily_budget == null ? null : toNumber(campaign.daily_budget) / 100;
      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        effectiveStatus: campaign.effective_status,
        objective: campaign.objective ?? null,
        dailyBudget: budget,
        spend: toNumber(insight?.spend),
        impressions: toNumber(insight?.impressions),
        reach: toNumber(insight?.reach),
        clicks: toNumber(insight?.clicks),
        ctr: insight?.ctr == null ? null : toNumber(insight.ctr),
        cpm: insight?.cpm == null ? null : toNumber(insight.cpm),
        conversations: actionValue(insight?.actions, [MESSAGING_ACTION]),
        formLeads: actionValue(insight?.actions, FORM_LEAD_ACTIONS),
        crmLeads: crm?.leads ?? 0,
        crmClosed: crm?.closed ?? 0,
        crmRevenue: crm?.revenue ?? 0,
      } satisfies AdCampaignRow;
    })
    .filter(
      (row) => row.spend > 0 || row.crmLeads > 0 || row.effectiveStatus === "ACTIVE",
    )
    .sort((a, b) => b.spend - a.spend);
}

export function summarizeCampaigns(rows: AdCampaignRow[]) {
  const totals = rows.reduce(
    (sum, row) => ({
      spend: sum.spend + row.spend,
      impressions: sum.impressions + row.impressions,
      clicks: sum.clicks + row.clicks,
      conversations: sum.conversations + row.conversations,
      formLeads: sum.formLeads + row.formLeads,
      crmLeads: sum.crmLeads + row.crmLeads,
      crmClosed: sum.crmClosed + row.crmClosed,
      crmRevenue: sum.crmRevenue + row.crmRevenue,
    }),
    {
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversations: 0,
      formLeads: 0,
      crmLeads: 0,
      crmClosed: 0,
      crmRevenue: 0,
    },
  );
  return {
    ...totals,
    ctr: divide(totals.clicks * 100, totals.impressions),
    costPerConversation: divide(totals.spend, totals.conversations),
    costPerCrmLead: divide(totals.spend, totals.crmLeads),
    costPerClose: divide(totals.spend, totals.crmClosed),
    roas: divide(totals.crmRevenue, totals.spend),
  };
}

export function formatCompact(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 10_000 ? 1 : 0,
  }).format(value);
}

// O servidor roda em UTC: sem fixar o fuso, um post agendado para 18h
// apareceria como 21h na tela.
const BR_DATE_TIME = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const BR_DATE = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** "08/10 às 18:30", no horário de Brasília. */
export function formatBrDateTime(iso: string): string {
  const parts = Object.fromEntries(
    BR_DATE_TIME.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  );
  return `${parts.day}/${parts.month} às ${parts.hour}:${parts.minute}`;
}

/** "08/10/2026", no horário de Brasília. */
export function formatBrDate(iso: string): string {
  return BR_DATE.format(new Date(iso));
}

export function formatMoney(value: number | null | undefined, currency = "BRL"): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value == null) return "—";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: digits })}%`;
}

/** Nome de arquivo seguro para o bucket (sem acento nem espaço). */
export function storageSafeName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .toLowerCase();
  const extension = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  return `${base || "arquivo"}${extension ? `.${extension}` : ""}`;
}
