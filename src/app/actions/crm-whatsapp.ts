"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendWhatsAppText } from "@/lib/evolution";
import { normalizeBrPhone, phoneToRemoteJid } from "@/lib/phone";
import type { CrmWhatsappMessage } from "@/types/crm";

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

export async function getCrmWhatsappThread(clientId: string): Promise<{
  remoteJid: string | null;
  messages: CrmWhatsappMessage[];
}> {
  const { supabase, remoteJid } = await resolveRemoteJid(clientId);
  if (!remoteJid) return { remoteJid: null, messages: [] };

  const { data: messages, error } = await supabase
    .from("crm_whatsapp_mensagens")
    .select("id, remote_jid, client_id, from_me, conteudo, status, erro, created_at")
    .eq("remote_jid", remoteJid)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  // Abrir a conversa marca como lida — mesma expectativa de qualquer app de
  // mensagens. Não bloqueia a resposta se falhar (não é crítico).
  await supabase
    .from("crm_whatsapp_chats")
    .update({ unread_count: 0 })
    .eq("remote_jid", remoteJid);

  return { remoteJid, messages: (messages ?? []) as CrmWhatsappMessage[] };
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  // Garante a conversa antes da mensagem (a mensagem referencia o chat).
  await supabase
    .from("crm_whatsapp_chats")
    .upsert(
      {
        remote_jid: remoteJid,
        client_id: client.id,
        instance: process.env.EVOLUTION_INSTANCE ?? null,
      },
      { onConflict: "remote_jid" },
    );

  try {
    const { providerMessageId } = await sendWhatsAppText(remoteJid, trimmed);

    const { error: insertError } = await supabase
      .from("crm_whatsapp_mensagens")
      .insert({
        remote_jid: remoteJid,
        client_id: client.id,
        from_me: true,
        conteudo: trimmed,
        status: "server_ack",
        provider_message_id: providerMessageId,
      });
    if (insertError) return { error: insertError.message };

    await supabase
      .from("crm_whatsapp_chats")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: trimmed.slice(0, 140),
        updated_at: new Date().toISOString(),
      })
      .eq("remote_jid", remoteJid);
  } catch (sendError) {
    const message =
      sendError instanceof Error ? sendError.message : String(sendError);

    // Registra a falha na própria conversa: o vendedor vê ali mesmo que a
    // mensagem não saiu, sem precisar olhar log de servidor.
    await supabase.from("crm_whatsapp_mensagens").insert({
      remote_jid: remoteJid,
      client_id: client.id,
      from_me: true,
      conteudo: trimmed,
      status: "error",
      erro: message.slice(0, 1000),
    });

    revalidatePath(`/crm/${clientId}`);
    return { error: message };
  }

  revalidatePath(`/crm/${clientId}`);
  return { success: true };
}
