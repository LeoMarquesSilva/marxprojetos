"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/supabase/require-authenticated-user";
import {
  adsAccess,
  clearConnection,
  instagramAccess,
  loadConnection,
  MarketingNotReadyError,
  summarizeConnection,
} from "@/lib/meta/connection";
import { describeMetaError } from "@/lib/meta/graph";
import {
  fetchDailyReach,
  fetchProfile,
  fetchRecentMedia,
  fetchTotals,
} from "@/lib/meta/instagram";
import {
  fetchCampaignByAd,
  fetchCampaignInsights,
  fetchCampaigns,
  fetchDailySpend,
  setCampaignStatus,
} from "@/lib/meta/ads";
import { selectAdAccount, selectPage } from "@/lib/meta/oauth";
import { processPost } from "@/lib/meta/publisher";
import {
  buildCampaignRows,
  rangeDates,
  summarizeCampaigns,
  validatePostDraft,
  type CrmAdLead,
} from "@/lib/marketing";
import { todayInBrasilia } from "@/lib/subscription-billing";
import type {
  AdCampaignRow,
  DailyPoint,
  InstagramMediaItem,
  InstagramProfile,
  InstagramTotals,
  MarketingConnectionSummary,
  MarketingMedia,
  MarketingPost,
  MarketingPostKind,
} from "@/types/marketing";

const MEDIA_BUCKET = "marketing-media";

function friendlyError(error: unknown) {
  if (error instanceof MarketingNotReadyError) return error.message;
  return describeMetaError(error);
}

function revalidateMarketing() {
  revalidatePath("/marketing", "layout");
}

// ---------------------------------------------------------------------------
// Conexão

export async function getMarketingConnection(): Promise<MarketingConnectionSummary> {
  await requireAuthenticatedUser();
  return summarizeConnection(await loadConnection());
}

export async function chooseMarketingPage(pageId: string) {
  await requireAuthenticatedUser();
  try {
    await selectPage(pageId);
  } catch (error) {
    return { error: friendlyError(error) };
  }
  revalidateMarketing();
  return { error: null };
}

export async function chooseMarketingAdAccount(adAccountId: string) {
  await requireAuthenticatedUser();
  try {
    await selectAdAccount(adAccountId);
  } catch (error) {
    return { error: friendlyError(error) };
  }
  revalidateMarketing();
  return { error: null };
}

export async function disconnectMarketing() {
  await requireAuthenticatedUser();
  try {
    await clearConnection();
  } catch (error) {
    return { error: friendlyError(error) };
  }
  revalidateMarketing();
  return { error: null };
}

// ---------------------------------------------------------------------------
// Instagram

export type InstagramOverview =
  | {
      error: null;
      profile: InstagramProfile;
      totals: InstagramTotals;
      dailyReach: DailyPoint[];
      media: InstagramMediaItem[];
    }
  | { error: string };

export async function getInstagramOverview(days: number): Promise<InstagramOverview> {
  await requireAuthenticatedUser();
  try {
    const access = instagramAccess(await loadConnection());
    const range = rangeDates(days, todayInBrasilia());
    const [profile, totals, dailyReach, media] = await Promise.all([
      fetchProfile(access),
      fetchTotals(access, range),
      fetchDailyReach(access, range).catch(() => []),
      fetchRecentMedia(access, 12),
    ]);
    return { error: null, profile, totals, dailyReach, media };
  } catch (error) {
    return { error: friendlyError(error) };
  }
}

// ---------------------------------------------------------------------------
// Posts

export async function getMarketingPosts(): Promise<MarketingPost[]> {
  const { supabase } = await requireAuthenticatedUser();
  const { data, error } = await supabase
    .from("marketing_posts")
    .select("*")
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as MarketingPost[];
}

export type MarketingPostInput = {
  kind: MarketingPostKind;
  caption: string;
  media: MarketingMedia[];
  /** rascunho = só guarda; agendar = usa scheduledAt; publicar = agora. */
  mode: "rascunho" | "agendar" | "publicar";
  scheduledAt: string | null;
};

