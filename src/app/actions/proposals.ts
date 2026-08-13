"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  Proposal,
  ProposalBlock,
  ProposalSession,
  ProposalStatus,
  PublicProposal,
} from "@/types/proposal";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// A RPC é a fronteira pública: devolve só a allowlist do SQL e apenas se a
// proposta estiver publicada.
export async function getProposalByToken(
  token: string,
): Promise<PublicProposal | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_proposal_by_token", {
    p_token: token,
  });

  if (error) return null;
  const rows = (data ?? []) as PublicProposal[];
  return rows[0] ?? null;
}

export async function getProposals(): Promise<Proposal[]> {
  const { supabase, user } = await requireUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("proposals")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Proposal[];
}

export async function getProposal(id: string): Promise<{
  proposal: Proposal | null;
  sessions: ProposalSession[];
}> {
  const { supabase, user } = await requireUser();
  if (!user) return { proposal: null, sessions: [] };

  const { data: proposal, error } = await supabase
    .from("proposals")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!proposal) return { proposal: null, sessions: [] };

  const { data: sessions } = await supabase
    .from("proposal_sessions")
    .select("*")
    .eq("proposal_id", id)
    .order("started_at", { ascending: false });

  return {
    proposal: proposal as Proposal,
    sessions: (sessions ?? []) as ProposalSession[],
  };
}

export async function createProposal(input: {
  title: string;
  subtitle?: string;
  clientName: string;
  crmClientId?: string | null;
  content?: ProposalBlock[];
}) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const title = input.title.trim();
  const clientName = input.clientName.trim();
  if (!title) return { error: "Informe o título da proposta." };
  if (!clientName) return { error: "Informe o nome do cliente." };

  const { data, error } = await supabase
    .from("proposals")
    .insert({
      owner_id: user.id,
      crm_client_id: input.crmClientId ?? null,
      title,
      subtitle: input.subtitle?.trim() || null,
      client_name: clientName,
      content: input.content ?? [],
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/propostas");
  return { id: data.id as string };
}

export async function updateProposal(
  id: string,
  input: {
    title: string;
    subtitle: string;
    clientName: string;
    content: ProposalBlock[];
    validUntil: string | null;
  },
) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const title = input.title.trim();
  const clientName = input.clientName.trim();
  if (!title) return { error: "Informe o título da proposta." };
  if (!clientName) return { error: "Informe o nome do cliente." };

  const { error } = await supabase
    .from("proposals")
    .update({
      title,
      subtitle: input.subtitle.trim() || null,
      client_name: clientName,
      content: input.content,
      valid_until: input.validUntil || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidateProposal(id);
  return { success: true };
}

// Publicar é o que faz o link abrir. Guarda sent_at na primeira publicação
// para o painel saber há quanto tempo a proposta está com o cliente.
export async function setProposalPublished(id: string, published: boolean) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const { data: current } = await supabase
    .from("proposals")
    .select("sent_at, status")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("proposals")
    .update({
      published,
      sent_at: published ? (current?.sent_at ?? new Date().toISOString()) : current?.sent_at,
      status:
        published && current?.status === "rascunho" ? "enviada" : current?.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidateProposal(id);
  return { success: true };
}

export async function setProposalStatus(id: string, status: ProposalStatus) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const decided = status === "aceita" || status === "recusada";

  const { error } = await supabase
    .from("proposals")
    .update({
      status,
      decided_at: decided ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidateProposal(id);
  return { success: true };
}

export async function deleteProposal(id: string) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const { error } = await supabase.from("proposals").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/propostas");
  return { success: true };
}

function revalidateProposal(id: string) {
  revalidatePath("/propostas");
  revalidatePath(`/propostas/${id}`);
}
