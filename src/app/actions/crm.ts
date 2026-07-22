"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CrmClient, CrmNote, CrmStage, CrmTask } from "@/types/crm";

export async function getCrmClients() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_clients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data as CrmClient[];
}

export async function getCrmClient(id: string) {
  const supabase = await createClient();
  const { data: client, error } = await supabase
    .from("crm_clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!client) return { client: null, tasks: [], notes: [] };

  const { data: tasks } = await supabase
    .from("crm_tasks")
    .select("*")
    .eq("client_id", id)
    .order("due_date", { ascending: true, nullsFirst: false });

  const { data: notes } = await supabase
    .from("crm_notes")
    .select("*")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  return {
    client: client as CrmClient,
    tasks: (tasks ?? []) as CrmTask[],
    notes: (notes ?? []) as CrmNote[],
  };
}

type CreateCrmClientInput = {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  source?: string;
  stage?: CrmStage;
  value?: number;
};

export async function createCrmClient(input: CreateCrmClientInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("crm_clients")
    .insert({
      owner_id: user.id,
      name: input.name,
      company: input.company || null,
      email: input.email || null,
      phone: input.phone || null,
      source: input.source || null,
      stage: input.stage ?? "lead",
      value: input.value ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/crm");
  return { id: data.id as string };
}

export async function updateCrmClientStage(id: string, stage: CrmStage) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_clients")
    .update({ stage, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/crm");
  revalidatePath(`/crm/${id}`);
  return { success: true };
}

type UpdateCrmClientInput = {
  name?: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  value?: number | null;
  lost_reason?: string | null;
};

export async function updateCrmClient(id: string, input: UpdateCrmClientInput) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_clients")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/crm");
  revalidatePath(`/crm/${id}`);
  return { success: true };
}

export async function getLinkableProjects(currentProjectId: string | null) {
  const supabase = await createClient();
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, title, client_name")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const { data: linked } = await supabase
    .from("crm_clients")
    .select("project_id")
    .not("project_id", "is", null);

  const linkedIds = new Set((linked ?? []).map((l) => l.project_id));

  return (projects ?? []).filter(
    (p) => !linkedIds.has(p.id) || p.id === currentProjectId,
  ) as { id: string; title: string; client_name: string | null }[];
}

export async function linkCrmClientProject(id: string, projectId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_clients")
    .update({ project_id: projectId, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath(`/crm/${id}`);
  return { success: true };
}

export async function deleteCrmClient(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_clients").delete().eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/crm");
  return { success: true };
}

export async function createCrmTask(
  clientId: string,
  title: string,
  dueDate?: string,
) {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_tasks").insert({
    client_id: clientId,
    title,
    due_date: dueDate || null,
  });

  if (error) return { error: error.message };
  revalidatePath(`/crm/${clientId}`);
  return { success: true };
}

export async function toggleCrmTask(id: string, clientId: string, done: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_tasks")
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath(`/crm/${clientId}`);
  return { success: true };
}

export async function deleteCrmTask(id: string, clientId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_tasks").delete().eq("id", id);

  if (error) return { error: error.message };
  revalidatePath(`/crm/${clientId}`);
  return { success: true };
}

export async function createCrmNote(clientId: string, body: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_notes").insert({
    client_id: clientId,
    body,
  });

  if (error) return { error: error.message };
  revalidatePath(`/crm/${clientId}`);
  return { success: true };
}
