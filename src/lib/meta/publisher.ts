import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { instagramAccess, loadConnection } from "@/lib/meta/connection";
import { advancePublish } from "@/lib/meta/instagram";
import type { MarketingPost } from "@/types/marketing";

// Publica posts agendados ou que estão no meio do processamento. Chamado
// pelo cron (/api/cron/marketing), pelo botão "Publicar agora" e quando a
// tela de posts abre — qualquer um que chegue primeiro avança o post.

const LOCK_SECONDS = 120;
const MAX_ATTEMPTS = 20;

async function claim(postId: string): Promise<MarketingPost | null> {
  const admin = createAdminClient();
  const now = new Date();
  const { data, error } = await admin
    .from("marketing_posts")
    .update({ locked_until: new Date(now.getTime() + LOCK_SECONDS * 1000).toISOString() })
    .eq("id", postId)
    .in("status", ["agendado", "publicando"])
    .or(`locked_until.is.null,locked_until.lt.${now.toISOString()}`)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MarketingPost | null) ?? null;
}

/** Avança um post. Devolve o estado depois da tentativa. */
export async function processPost(postId: string): Promise<MarketingPost | null> {
  const post = await claim(postId);
  if (!post) return null;

  const admin = createAdminClient();
  const update: Record<string, unknown> = {
    locked_until: null,
    attempts: post.attempts + 1,
    updated_at: new Date().toISOString(),
  };

  try {
    const access = instagramAccess(await loadConnection());
    const step = await advancePublish(access, post);
    update.container_id = step.containerId;
    if (step.status === "publicado") {
      update.status = "publicado";
      update.ig_media_id = step.mediaId;
      update.permalink = step.permalink;
      update.published_at = new Date().toISOString();
      update.error = null;
    } else if (step.status === "publicando") {
      // Vídeo ainda processando; desiste se ficar preso tempo demais.
      const stuck = post.attempts + 1 >= MAX_ATTEMPTS;
      update.status = stuck ? "erro" : "publicando";
      update.error = stuck ? "A Meta não terminou de processar o vídeo. Tente de novo." : null;
    } else {
      update.status = "erro";
      update.error = step.error;
    }
  } catch (error) {
    update.status = "erro";
    update.error = error instanceof Error ? error.message : "Erro ao publicar.";
  }

  const { data, error } = await admin
    .from("marketing_posts")
    .update(update)
    .eq("id", postId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as MarketingPost;
}

export async function processDuePosts(limit = 5) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("marketing_posts")
    .select("id")
    .or(`status.eq.publicando,and(status.eq.agendado,scheduled_at.lte.${now})`)
    .order("scheduled_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const results: { id: string; status: string | null }[] = [];
  for (const row of (data ?? []) as { id: string }[]) {
    const post = await processPost(row.id);
    results.push({ id: row.id, status: post?.status ?? null });
  }
  return results;
}
