import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGroupJid, normalizeBrPhone, remoteJidToDigits } from "@/lib/phone";

// Endpoint chamado pela Evolution API a cada evento (mensagem enviada,
// recebida, atualização de status). Não tem sessão de usuário — usa o
// client service-role, então a autorização é só o secret na query string.

type EvolutionMessagePayload = {
  key?: { id?: string; remoteJid?: string; fromMe?: boolean };
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
};

const STATUS_MAP: Record<string, string> = {
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

function extractText(message: EvolutionMessagePayload["message"]): string | null {
  if (!message) return null;
  if (message.reactionMessage) return null;
  return message.conversation ?? message.extendedTextMessage?.text ?? null;
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
  const providedSecret = request.nextUrl.searchParams.get("secret");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    event?: string;
    instance?: string;
    data?: unknown;
  } | null;

  if (!body) return NextResponse.json({ ok: true });

  const supabase = createAdminClient();
  const event = normalizeEvent(body.event);

  if (
    event === "messages.upsert" ||
    event === "send.message" ||
    event === "messages.set"
  ) {
    for (const item of toMessageList(body.data)) {
      const remoteJid = item.key?.remoteJid;
      if (!remoteJid || isGroupJid(remoteJid)) continue;

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

      const fromMe = Boolean(item.key?.fromMe);
      const text = extractText(item.message) ?? "[mensagem sem texto]";
      const digits = remoteJidToDigits(remoteJid);
      const normalized = normalizeBrPhone(digits);

      const clientId = normalized.e164
        ? await matchClientByPhone(supabase, normalized.e164)
        : null;

      const { data: existingChat } = await supabase
        .from("crm_whatsapp_chats")
        .select("unread_count, push_name")
        .eq("remote_jid", remoteJid)
        .maybeSingle();

      await supabase.from("crm_whatsapp_chats").upsert(
        {
          remote_jid: remoteJid,
          client_id: clientId,
          instance: body.instance ?? null,
          push_name: item.pushName ?? existingChat?.push_name ?? null,
          last_message_at: new Date().toISOString(),
          last_message_preview: text.slice(0, 140),
          unread_count: fromMe ? 0 : (existingChat?.unread_count ?? 0) + 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "remote_jid" },
      );

      if (item.key?.id) {
        await supabase.from("crm_whatsapp_mensagens").upsert(
          {
            remote_jid: remoteJid,
            client_id: clientId,
            from_me: fromMe,
            conteudo: text,
            status: fromMe ? "server_ack" : "delivery_ack",
            provider_message_id: item.key.id,
          },
          { onConflict: "provider_message_id" },
        );
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
        await supabase
          .from("crm_whatsapp_mensagens")
          .update({ status })
          .eq("provider_message_id", providerMessageId);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

async function applyReaction(
  supabase: SupabaseClient,
  {
    targetProviderId,
    emoji,
    fromMe,
  }: { targetProviderId: string; emoji: string; fromMe: boolean },
) {
  const { data: message } = await supabase
    .from("crm_whatsapp_mensagens")
    .select("id, reactions")
    .eq("provider_message_id", targetProviderId)
    .maybeSingle();

  if (!message) return;

  const current = (message.reactions as { emoji: string; fromMe: boolean }[]) ?? [];

  // Texto vazio = remove reação (padrão WhatsApp).
  const next = emoji
    ? [
        ...current.filter((reaction) => reaction.fromMe !== fromMe),
        { emoji, fromMe },
      ]
    : current.filter((reaction) => reaction.fromMe !== fromMe);

  await supabase
    .from("crm_whatsapp_mensagens")
    .update({ reactions: next })
    .eq("id", message.id);
}

async function matchClientByPhone(
  supabase: SupabaseClient,
  inboundE164: string,
): Promise<string | null> {
  const { data: clients } = await supabase
    .from("crm_clients")
    .select("id, phone")
    .not("phone", "is", null);

  for (const client of (clients ?? []) as { id: string; phone: string }[]) {
    if (normalizeBrPhone(client.phone).e164 === inboundE164) return client.id;
  }

  return null;
}
