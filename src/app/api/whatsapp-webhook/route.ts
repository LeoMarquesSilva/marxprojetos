import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGroupJid, normalizeBrPhone, remoteJidToDigits } from "@/lib/phone";
import { extractWhatsAppText } from "@/lib/whatsapp-message";

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
  const raw = key.remoteJid;
  if (!raw) return null;

  if (!isLidJid(raw)) return { remoteJid: raw, lidJid: null };

  // Caminho feliz: a Evolution manda o telefone junto no próprio evento.
  const alt = key.remoteJidAlt;
  if (alt && !isLidJid(alt)) {
    return { remoteJid: alt, lidJid: raw };
  }

  // Sem remoteJidAlt: se já fundimos esse LID antes, reaproveita o vínculo.
  const { data: known } = await supabase
    .from("crm_whatsapp_chats")
    .select("remote_jid")
    .eq("lid_jid", raw)
    .maybeSingle();

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

      const { data: existingChat } = await supabase
        .from("crm_whatsapp_chats")
        .select("unread_count, push_name, origem")
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
          // Conversa vinculada a um cliente nasceu de prospecção; as demais
          // são contatos que já existiam no celular.
          origem: existingChat?.origem ?? (clientId ? "prospeccao" : "pessoal"),
          ...(lidJid ? { lid_jid: lidJid } : {}),
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
            raw: item,
          },
          { onConflict: "provider_message_id" },
        );
      }

      // Resposta do lead move o funil sozinho — sem depender de arrastar card.
      if (!fromMe && clientId) {
        await promoteStageOnReply(supabase, clientId);
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

// Só avança de "enviado" para "respondeu". Quem já está mais adiante no
// funil (em conversa, proposta, fechado) não pode retroceder porque o lead
// mandou mais uma mensagem.
async function promoteStageOnReply(supabase: SupabaseClient, clientId: string) {
  await supabase
    .from("crm_clients")
    .update({ stage: "respondeu", updated_at: new Date().toISOString() })
    .eq("id", clientId)
    .eq("stage", "enviado");
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
