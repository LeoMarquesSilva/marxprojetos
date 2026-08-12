import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveEvolutionMessageJid } from "@/lib/evolution-payload";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGroupJid, normalizeBrPhone, remoteJidToDigits } from "@/lib/phone";
import { extractWhatsAppText } from "@/lib/whatsapp-message";
import {
  ingestWebhookMessageTransactionally,
  parseWebhookPayload,
  requireSupabaseSuccess,
  resolveClientId,
  shouldIncrementUnread,
  type WebhookMessageStatus,
} from "@/lib/whatsapp-webhook-core";

// Endpoint chamado pela Evolution API a cada evento (mensagem enviada,
// recebida, atualização de status). Não tem sessão de usuário — usa o
// client service-role, então a autorização é só o secret na query string.

type EvolutionMessagePayload = {
  key?: {
    id?: string;
    remoteJid?: string;
    fromMe?: boolean;
    // O WhatsApp migrou para endereçamento "LID": quando o contato responde,
    // remoteJid vem como um identificador opaco (ex: 226280452669555@lid) em
    // vez do telefone. Nesse caso o telefone real vem em remoteJidAlt — sem
    // ler esse campo, a resposta cai numa conversa órfã e o CRM nunca fica
    // sabendo que o lead respondeu.
    remoteJidAlt?: string;
    senderPn?: string;
    addressingMode?: string;
  };
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    reactionMessage?: {
      key?: { id?: string; remoteJid?: string; fromMe?: boolean };
      text?: string;
    };
  };
  status?: string;
  keyId?: string;
  messageTimestamp?: number | string;
};

type EvolutionChatPayload = {
  id?: string;
  remoteJid?: string;
  pushName?: string;
  profilePicUrl?: string;
  profilePictureUrl?: string;
  unreadCount?: number | string;
  updatedAt?: string;
  lastMsgTimestamp?: number | string;
  lastMessage?: EvolutionMessagePayload;
};

const STATUS_MAP: Record<string, WebhookMessageStatus> = {
  PENDING: "pending",
  SERVER_ACK: "server_ack",
  DELIVERY_ACK: "delivery_ack",
  READ: "read",
  PLAYED: "played",
};

// Evolution manda às vezes "MESSAGES_UPSERT", às vezes "messages.upsert".
function normalizeEvent(event?: string): string {
  return (event ?? "").toLowerCase().replace(/_/g, ".");
}

function toMessageList(data: unknown): EvolutionMessagePayload[] {
  if (Array.isArray(data)) return data as EvolutionMessagePayload[];
  if (data && typeof data === "object") {
    const withMessages = data as { messages?: unknown };
    if (Array.isArray(withMessages.messages)) {
      return withMessages.messages as EvolutionMessagePayload[];
    }
    return [data as EvolutionMessagePayload];
  }
  return [];
}

function toChatList(data: unknown): EvolutionChatPayload[] {
  if (Array.isArray(data)) return data as EvolutionChatPayload[];
  if (data && typeof data === "object") {
    const record = data as { chats?: unknown; data?: unknown };
    if (Array.isArray(record.chats)) {
      return record.chats as EvolutionChatPayload[];
    }
    if (Array.isArray(record.data)) {
      return record.data as EvolutionChatPayload[];
    }
    return [data as EvolutionChatPayload];
  }
  return [];
}

function timestampToIso(value: unknown): string | null {
  if (value == null) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return new Date(numeric < 1e12 ? numeric * 1000 : numeric).toISOString();
  }
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function extractText(message: EvolutionMessagePayload["message"]): string | null {
  return extractWhatsAppText(message);
}

function isLidJid(jid: string): boolean {
  return jid.endsWith("@lid");
}

