import "server-only";

import { graphGet, graphPost, MetaGraphError } from "@/lib/meta/graph";
import { rangeToUnix, toNumber } from "@/lib/marketing";
import type {
  DailyPoint,
  InstagramMediaItem,
  InstagramProfile,
  InstagramTotals,
  MarketingPost,
} from "@/types/marketing";

type Access = { token: string; igUserId: string };

export async function fetchProfile({ token, igUserId }: Access): Promise<InstagramProfile> {
  const data = await graphGet<{
    id: string;
    username: string;
    name?: string;
    biography?: string;
    profile_picture_url?: string;
    followers_count?: number;
    follows_count?: number;
    media_count?: number;
  }>(igUserId, token, {
    fields:
      "id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count",
  });
  return {
    id: data.id,
    username: data.username,
    name: data.name ?? null,
    biography: data.biography ?? null,
    pictureUrl: data.profile_picture_url ?? null,
    followers: data.followers_count ?? 0,
    follows: data.follows_count ?? 0,
    mediaCount: data.media_count ?? 0,
  };
}

type InsightRow = {
  name: string;
  values?: { value: number | Record<string, number>; end_time?: string }[];
  total_value?: { value?: number; breakdowns?: { results?: { dimension_values?: string[]; value?: number }[] }[] };
};

/**
 * Totais do período. Desde a v21 a Meta trocou "impressions" por "views" e
 * passou a pedir metric_type=total_value para quase tudo do perfil.
 */
export async function fetchTotals(
  access: Access,
  range: { since: string; until: string },
): Promise<InstagramTotals> {
  const unix = rangeToUnix(range);
  const totals: InstagramTotals = {
    reach: null,
    views: null,
    accountsEngaged: null,
    interactions: null,
    profileLinkTaps: null,
    follows: null,
    unfollows: null,
  };

  const main = await graphGet<{ data: InsightRow[] }>(`${access.igUserId}/insights`, access.token, {
    metric: "reach,views,accounts_engaged,total_interactions,profile_links_taps",
    metric_type: "total_value",
    period: "day",
    since: unix.since,
    until: unix.until,
  });
  for (const row of main.data ?? []) {
    const value = row.total_value?.value ?? null;
    if (row.name === "reach") totals.reach = value;
    if (row.name === "views") totals.views = value;
    if (row.name === "accounts_engaged") totals.accountsEngaged = value;
    if (row.name === "total_interactions") totals.interactions = value;
    if (row.name === "profile_links_taps") totals.profileLinkTaps = value;
  }

  // Seguir/deixar de seguir só existe para contas com 100+ seguidores.
  try {
    const follows = await graphGet<{ data: InsightRow[] }>(
      `${access.igUserId}/insights`,
      access.token,
      {
        metric: "follows_and_unfollows",
        metric_type: "total_value",
        breakdown: "follow_type",
        period: "day",
        since: unix.since,
        until: unix.until,
      },
    );
    const results = follows.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
    for (const result of results) {
      const type = result.dimension_values?.[0];
      if (type === "FOLLOWER") totals.follows = result.value ?? 0;
      if (type === "NON_FOLLOWER") totals.unfollows = result.value ?? 0;
    }
  } catch (error) {
    if (!(error instanceof MetaGraphError) || error.needsReconnect) throw error;
  }

  return totals;
}

/** Alcance por dia — a única série diária que a Meta ainda entrega do perfil. */
export async function fetchDailyReach(
  access: Access,
  range: { since: string; until: string },
): Promise<DailyPoint[]> {
  const unix = rangeToUnix(range);
  const data = await graphGet<{ data: InsightRow[] }>(`${access.igUserId}/insights`, access.token, {
    metric: "reach",
    period: "day",
    since: unix.since,
    until: unix.until,
  });
  return (data.data?.[0]?.values ?? []).map((point) => ({
    // end_time é o fim do dia (meia-noite seguinte, horário do Pacífico):
    // recuar algumas horas devolve o dia a que o número pertence.
    date: new Date(Date.parse(point.end_time ?? "") - 12 * 3600_000).toISOString().slice(0, 10),
    value: typeof point.value === "number" ? point.value : 0,
  }));
}

type MediaRow = {
  id: string;
  caption?: string;
  media_type: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
};

