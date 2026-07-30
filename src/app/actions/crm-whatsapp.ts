"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchWhatsAppProfile, findWhatsAppChats, findWhatsAppMessages, sendWhatsAppText } from "@/lib/evolution";
import { normalizeBrPhone, phoneToRemoteJid, remoteJidToDigits } from "@/lib/phone";
import type {
  CrmInboxChat,
  CrmInboxProspect,
  CrmNote,
  CrmStage,
  CrmWhatsappMessage,
  CrmWhatsappReaction,
} from "@/types/crm";

const PROFILE_TTL_MS = 1000 * 60 * 60 * 12; // 12h

async function resolveRemoteJid(clientId: string) {
  const supabase = await createClient();
  const { data: client, error } = await supabase
    .from("crm_clients")
    .select("id, phone")
    .eq("id", clientId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!client) return { supabase, client: null, remoteJid: null };

  const normalized = client.phone ? normalizeBrPhone(client.phone) : null;
  if (!normalized?.e164) return { supabase, client, remoteJid: null };

  return { supabase, client, remoteJid: phoneToRemoteJid(normalized.e164) };
}

function mapMessage(row: Record<string, unknown>): CrmWhatsappMessage {
  return {
    id: row.id as string,
    remote_jid: row.remote_jid as string,
    client_id: (row.client_id as string | null) ?? null,
    from_me: Boolean(row.from_me),
    conteudo: (row.conteudo as string | null) ?? null,
    status: row.status as CrmWhatsappMessage["status"],
    erro: (row.erro as string | null) ?? null,
    created_at: row.created_at as string,
    provider_message_id: (row.provider_message_id as string | null) ?? null,
    reactions: (row.reactions as CrmWhatsappReaction[] | null) ?? [],
  };
}