// Resolve a conversa para o JID de telefone sempre que possível, para que a
// mensagem enviada e a resposta do lead caiam na MESMA thread.
async function resolveChatJid(
  supabase: SupabaseClient,
  key: NonNullable<EvolutionMessagePayload["key"]>,
): Promise<{ remoteJid: string; lidJid: string | null } | null> {
  const resolved = resolveEvolutionMessageJid(key);
  if (!resolved) return null;
  if (!isLidJid(resolved.remoteJid)) return resolved;
  const raw = resolved.remoteJid;

  // Sem remoteJidAlt: se já fundimos esse LID antes, reaproveita o vínculo.
  const knownResult = await supabase
    .from("crm_whatsapp_chats")
    .select("remote_jid")
    .eq("lid_jid", raw)
    .maybeSingle();
  requireSupabaseSuccess(knownResult, "chat.resolve_lid");
  const { data: known } = knownResult;

  if (known?.remote_jid) return { remoteJid: known.remote_jid, lidJid: raw };

  // Último caso: mantém o LID para não perder a mensagem.
  return { remoteJid: raw, lidJid: raw };
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
  const providedSecret = request.nextUrl.searchParams.get("secret");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rawBody = await request.text().catch(() => null);
  if (rawBody === null) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsedBody = parseWebhookPayload(rawBody);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const body = parsedBody.value;

  try {
    const supabase = createAdminClient();
    const event = normalizeEvent(body.event);

  if (
    event === "chats.set" ||
    event === "chats.upsert" ||
    event === "chats.update"
  ) {
    for (const item of toChatList(body.data)) {
      const rawRemoteJid =
        item.remoteJid ??
        (item.id?.includes("@") ? item.id : undefined) ??
        item.lastMessage?.key?.remoteJid;
      if (!rawRemoteJid || isGroupJid(rawRemoteJid)) continue;

      const resolved = await resolveChatJid(supabase, {
        remoteJid: rawRemoteJid,
        remoteJidAlt: item.lastMessage?.key?.remoteJidAlt,
        senderPn: item.lastMessage?.key?.senderPn,
      });
      if (!resolved) continue;
      const { remoteJid, lidJid } = resolved;
      if (isGroupJid(remoteJid) || remoteJid.endsWith("@broadcast")) continue;

      const normalized = normalizeBrPhone(remoteJidToDigits(remoteJid));
      const clientId = normalized.e164
        ? await matchClientByPhone(supabase, normalized.e164)
        : null;
      const existingChatResult = await supabase
        .from("crm_whatsapp_chats")
        .select(
          "client_id, push_name, profile_picture_url, unread_count, last_message_at, last_message_preview, origem",
        )
        .eq("remote_jid", remoteJid)
        .maybeSingle();
      requireSupabaseSuccess(existingChatResult, "chat.lookup");
      const { data: existingChat } = existingChatResult;

      const lastText = extractText(item.lastMessage?.message);
      const lastMessageAt =
        timestampToIso(item.lastMessage?.messageTimestamp) ??
        timestampToIso(item.lastMsgTimestamp) ??
        timestampToIso(item.updatedAt) ??
        existingChat?.last_message_at ??
        null;

      const chatUpsertResult = await supabase.from("crm_whatsapp_chats").upsert(
        {
          remote_jid: remoteJid,
          client_id: clientId ?? existingChat?.client_id ?? null,
          instance: body.instance ?? null,
          push_name: item.pushName || existingChat?.push_name || null,
          profile_picture_url:
            item.profilePicUrl ||
            item.profilePictureUrl ||
            existingChat?.profile_picture_url ||
            null,
          last_message_at: lastMessageAt,
          last_message_preview:
            lastText?.slice(0, 140) ??
            existingChat?.last_message_preview ??
            null,
          unread_count:
            typeof item.unreadCount === "number"
              ? item.unreadCount
              : typeof item.unreadCount === "string"
                ? Number(item.unreadCount) || 0
                : existingChat?.unread_count ?? 0,
          origem:
            existingChat?.origem ??
            (clientId ?? existingChat?.client_id ? "prospeccao" : "pessoal"),
          ...(lidJid ? { lid_jid: lidJid } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "remote_jid" },
      );
      requireSupabaseSuccess(chatUpsertResult, "chat.upsert");
    }
  }

  if (
    event === "messages.upsert" ||
    event === "send.message" ||
    event === "messages.set"
  ) {
    for (const item of toMessageList(body.data)) {
      if (!item.key?.remoteJid || isGroupJid(item.key.remoteJid)) continue;

      // Reação: atualiza a mensagem alvo em vez de criar bolha nova.
      const reaction = item.message?.reactionMessage;
      if (reaction?.key?.id) {
        await applyReaction(supabase, {
          targetProviderId: reaction.key.id,
          emoji: reaction.text ?? "",
          fromMe: Boolean(item.key?.fromMe),
        });
        continue;
      }

      const resolved = await resolveChatJid(supabase, item.key);
      if (!resolved) continue;
      const { remoteJid, lidJid } = resolved;

      const fromMe = Boolean(item.key?.fromMe);
      const text = extractText(item.message) ?? "[mensagem sem texto]";
      const normalized = normalizeBrPhone(remoteJidToDigits(remoteJid));

      const clientId = normalized.e164
        ? await matchClientByPhone(supabase, normalized.e164)
        : null;

      const existingChatResult = await supabase
        .from("crm_whatsapp_chats")
        .select("client_id, unread_count, push_name, origem")
        .eq("remote_jid", remoteJid)
        .maybeSingle();
      requireSupabaseSuccess(existingChatResult, "message.chat_lookup");
      const { data: existingChat } = existingChatResult;
      const effectiveClientId = resolveClientId(
        clientId,
        existingChat?.client_id,
      );

      const providerMessageId = item.key?.id ?? null;

      if (providerMessageId) {
        await ingestWebhookMessageTransactionally(supabase, {
          p_remote_jid: remoteJid,
          p_client_id: clientId,
          p_from_me: fromMe,
          p_conteudo: text,
          p_status: fromMe ? "server_ack" : "delivery_ack",
          p_provider_message_id: providerMessageId,
          p_raw: item,
          p_instance: body.instance ?? null,
          p_push_name: item.pushName ?? null,
          p_lid_jid: lidJid,
          p_message_at:
            timestampToIso(item.messageTimestamp) ?? new Date().toISOString(),
        });
      } else {
        // Eventos legados sem id do provider não permitem deduplicação
        // confiável; mantém o incremento conservador anterior.
        const chatUpsertResult = await supabase
          .from("crm_whatsapp_chats")
          .upsert(
            {
              remote_jid: remoteJid,
              client_id: effectiveClientId,
              instance: body.instance ?? null,
              push_name: item.pushName ?? existingChat?.push_name ?? null,
              origem:
                existingChat?.origem ??
                (effectiveClientId ? "prospeccao" : "pessoal"),
              ...(lidJid ? { lid_jid: lidJid } : {}),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "remote_jid" },
          );
        requireSupabaseSuccess(chatUpsertResult, "message.chat_upsert");

        const incrementUnread = shouldIncrementUnread({
          fromMe,
          providerMessageId,
          isNew: false,
        });
        const chatUpdateResult = await supabase
          .from("crm_whatsapp_chats")
          .update({
            last_message_at: new Date().toISOString(),
            last_message_preview: text.slice(0, 140),
            ...(fromMe
              ? { unread_count: 0 }
              : incrementUnread
                ? { unread_count: (existingChat?.unread_count ?? 0) + 1 }
                : {}),
            updated_at: new Date().toISOString(),
          })
          .eq("remote_jid", remoteJid);
        requireSupabaseSuccess(chatUpdateResult, "message.chat_update");
      }

      // Resposta do lead move o funil sozinho — sem depender de arrastar card.
      if (!fromMe && effectiveClientId) {
        await promoteStageOnReply(supabase, effectiveClientId);
      }
    }
  }

  if (event === "messages.update") {
    for (const item of toMessageList(body.data)) {
      const providerMessageId = item.key?.id ?? item.keyId;
      const rawStatus = item.status?.toUpperCase?.() ?? item.status;
      const status =
        typeof rawStatus === "string" ? STATUS_MAP[rawStatus] : undefined;
      if (providerMessageId && status) {
        const statusUpdateResult = await supabase
          .from("crm_whatsapp_mensagens")
          .update({ status })
          .eq("provider_message_id", providerMessageId);
        requireSupabaseSuccess(statusUpdateResult, "status.update");
      }
    }
  }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "temporarily_unavailable" },
      { status: 503 },
    );
  }
}

