"use server";

import { revalidatePath } from "next/cache";
import {
  buildCrmClientUpdatePatch,
  buildCrmStagePatch,
  findUnlinkedProspectIdByPhone,
  getBrasiliaStoredDayStart,
  type CrmClientUpdateFields,
} from "@/lib/crm-rules";
import { requireAuthenticatedUser } from "@/lib/supabase/require-authenticated-user";
import type {
  CrmBoardClient,
  CrmClient,
  CrmClientChatSignal,
  CrmInboxChat,
  CrmStage,
} from "@/types/crm";

export async function getCrmClients() {
  const { supabase } = await requireAuthenticatedUser();
  const { data, error } = await supabase
    .from("crm_clients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data as CrmClient[];
}

export async function getCrmDashboardSummary() {
  const { supabase } = await requireAuthenticatedUser();
  const currentDayStart = getBrasiliaStoredDayStart();

  const [clientsResult, unreadResult, overdueResult] = await Promise.all([
    supabase.from("crm_clients").select("stage, value"),
    supabase
      .from("crm_whatsapp_chats")
      .select("remote_jid", { count: "exact", head: true })
      .gt("unread_count", 0),
    supabase
      .from("crm_clients")
      .select("id, name, next_step, next_step_at", { count: "exact" })
      .not("next_step", "is", null)
      .lt("next_step_at", currentDayStart)
      .not("stage", "in", "(fechado,perdido)")
      .order("next_step_at", { ascending: true })
      .limit(3),
  ]);

  if (clientsResult.error) throw new Error(clientsResult.error.message);
  if (unreadResult.error) throw new Error(unreadResult.error.message);
  if (overdueResult.error) throw new Error(overdueResult.error.message);

  const clients = clientsResult.data ?? [];
  const openClients = clients.filter(
    (client) => client.stage !== "fechado" && client.stage !== "perdido",
  );

  return {
    active: openClients.length,
    openValue: openClients.reduce(
      (total, client) => total + Number(client.value ?? 0),
      0,
    ),
    closed: clients.filter((client) => client.stage === "fechado").length,
    unreadConversations: unreadResult.count ?? 0,
    overdueCount: overdueResult.count ?? 0,
    overdueSteps: (overdueResult.data ?? []).map((client) => ({
      id: client.id,
      name: client.name,
      step: client.next_step as string,
      dueAt: client.next_step_at as string,
    })),
  };
}

export async function getCrmUnreadConversationCount(): Promise<number> {
  const { supabase } = await requireAuthenticatedUser();
  const { count, error } = await supabase
    .from("crm_whatsapp_chats")
    .select("remote_jid", { count: "exact", head: true })
    .gt("unread_count", 0);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

// O board precisa do sinal de conversa junto com o cliente. Buscamos as duas
// tabelas em paralelo e casamos em memória em vez de usar join do PostgREST:
// a relação vive em crm_whatsapp_chats.client_id (que pode ser nulo enquanto
// o número não bate com nenhum cliente), e um embed devolveria array, não o
// registro único que o card espera.
export async function getCrmBoardClients(): Promise<CrmBoardClient[]> {
  const { supabase } = await requireAuthenticatedUser();

  const [clientsResult, chatsResult] = await Promise.all([
    supabase.from("crm_clients").select("*").order("created_at", { ascending: false }),
    supabase
      .from("crm_whatsapp_chats")
      .select("remote_jid, client_id, unread_count, last_message_at, last_message_preview")
      .not("client_id", "is", null),
  ]);

  if (clientsResult.error) throw new Error(clientsResult.error.message);
  if (chatsResult.error) throw new Error(chatsResult.error.message);

  const chatByClient = new Map<string, CrmClientChatSignal>();
  for (const chat of chatsResult.data ?? []) {
    if (!chat.client_id) continue;
    chatByClient.set(chat.client_id, {
      remoteJid: chat.remote_jid,
      unreadCount: chat.unread_count ?? 0,
      lastMessageAt: chat.last_message_at,
      lastMessagePreview: chat.last_message_preview,
    });
  }

  return (clientsResult.data as CrmClient[]).map((client) => ({
    ...client,
    chat: chatByClient.get(client.id) ?? null,
  }));
}

export async function getCrmClient(id: string) {
  const { supabase } = await requireAuthenticatedUser();
  const { data: client, error } = await supabase
    .from("crm_clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return { client: (client as CrmClient) ?? null };
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
  const { supabase, user } = await requireAuthenticatedUser();

  const { data, error } = await supabase
    .from("crm_clients")
    .insert({
      owner_id: user.id,
      name: input.name,
      company: input.company || null,
      email: input.email || null,
      phone: input.phone || null,
      source: input.source || null,
      stage: input.stage ?? "enviado",
      value: input.value ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/crm");
  return { id: data.id as string };
}

export async function createAndLinkCrmClientFromChat(input: {
  remoteJid: string;
  name: string;
  phone: string;
}) {
  const remoteJid = input.remoteJid.trim();
  const name = input.name.trim();
  const phone = input.phone.trim();

  if (!remoteJid || !name || !phone) {
    return { error: "Nome, telefone e conversa são obrigatórios." };
  }

  const { supabase, user } = await requireAuthenticatedUser();

  const { data: chat, error: chatError } = await supabase
    .from("crm_whatsapp_chats")
    .select("remote_jid, client_id")
    .eq("remote_jid", remoteJid)
    .maybeSingle();

  if (chatError) return { error: chatError.message };
  if (!chat) return { error: "Conversa não encontrada." };
  if (chat.client_id) return { error: "Esta conversa já possui um cliente." };

  const { data: prospects, error: prospectsError } = await supabase
    .from("prospects")
    .select("id, phone, phone_e164, crm_client_id")
    .is("crm_client_id", null);

  if (prospectsError) return { error: prospectsError.message };

  const prospectId = findUnlinkedProspectIdByPhone(
    prospects ?? [],
    remoteJid,
    phone,
  );

  const { data: client, error: createError } = await supabase
    .from("crm_clients")
    .insert({
      owner_id: user.id,
      name,
      phone,
      source: "WhatsApp",
      stage: "respondeu" satisfies CrmStage,
    })
    .select("id, name, company, phone, email, source, stage, value, lost_reason")
    .single();

  if (createError || !client) {
    return { error: createError?.message ?? "Não foi possível criar o cliente." };
  }
  const createdClientId = client.id;

  async function rollbackCreatedClient(message: string) {
    const { error: rollbackError } = await supabase
      .from("crm_clients")
      .delete()
      .eq("id", createdClientId);
    return {
      error: rollbackError
        ? `${message} Falha ao desfazer a criação: ${rollbackError.message}`
        : message,
    };
  }

  const { data: linkedChat, error: linkError } = await supabase
    .from("crm_whatsapp_chats")
    .update({ client_id: client.id, updated_at: new Date().toISOString() })
    .eq("remote_jid", remoteJid)
    .is("client_id", null)
    .select("remote_jid")
    .maybeSingle();

  if (linkError || !linkedChat) {
    return rollbackCreatedClient(
      linkError?.message ??
        "A conversa foi vinculada por outra pessoa. Atualize a inbox.",
    );
  }

  // Mantém a ficha do cliente completa: as mensagens históricas passam a
  // acompanhar o mesmo vínculo usado pela conversa.
  const { error: messagesError } = await supabase
    .from("crm_whatsapp_mensagens")
    .update({ client_id: client.id })
    .eq("remote_jid", remoteJid)
    .is("client_id", null);

  if (messagesError) {
    return rollbackCreatedClient(messagesError.message);
  }

  if (prospectId) {
    const { data: linkedProspect, error: prospectLinkError } = await supabase
      .from("prospects")
      .update({
        crm_client_id: client.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", prospectId)
      .is("crm_client_id", null)
      .select("id")
      .maybeSingle();

    if (prospectLinkError || !linkedProspect) {
      return rollbackCreatedClient(
        prospectLinkError?.message ??
          "Este prospect já foi promovido ao CRM. Atualize a inbox.",
      );
    }
  }

  revalidatePath("/crm");
  revalidatePath(`/crm/${client.id}`);
  if (prospectId) revalidatePath("/prospeccao");

  return {
    client: {
      id: client.id,
      name: client.name,
      company: client.company,
      phone: client.phone,
      email: client.email,
      source: client.source,
      stage: client.stage as CrmStage,
      value: client.value == null ? null : Number(client.value),
      lost_reason: client.lost_reason,
    } satisfies NonNullable<CrmInboxChat["client"]>,
  };
}

export async function updateCrmClientStage(
  id: string,
  stage: CrmStage,
  lostReason?: string | null,
) {
  const stageUpdate = buildCrmStagePatch(
    stage,
    lostReason,
    new Date().toISOString(),
  );
  if ("error" in stageUpdate) return stageUpdate;

  const { supabase } = await requireAuthenticatedUser();
  const { error } = await supabase
    .from("crm_clients")
    .update(stageUpdate.patch)
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/crm");
  revalidatePath(`/crm/${id}`);
  return { success: true };
}

export async function updateCrmClient(
  id: string,
  input: CrmClientUpdateFields,
): Promise<
  { error: string; success?: never } | { error?: never; success: true }
> {
  const { supabase } = await requireAuthenticatedUser();
  const updatedAt = new Date().toISOString();
  let update = buildCrmClientUpdatePatch(input, undefined, updatedAt);

  if ("requiresCurrentStage" in update) {
    const { data: currentClient, error: currentClientError } = await supabase
      .from("crm_clients")
      .select("stage")
      .eq("id", id)
      .maybeSingle();

    if (currentClientError) return { error: currentClientError.message };
    if (!currentClient) return { error: "Cliente não encontrado." };

    update = buildCrmClientUpdatePatch(
      input,
      currentClient.stage as CrmStage,
      updatedAt,
    );
  }

  if ("error" in update) return update;
  if ("requiresCurrentStage" in update) {
    return { error: "Não foi possível validar o motivo da perda." };
  }

  if (update.requiresNonLostStage) {
    const { data: updatedClient, error } = await supabase
      .from("crm_clients")
      .update(update.patch)
      .eq("id", id)
      .neq("stage", "perdido")
      .select("id")
      .maybeSingle();

    if (error) return { error: error.message };
    if (!updatedClient) {
      return { error: "Informe o motivo da perda." };
    }
  } else {
    const { error } = await supabase
      .from("crm_clients")
      .update(update.patch)
      .eq("id", id);

    if (error) return { error: error.message };
  }
  revalidatePath("/crm");
  revalidatePath(`/crm/${id}`);
  return { success: true };
}

export async function getLinkableProjects(currentProjectId: string | null) {
  const { supabase } = await requireAuthenticatedUser();
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
  const { supabase } = await requireAuthenticatedUser();
  const { error } = await supabase
    .from("crm_clients")
    .update({ project_id: projectId, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath(`/crm/${id}`);
  return { success: true };
}

export async function deleteCrmClient(id: string) {
  const { supabase } = await requireAuthenticatedUser();
  const { error } = await supabase.from("crm_clients").delete().eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/crm");
  return { success: true };
}

// Tarefas e histórico foram removidos: as duas tabelas ficaram com zero
// linhas desde a criação. No lugar entrou um "próximo passo" único, que
// responde a mesma pergunta sem virar duas listas para manter.
export async function updateCrmNextStep(
  clientId: string,
  input: { step: string; date: string | null },
) {
  const { supabase } = await requireAuthenticatedUser();
  const step = input.step.trim();

  const { error } = await supabase
    .from("crm_clients")
    .update({
      next_step: step || null,
      // Data sem passo não significa nada — limpa junto.
      next_step_at: step && input.date ? `${input.date}T12:00:00Z` : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId);

  if (error) return { error: error.message };

  revalidatePath(`/crm/${clientId}`);
  revalidatePath("/crm");
  return { success: true };
}
