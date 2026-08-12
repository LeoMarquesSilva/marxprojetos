"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/supabase/require-authenticated-user";
import type { BriefingQuestion, ProjectStatus } from "@/types/briefing";

export async function getTemplates() {
  const { supabase } = await requireAuthenticatedUser();
  const { data, error } = await supabase
    .from("briefing_templates")
    .select("*")
    .order("name");

  if (error) throw new Error(error.message);
  return data;
}

export async function getProjects() {
  const { supabase } = await requireAuthenticatedUser();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function getDashboardProjectSummary(includeAllProjects = false) {
  const { supabase } = await requireAuthenticatedUser();
  const recentResponseThreshold = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  let recentProjectsQuery = supabase
    .from("projects")
    .select("id, title, client_name, status, created_at, submitted_at")
    .order("created_at", { ascending: false });

  if (!includeAllProjects) {
    recentProjectsQuery = recentProjectsQuery.limit(6);
  }

  const [
    totalResult,
    submittedResult,
    pendingResult,
    recentProjectsResult,
    recentResponsesResult,
  ] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("status", "submitted"),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .in("status", ["sent", "in_progress"]),
    recentProjectsQuery,
    supabase
      .from("projects")
      .select("id, title, client_name, submitted_at", { count: "exact" })
      .not("submitted_at", "is", null)
      .gte("submitted_at", recentResponseThreshold)
      .order("submitted_at", { ascending: false })
      .limit(3),
  ]);

  const firstError = [
    totalResult.error,
    submittedResult.error,
    pendingResult.error,
    recentProjectsResult.error,
    recentResponsesResult.error,
  ].find(Boolean);
  if (firstError) throw new Error(firstError.message);

  return {
    total: totalResult.count ?? 0,
    submitted: submittedResult.count ?? 0,
    pending: pendingResult.count ?? 0,
    recentProjects: recentProjectsResult.data ?? [],
    recentResponseCount: recentResponsesResult.count ?? 0,
    recentResponses: recentResponsesResult.data ?? [],
  };
}

export async function getProject(id: string) {
  const { supabase } = await requireAuthenticatedUser();
  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!project) return { project: null, submission: null };

  const { data: submission } = await supabase
    .from("briefing_submissions")
    .select("*")
    .eq("project_id", id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { project, submission };
}

type CreateProjectInput = {
  title: string;
  templateId: string;
  clientName?: string;
  clientEmail?: string;
  clientCompany?: string;
  welcomeMessage?: string;
  questions: BriefingQuestion[];
  crmClientId?: string | null;
};

export async function createProject(input: CreateProjectInput) {
  const { supabase, user } = await requireAuthenticatedUser();

  const { data, error } = await supabase
    .from("projects")
    .insert({
      owner_id: user.id,
      template_id: input.templateId,
      title: input.title,
      client_name: input.clientName || null,
      client_email: input.clientEmail || null,
      client_company: input.clientCompany || null,
      welcome_message: input.welcomeMessage || null,
      questions: input.questions,
      status: "sent" as ProjectStatus,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Mantém o CRM sincronizado com todo briefing criado: vincula ao cliente
  // escolhido, ou cria um lead novo se o nome digitado não bate com ninguém
  // existente. Best-effort — uma falha aqui não deve travar a criação do
  // projeto, que já foi persistido com sucesso.
  if (input.crmClientId) {
    await supabase
      .from("crm_clients")
      .update({ project_id: data.id, updated_at: new Date().toISOString() })
      .eq("id", input.crmClientId);
  } else if (input.clientName?.trim()) {
    await supabase.from("crm_clients").insert({
      owner_id: user.id,
      name: input.clientName.trim(),
      company: input.clientCompany?.trim() || null,
      email: input.clientEmail?.trim() || null,
      stage: "enviado",
      project_id: data.id,
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/crm");
  redirect(`/projects/${data.id}`);
}

export async function updateProjectStatus(id: string, status: ProjectStatus) {
  const { supabase } = await requireAuthenticatedUser();
  const { error } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath(`/projects/${id}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateProjectQuestions(
  id: string,
  questions: BriefingQuestion[],
) {
  const { supabase } = await requireAuthenticatedUser();
  const { error } = await supabase
    .from("projects")
    .update({ questions })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath(`/projects/${id}`);
  return { success: true };
}