export async function getCrmWhatsappInbox(): Promise<CrmInboxChat[]> {
  const supabase = await createClient();

  const [chatsResult, clientsResult] = await Promise.all([
    supabase
      .from("crm_whatsapp_chats")
      .select(
        "remote_jid, client_id, push_name, profile_name, profile_picture_url, profile_status, last_message_at, last_message_preview, unread_count, inbox_note",
      )
      .order("last_message_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("crm_clients")
      .select("id, name, company, phone, email, source, stage, value"),
  ]);

  if (chatsResult.error) throw new Error(chatsResult.error.message);
  if (clientsResult.error) throw new Error(clientsResult.error.message);

  const clientById = new Map(
    (clientsResult.data ?? []).map((client) => [
      client.id,
      {
        id: client.id,
        name: client.name,
        company: client.company,
        phone: client.phone,
        email: client.email,
        source: client.source,
        stage: client.stage as CrmStage,
        value: client.value == null ? null : Number(client.value),
      },
    ]),
  );

  return (chatsResult.data ?? []).map((chat) => ({
    remoteJid: chat.remote_jid,
    pushName: chat.push_name,
    profileName: chat.profile_name,
    profilePictureUrl: chat.profile_picture_url,
    profileStatus: chat.profile_status,
    lastMessageAt: chat.last_message_at,
    lastMessagePreview: chat.last_message_preview,
    unreadCount: chat.unread_count ?? 0,
    inboxNote: chat.inbox_note,
    client: chat.client_id ? (clientById.get(chat.client_id) ?? null) : null,
  }));
}

async function loadThreadByRemoteJid(remoteJid: string) {
  const supabase = await createClient();

  const { data: messages, error } = await supabase
    .from("crm_whatsapp_mensagens")
    .select(
      "id, remote_jid, client_id, from_me, conteudo, status, erro, created_at, provider_message_id, reactions",
    )
    .eq("remote_jid", remoteJid)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  await supabase
    .from("crm_whatsapp_chats")
    .update({ unread_count: 0 })
    .eq("remote_jid", remoteJid);

  return {
    remoteJid,
    messages: (messages ?? []).map((row) => mapMessage(row)),
  };
}

export async function getCrmWhatsappThread(clientId: string): Promise<{
  remoteJid: string | null;
  messages: CrmWhatsappMessage[];
}> {
  const { remoteJid } = await resolveRemoteJid(clientId);
  if (!remoteJid) return { remoteJid: null, messages: [] };
  return loadThreadByRemoteJid(remoteJid);
}

export async function getCrmWhatsappThreadByJid(remoteJid: string): Promise<{
  remoteJid: string;
  messages: CrmWhatsappMessage[];
}> {
  return loadThreadByRemoteJid(remoteJid);
}

async function matchProspectByPhone(
  digitsOrE164: string,
): Promise<CrmInboxProspect | null> {
  const supabase = await createClient();
  const normalized = normalizeBrPhone(digitsOrE164);
  if (!normalized.e164) return null;

  const { data: byE164 } = await supabase
    .from("prospects")
    .select("id, name, website, address, niche, city, status, rating, phone_e164, phone")
    .eq("phone_e164", normalized.e164)
    .limit(1)
    .maybeSingle();

  let match = byE164;

  if (!match) {
    const { data: candidates } = await supabase
      .from("prospects")
      .select("id, name, website, address, niche, city, status, rating, phone_e164, phone")
      .not("phone", "is", null)
      .limit(500);

    match =
      (candidates ?? []).find(
        (prospect) =>
          prospect.phone &&
          normalizeBrPhone(prospect.phone).e164 === normalized.e164,
      ) ?? null;
  }

  if (!match) return null;

  return {
    id: match.id,
    name: match.name,
    website: match.website,
    address: match.address,
    niche: match.niche,
    city: match.city,
    status: match.status,
    rating: match.rating,
  };
}

// Busca avatar/status na Evolution (com cache de 12h) e junta prospecção + notas.
export async function getCrmInboxChatContext(remoteJid: string): Promise<{
  chat: CrmInboxChat | null;
  prospect: CrmInboxProspect | null;
  notes: CrmNote[];
  lastOutboundStatus: CrmWhatsappMessage["status"] | null;
}> {
  const supabase = await createClient();

  const { data: chatRow } = await supabase
    .from("crm_whatsapp_chats")
    .select(
      "remote_jid, client_id, push_name, profile_name, profile_picture_url, profile_status, profile_fetched_at, last_message_at, last_message_preview, unread_count, inbox_note",
    )
    .eq("remote_jid", remoteJid)
    .maybeSingle();

  if (!chatRow) {
    return { chat: null, prospect: null, notes: [], lastOutboundStatus: null };
  }

  const fetchedAt = chatRow.profile_fetched_at
    ? new Date(chatRow.profile_fetched_at).getTime()
    : 0;
  const needsProfile =
    !chatRow.profile_picture_url || Date.now() - fetchedAt > PROFILE_TTL_MS;

  if (needsProfile) {
    try {
      const profile = await fetchWhatsAppProfile(remoteJid);
      if (profile) {
        await supabase
          .from("crm_whatsapp_chats")
          .update({
            profile_picture_url: profile.profilePictureUrl,
            profile_status: profile.status,
            profile_name: profile.name,
            push_name: profile.name ?? chatRow.push_name,
            profile_fetched_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("remote_jid", remoteJid);

        chatRow.profile_picture_url = profile.profilePictureUrl;
        chatRow.profile_status = profile.status;
        chatRow.profile_name = profile.name;
        if (profile.name) chatRow.push_name = profile.name;
      }
    } catch {
      // Avatar é best-effort — conversa continua sem ele.
    }
  }

  let client: CrmInboxChat["client"] = null;
  let notes: CrmNote[] = [];

  if (chatRow.client_id) {
    const [{ data: clientRow }, { data: noteRows }] = await Promise.all([
      supabase
        .from("crm_clients")
        .select("id, name, company, phone, email, source, stage, value")
        .eq("id", chatRow.client_id)
        .maybeSingle(),
      supabase
        .from("crm_notes")
        .select("*")
        .eq("client_id", chatRow.client_id)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    if (clientRow) {
      client = {
        id: clientRow.id,
        name: clientRow.name,
        company: clientRow.company,
        phone: clientRow.phone,
        email: clientRow.email,
        source: clientRow.source,
        stage: clientRow.stage as CrmStage,
        value: clientRow.value == null ? null : Number(clientRow.value),
      };
    }
    notes = (noteRows ?? []) as CrmNote[];
  }

  const prospect = await matchProspectByPhone(remoteJidToDigits(remoteJid));

  const { data: lastOutbound } = await supabase
    .from("crm_whatsapp_mensagens")
    .select("status")
    .eq("remote_jid", remoteJid)
    .eq("from_me", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    chat: {
      remoteJid: chatRow.remote_jid,
      pushName: chatRow.push_name,
      profileName: chatRow.profile_name,
      profilePictureUrl: chatRow.profile_picture_url,
      profileStatus: chatRow.profile_status,
      lastMessageAt: chatRow.last_message_at,
      lastMessagePreview: chatRow.last_message_preview,
      unreadCount: chatRow.unread_count ?? 0,
      inboxNote: chatRow.inbox_note,
      client,
    },
    prospect,
    notes,
    lastOutboundStatus:
      (lastOutbound?.status as CrmWhatsappMessage["status"] | undefined) ?? null,
  };
}

export async function updateCrmInboxNote(remoteJid: string, note: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_whatsapp_chats")
    .update({
      inbox_note: note.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("remote_jid", remoteJid);

  if (error) return { error: error.message };
  revalidatePath("/crm");
  return { success: true as const };
}

async function persistOutgoingMessage({
  supabase,
  remoteJid,
  clientId,
  text,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  remoteJid: string;
  clientId: string | null;
  text: string;
}): Promise<{ error: string } | { success: true; message: CrmWhatsappMessage }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  await supabase.from("crm_whatsapp_chats").upsert(
    {
      remote_jid: remoteJid,
      client_id: clientId,
      instance: process.env.EVOLUTION_INSTANCE ?? null,
    },
    { onConflict: "remote_jid" },
  );

  try {
    const { providerMessageId } = await sendWhatsAppText(remoteJid, text);

    const { data: inserted, error: insertError } = await supabase
      .from("crm_whatsapp_mensagens")
      .insert({
        remote_jid: remoteJid,
        client_id: clientId,
        from_me: true,
        conteudo: text,
        status: "server_ack",
        provider_message_id: providerMessageId,
        reactions: [],
      })
      .select(
        "id, remote_jid, client_id, from_me, conteudo, status, erro, created_at, provider_message_id, reactions",
      )
      .single();

    if (insertError) return { error: insertError.message };

    await supabase
      .from("crm_whatsapp_chats")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: text.slice(0, 140),
        updated_at: new Date().toISOString(),
      })
      .eq("remote_jid", remoteJid);

    return { success: true, message: mapMessage(inserted) };
  } catch (sendError) {
    const message =
      sendError instanceof Error ? sendError.message : String(sendError);

    await supabase.from("crm_whatsapp_mensagens").insert({
      remote_jid: remoteJid,
      client_id: clientId,
      from_me: true,
      conteudo: text,
      status: "error",
      erro: message.slice(0, 1000),
      reactions: [],
    });

    return { error: message };
  }
}

export async function sendCrmWhatsappMessage(clientId: string, text: string) {
  const trimmed = text.trim();
  if (!trimmed) return { error: "Escreva uma mensagem." };

  const { supabase, client, remoteJid } = await resolveRemoteJid(clientId);
  if (!client) return { error: "Cliente não encontrado." };
  if (!remoteJid) {
    return {
      error: "Este cliente não tem um telefone válido cadastrado.",
    };
  }

  const result = await persistOutgoingMessage({
    supabase,
    remoteJid,
    clientId: client.id,
    text: trimmed,
  });

  revalidatePath(`/crm/${clientId}`);
  revalidatePath("/crm");
  return result;
}

export async function sendCrmWhatsappChatMessage(
  remoteJid: string,
  text: string,
) {
  const trimmed = text.trim();
  if (!trimmed) return { error: "Escreva uma mensagem." };
  if (!remoteJid) return { error: "Conversa inválida." };

  const supabase = await createClient();
  const { data: chat } = await supabase
    .from("crm_whatsapp_chats")
    .select("client_id")
    .eq("remote_jid", remoteJid)
    .maybeSingle();

  const result = await persistOutgoingMessage({
    supabase,
    remoteJid,
    clientId: chat?.client_id ?? null,
    text: trimmed,
  });

  if (chat?.client_id) revalidatePath(`/crm/${chat.client_id}`);
  revalidatePath("/crm");
  return result;
}

const STATUS_FROM_EVOLUTION: Record<string, CrmWhatsappMessage["status"]> = {
  pending: "pending",
  server_ack: "server_ack",
  delivery_ack: "delivery_ack",
  read: "read",
  played: "played",
  error: "error",
  // Baileys às vezes manda número/string diferente
  "0": "pending",
  "1": "server_ack",
  "2": "delivery_ack",
  "3": "read",
  "4": "played",
};

function mapSyncedStatus(raw: string): CrmWhatsappMessage["status"] {
  return STATUS_FROM_EVOLUTION[raw.toLowerCase()] ?? "server_ack";
}

async function buildPhoneClientIndex(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const { data: clients } = await supabase
    .from("crm_clients")
    .select("id, phone")
    .not("phone", "is", null);

  const byE164 = new Map<string, string>();
  for (const client of clients ?? []) {
    if (!client.phone) continue;
    const e164 = normalizeBrPhone(client.phone).e164;
    if (e164) byE164.set(e164, client.id);
  }
  return byE164;
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
) {
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index++];
      await worker(current);
    }
  });
  await Promise.all(runners);
}