async function applyReaction(
  supabase: SupabaseClient,
  {
    targetProviderId,
    emoji,
    fromMe,
  }: { targetProviderId: string; emoji: string; fromMe: boolean },
) {
  const messageResult = await supabase
    .from("crm_whatsapp_mensagens")
    .select("id, reactions")
    .eq("provider_message_id", targetProviderId)
    .maybeSingle();
  requireSupabaseSuccess(messageResult, "reaction.lookup");
  const { data: message } = messageResult;

  if (!message) return;

  const current = (message.reactions as { emoji: string; fromMe: boolean }[]) ?? [];

  // Texto vazio = remove reação (padrão WhatsApp).
  const next = emoji
    ? [
        ...current.filter((reaction) => reaction.fromMe !== fromMe),
        { emoji, fromMe },
      ]
    : current.filter((reaction) => reaction.fromMe !== fromMe);

  const reactionUpdateResult = await supabase
    .from("crm_whatsapp_mensagens")
    .update({ reactions: next })
    .eq("id", message.id);
  requireSupabaseSuccess(reactionUpdateResult, "reaction.update");
}

// Só avança de "enviado" para "respondeu". Quem já está mais adiante no
// funil (em conversa, proposta, fechado) não pode retroceder porque o lead
// mandou mais uma mensagem.
async function promoteStageOnReply(supabase: SupabaseClient, clientId: string) {
  const promotionResult = await supabase
    .from("crm_clients")
    .update({ stage: "respondeu", updated_at: new Date().toISOString() })
    .eq("id", clientId)
    .eq("stage", "enviado");
  requireSupabaseSuccess(promotionResult, "promotion.update");
}

async function matchClientByPhone(
  supabase: SupabaseClient,
  inboundE164: string,
): Promise<string | null> {
  const clientsResult = await supabase
    .from("crm_clients")
    .select("id, phone")
    .not("phone", "is", null);
  requireSupabaseSuccess(clientsResult, "client.match");
  const { data: clients } = clientsResult;

  for (const client of (clients ?? []) as { id: string; phone: string }[]) {
    if (normalizeBrPhone(client.phone).e164 === inboundE164) return client.id;
  }

  return null;
}
