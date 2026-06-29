"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { BriefingQuestion, ProjectStatus } from "@/types/briefing";

export async function getTemplates() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("briefing_templates")
    .select("*")
    .order("name");

  if (error) throw new Error(error.message);
  return data;
}

export async function getProjects() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function getProject(id: string) {
  const supabase = await createClient();
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
};

export async function createProject(input: CreateProjectInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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

  revalidatePath("/dashboard");
  redirect(`/projects/${data.id}`);
}

export async function updateProjectStatus(id: string, status: ProjectStatus) {
  const supabase = await createClient();
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
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ questions })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath(`/projects/${id}`);
  return { success: true };
}
