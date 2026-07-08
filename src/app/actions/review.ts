"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Project, SiteComment } from "@/types/briefing";

export type SiteOverview = Pick<
  Project,
  | "id"
  | "title"
  | "client_name"
  | "review_enabled"
  | "review_site_path"
  | "review_token"
  | "review_enabled_at"
  | "review_approved_at"
> & { openComments: number };

export type PublicReview = {
  title: string;
  review_site_path: string;
  token: string;
  review_enabled_at: string | null;
  review_approved_at: string | null;
};

export async function fetchReviewByToken(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_review_by_token", {
    p_token: token,
  });

  if (error || !data) return null;
  return data as PublicReview;
}

export async function listReviewComments(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_review_comments", {
    p_token: token,
  });

  if (error || !data) return [];
  return data as SiteComment[];
}

export async function addReviewComment(input: {
  token: string;
  pagePath: string;
  xPct: number;
  yPct: number;
  widthPct?: number;
  heightPct?: number;
  viewportWidth: number;
  comment: string;
  authorName?: string;
  authorEmail?: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_review_comment", {
    p_token: input.token,
    p_page_path: input.pagePath,
    p_x_pct: input.xPct,
    p_y_pct: input.yPct,
    p_viewport_width: input.viewportWidth,
    p_comment: input.comment,
    p_author_name: input.authorName ?? null,
    p_author_email: input.authorEmail ?? null,
    p_width_pct: input.widthPct ?? 0,
    p_height_pct: input.heightPct ?? 0,
  });

  if (error) return { error: error.message };
  return { commentId: data as string };
}

export async function enableSiteReview(projectId: string, sitePath: string) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("projects")
    .select("review_enabled_at")
    .eq("id", projectId)
    .maybeSingle();

  const { error } = await supabase
    .from("projects")
    .update({
      review_site_path: sitePath,
      review_enabled: true,
      review_enabled_at: existing?.review_enabled_at ?? new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/sites/${projectId}`);
  revalidatePath("/sites");
  return { success: true };
}

export async function getSitesOverview() {
  const supabase = await createClient();
  const { data: projects, error } = await supabase
    .from("projects")
    .select(
      "id, title, client_name, review_enabled, review_site_path, review_token, review_enabled_at, review_approved_at",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const { data: comments } = await supabase
    .from("site_comments")
    .select("project_id, status");

  const openCounts = new Map<string, number>();
  for (const c of comments ?? []) {
    if (c.status === "open") {
      openCounts.set(c.project_id, (openCounts.get(c.project_id) ?? 0) + 1);
    }
  }

  return (projects ?? []).map((p) => ({
    ...p,
    openComments: openCounts.get(p.id) ?? 0,
  })) as SiteOverview[];
}

export async function approveReview(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approve_review", {
    p_token: token,
  });

  if (error) return { error: error.message };
  return { approvedAt: data as string };
}

export async function getProjectComments(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_comments")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data as SiteComment[];
}

export async function resolveComment(commentId: string, projectId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("site_comments")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", commentId);

  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/sites/${projectId}`);
  return { success: true };
}