export async function fetchRecentMedia(access: Access, limit = 12): Promise<InstagramMediaItem[]> {
  const list = await graphGet<{ data: MediaRow[] }>(`${access.igUserId}/media`, access.token, {
    fields:
      "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
    limit,
  });

  return Promise.all(
    (list.data ?? []).map(async (media) => {
      const metrics = await fetchMediaMetrics(access.token, media.id).catch(() => null);
      return {
        id: media.id,
        caption: media.caption ?? null,
        mediaType: media.media_type,
        productType: media.media_product_type ?? null,
        thumbnailUrl:
          media.media_type === "VIDEO" ? media.thumbnail_url ?? null : media.media_url ?? null,
        permalink: media.permalink,
        timestamp: media.timestamp,
        likes: media.like_count ?? 0,
        comments: media.comments_count ?? 0,
        reach: metrics?.reach ?? null,
        views: metrics?.views ?? null,
        saved: metrics?.saved ?? null,
        shares: metrics?.shares ?? null,
      };
    }),
  );
}

async function fetchMediaMetrics(token: string, mediaId: string) {
  const data = await graphGet<{ data: InsightRow[] }>(`${mediaId}/insights`, token, {
    metric: "reach,views,saved,shares",
  });
  const byName = new Map(
    (data.data ?? []).map((row) => [row.name, toNumber(row.values?.[0]?.value)]),
  );
  return {
    reach: byName.get("reach") ?? null,
    views: byName.get("views") ?? null,
    saved: byName.get("saved") ?? null,
    shares: byName.get("shares") ?? null,
  };
}

// ---------------------------------------------------------------------------
// Publicação. A Meta publica em duas etapas: cria um "container" a partir da
// URL pública da mídia e, quando ele termina de processar, publica. Foto
// processa em segundos; vídeo pode levar minutos — por isso cada chamada
// avança só o que dá e o cron continua depois.

export type PublishStep =
  | { status: "publicando"; containerId: string }
  | { status: "publicado"; containerId: string; mediaId: string; permalink: string | null }
  | { status: "erro"; containerId: string | null; error: string };

async function createContainer(access: Access, post: MarketingPost): Promise<string> {
  const path = `${access.igUserId}/media`;
  if (post.kind === "imagem") {
    const result = await graphPost<{ id: string }>(path, access.token, {
      image_url: post.media[0].url,
      caption: post.caption,
    });
    return result.id;
  }
  if (post.kind === "reels") {
    const result = await graphPost<{ id: string }>(path, access.token, {
      media_type: "REELS",
      video_url: post.media[0].url,
      caption: post.caption,
      share_to_feed: true,
    });
    return result.id;
  }

  const children: string[] = [];
  for (const item of post.media) {
    const child = await graphPost<{ id: string }>(path, access.token, {
      image_url: item.url,
      is_carousel_item: true,
    });
    children.push(child.id);
  }
  // Os filhos (fotos) precisam terminar antes de montar o carrossel.
  for (const child of children) {
    await waitFinished(access.token, child, 6);
  }
  const result = await graphPost<{ id: string }>(path, access.token, {
    media_type: "CAROUSEL",
    children: children.join(","),
    caption: post.caption,
  });
  return result.id;
}

type ContainerStatus = { status_code?: string; status?: string };

async function containerStatus(token: string, containerId: string) {
  return graphGet<ContainerStatus>(containerId, token, { fields: "status_code,status" });
}

async function waitFinished(token: string, containerId: string, attempts: number) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const status = await containerStatus(token, containerId);
    if (status.status_code === "FINISHED") return status;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") return status;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return containerStatus(token, containerId);
}

/** Avança o post o quanto der agora. Nunca lança: erro vira estado. */
export async function advancePublish(access: Access, post: MarketingPost): Promise<PublishStep> {
  let containerId = post.container_id;
  try {
    if (!containerId) containerId = await createContainer(access, post);

    const status = await waitFinished(access.token, containerId, post.kind === "reels" ? 2 : 4);
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      return {
        status: "erro",
        // Container com erro não se recupera: o próximo envio cria outro.
        containerId: null,
        error:
          status.status_code === "EXPIRED"
            ? "O container expirou antes de publicar (24h). Envie de novo."
            : `A Meta não conseguiu processar a mídia. ${status.status ?? ""}`.trim(),
      };
    }
    if (status.status_code !== "FINISHED") {
      return { status: "publicando", containerId };
    }

    const published = await graphPost<{ id: string }>(
      `${access.igUserId}/media_publish`,
      access.token,
      { creation_id: containerId },
    );
    const details = await graphGet<{ permalink?: string }>(published.id, access.token, {
      fields: "permalink",
    }).catch(() => null);
    return {
      status: "publicado",
      containerId,
      mediaId: published.id,
      permalink: details?.permalink ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao publicar.";
    return { status: "erro", containerId: containerId ?? null, error: message };
  }
}