// Puxa todas as conversas individuais da Evolution (findChats) e o histórico
// recente de cada uma (findMessages), casando telefone com crm_clients.
export async function syncWhatsAppInbox() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  let chats;
  try {
    chats = await findWhatsAppChats();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: message };
  }

  const clientByPhone = await buildPhoneClientIndex(supabase);
  const instance = process.env.EVOLUTION_INSTANCE ?? null;
  let chatsUpserted = 0;
  let messagesUpserted = 0;
  let linkedClients = 0;
  const messageErrors: string[] = [];

  for (const chat of chats) {
    const digits = remoteJidToDigits(chat.remoteJid);
    const e164 = normalizeBrPhone(digits).e164;
    const clientId = e164 ? (clientByPhone.get(e164) ?? null) : null;
    if (clientId) linkedClients += 1;

    const { error } = await supabase.from("crm_whatsapp_chats").upsert(
      {
        remote_jid: chat.remoteJid,
        client_id: clientId,
        instance,
        push_name: chat.pushName,
        profile_picture_url: chat.profilePictureUrl,
        last_message_at: chat.lastMessageAt,
        last_message_preview: chat.lastMessagePreview,
        unread_count: chat.unreadCount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "remote_jid" },
    );

    if (!error) chatsUpserted += 1;
  }

  // Histórico recente por conversa — em paralelo limitado para não estourar timeout.
  await runWithConcurrency(chats, 4, async (chat) => {
    try {
      const messages = await findWhatsAppMessages(chat.remoteJid, 100);
      if (messages.length === 0) return;

      const digits = remoteJidToDigits(chat.remoteJid);
      const e164 = normalizeBrPhone(digits).e164;
      const clientId = e164 ? (clientByPhone.get(e164) ?? null) : null;

      const rows = messages.map((message) => ({
        remote_jid: message.remoteJid,
        client_id: clientId,
        from_me: message.fromMe,
        conteudo: message.content,
        status: mapSyncedStatus(message.status),
        provider_message_id: message.providerMessageId,
        created_at: message.createdAt,
        reactions: [],
      }));

      const { error, count } = await supabase
        .from("crm_whatsapp_mensagens")
        .upsert(rows, {
          onConflict: "provider_message_id",
          ignoreDuplicates: false,
          count: "exact",
        });

      if (error) {
        messageErrors.push(`${chat.remoteJid}: ${error.message}`);
        return;
      }

      messagesUpserted += count ?? rows.length;

      const last = messages[messages.length - 1];
      if (last) {
        await supabase
          .from("crm_whatsapp_chats")
          .update({
            last_message_at: last.createdAt,
            last_message_preview: (last.content ?? "").slice(0, 140),
            updated_at: new Date().toISOString(),
          })
          .eq("remote_jid", chat.remoteJid);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      messageErrors.push(`${chat.remoteJid}: ${message}`);
    }
  });

  revalidatePath("/crm");

  return {
    success: true as const,
    chatsFound: chats.length,
    chatsUpserted,
    messagesUpserted,
    linkedClients,
    messageErrors: messageErrors.slice(0, 5),
  };
}