function isOwnMedia(item: MarketingMedia) {
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/`;
  return (
    (item.type === "image" || item.type === "video") &&
    typeof item.path === "string" &&
    item.url === `${base}${item.path}`
  );
}

export type SaveMarketingPostResult = { error: string | null; post?: MarketingPost };

export async function saveMarketingPost(
  input: MarketingPostInput,
  postId?: string,
): Promise<SaveMarketingPostResult> {
  const { supabase, user } = await requireAuthenticatedUser();

  const caption = input.caption.trim();
  const scheduledAt = input.mode === "agendar" ? input.scheduledAt : null;
  if (input.mode === "agendar" && !input.scheduledAt) {
    return { error: "Escolha a data e a hora do agendamento." };
  }
  if (!input.media.every(isOwnMedia)) {
    return { error: "Mídia inválida. Envie os arquivos de novo." };
  }
  const validation = validatePostDraft({
    kind: input.kind,
    caption,
    media: input.media,
    scheduledAt,
  });
  if (validation) return { error: validation };

  if (input.mode !== "rascunho") {
    try {
      instagramAccess(await loadConnection());
    } catch (error) {
      return { error: friendlyError(error) };
    }
  }

  const fields = {
    kind: input.kind,
    caption,
    media: input.media,
    status: input.mode === "rascunho" ? "rascunho" : "agendado",
    scheduled_at: input.mode === "publicar" ? new Date().toISOString() : scheduledAt,
    container_id: null,
    error: null,
    attempts: 0,
    updated_at: new Date().toISOString(),
  };

  const query = postId
    ? supabase
        .from("marketing_posts")
        .update(fields)
        .eq("id", postId)
        .in("status", ["rascunho", "agendado", "erro"])
    : supabase.from("marketing_posts").insert({ ...fields, owner_id: user.id });
  const { data, error } = await query.select("*").maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Esse post já está sendo publicado e não pode mais ser editado." };

  let post = data as MarketingPost;
  if (input.mode === "publicar") {
    post = (await processPost(post.id)) ?? post;
  }
  revalidateMarketing();
  return { error: post.status === "erro" ? post.error ?? "Erro ao publicar." : null, post };
}

/** Publica agora um rascunho/agendado ou tenta de novo um que deu erro. */
export async function publishMarketingPostNow(postId: string) {
  const { supabase } = await requireAuthenticatedUser();
  try {
    instagramAccess(await loadConnection());
  } catch (error) {
    return { error: friendlyError(error) };
  }

  const { data: current, error: readError } = await supabase
    .from("marketing_posts")
    .select("*")
    .eq("id", postId)
    .maybeSingle();
  if (readError) return { error: readError.message };
  if (!current) return { error: "Post não encontrado." };
  const post = current as MarketingPost;
  if (post.status === "publicado") return { error: "Esse post já foi publicado." };

  const validation = validatePostDraft({
    kind: post.kind,
    caption: post.caption,
    media: post.media,
    scheduledAt: null,
  });
  if (validation) return { error: validation };

  if (post.status !== "publicando") {
    const { error } = await supabase
      .from("marketing_posts")
      .update({
        status: "agendado",
        scheduled_at: new Date().toISOString(),
        error: null,
        attempts: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);
    if (error) return { error: error.message };
  }

  const result = await processPost(postId);
  revalidateMarketing();
  if (!result) return { error: "Esse post já está sendo publicado. Aguarde um instante." };
  if (result.status === "erro") return { error: result.error ?? "Erro ao publicar." };
  return { error: null, status: result.status };
}

export async function unscheduleMarketingPost(postId: string) {
  const { supabase } = await requireAuthenticatedUser();
  const { error } = await supabase
    .from("marketing_posts")
    .update({ status: "rascunho", scheduled_at: null, updated_at: new Date().toISOString() })
    .eq("id", postId)
    .in("status", ["agendado", "erro"]);
  if (error) return { error: error.message };
  revalidateMarketing();
  return { error: null };
}

export async function deleteMarketingPost(postId: string) {
  const { supabase } = await requireAuthenticatedUser();
  const { data, error } = await supabase
    .from("marketing_posts")
    .delete()
    .eq("id", postId)
    .neq("status", "publicando")
    .select("media")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Post em publicação não pode ser apagado agora." };

  // O Instagram guarda a própria cópia: apagar daqui não tira do perfil.
  const paths = ((data.media ?? []) as MarketingMedia[]).map((item) => item.path);
  if (paths.length > 0) {
    await supabase.storage.from(MEDIA_BUCKET).remove(paths);
  }
  revalidateMarketing();
  return { error: null };
}

// ---------------------------------------------------------------------------
// Tráfego pago

export type AdsOverview =
  | {
      error: null;
      currency: string;
      rows: AdCampaignRow[];
      summary: ReturnType<typeof summarizeCampaigns>;
      dailySpend: DailyPoint[];
      dailyConversations: DailyPoint[];
      recentLeads: {
        id: string;
        name: string;
        stage: string;
        adTitle: string | null;
        createdAt: string;
      }[];
    }
  | { error: string };

export async function getAdsOverview(days: number): Promise<AdsOverview> {
  const { supabase } = await requireAuthenticatedUser();
  try {
    const access = adsAccess(await loadConnection());
    const range = rangeDates(days, todayInBrasilia());
    const sinceIso = new Date(`${range.since}T00:00:00-03:00`).toISOString();

    const [campaigns, insights, campaignByAd, daily, leadsResult] = await Promise.all([
      fetchCampaigns(access),
      fetchCampaignInsights(access, range),
      fetchCampaignByAd(access),
      fetchDailySpend(access, range),
      supabase
        .from("crm_clients")
        .select("id, name, stage, value, ad_id, ad_title, ad_first_seen_at, created_at")
        .not("ad_id", "is", null)
        .gte("ad_first_seen_at", sinceIso)
        .order("ad_first_seen_at", { ascending: false }),
    ]);
    if (leadsResult.error) throw new Error(leadsResult.error.message);

    const leads = (leadsResult.data ?? []) as (CrmAdLead & {
      id: string;
      name: string;
      ad_title: string | null;
      ad_first_seen_at: string | null;
      created_at: string;
    })[];
    const rows = buildCampaignRows(campaigns, insights, campaignByAd, leads);

    return {
      error: null,
      currency: access.currency,
      rows,
      summary: summarizeCampaigns(rows),
      dailySpend: daily.spend,
      dailyConversations: daily.conversations,
      recentLeads: leads.slice(0, 8).map((lead) => ({
        id: lead.id,
        name: lead.name,
        stage: lead.stage,
        adTitle: lead.ad_title,
        createdAt: lead.ad_first_seen_at ?? lead.created_at,
      })),
    };
  } catch (error) {
    return { error: friendlyError(error) };
  }
}

export async function toggleAdCampaign(campaignId: string, active: boolean) {
  await requireAuthenticatedUser();
  try {
    const access = adsAccess(await loadConnection());
    // Só mexe em campanha da conta escolhida — o id vem do navegador.
    const campaigns = await fetchCampaigns(access);
    if (!campaigns.some((campaign) => campaign.id === campaignId)) {
      return { error: "Campanha não encontrada nesta conta de anúncios." };
    }
    await setCampaignStatus(access.token, campaignId, active);
  } catch (error) {
    return { error: friendlyError(error) };
  }
  revalidatePath("/marketing/trafego");
  return { error: null };
}
