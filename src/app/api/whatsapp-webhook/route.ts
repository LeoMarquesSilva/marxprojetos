import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGroupJid, normalizeBrPhone, remoteJidToDigits } from "@/lib/phone";

// Endpoint chamado pela Evolution API a cada evento (mensagem enviada,
// recebida, atualização de status). Não tem sessão de usuário — usa o
// client service-role, então a autorização é só o secret na query string.
// Diferente do webhook de financeiro-bp, não existe segredo de fallback
// embutido no código: se WHATSAPP_WEBHOOK_SECRET não estiver configurado,
// o endpoint recusa tudo, em vez de aceitar um valor conhecido.

type EvolutionMessagePayload = {
  key?: { id?: string; remoteJid?: string; fromMe?: boolean };
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
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

// O corpo do webhook varia conforme a versão da Evolution: às vezes "data"
// é um objeto único, às vezes uma lista, às vezes { messages: [...] }.
// Normalizamos tudo para uma lista antes de processar.
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

  if (body.event === "messages.upsert" || body.event === "send.message") {
    for (const item of toMessageList(body.data)) {
      const remoteJid = item.key?.remoteJid;
      // Grupos ficam fora do v1: o vínculo por telefone com crm_clients só
      // faz sentido para conversas individuais.
      if (!remoteJid || isGroupJid(remoteJid)) continue;

      const fromMe = Boolean(item.key?.fromMe);
      const text = extractText(item.message) ?? "[mensagem sem texto]";
      const digits = remoteJidToDigits(remoteJid);
      const normalized = normalizeBrPhone(digits);

      const clientId = normalized.e164
        ? await matchClientByPhone(supabase, normalized.e164)
        : null;

      const { data: existingChat } = await supabase
        .from("crm_whatsapp_chats")
        .select("unread_count")
        .eq("remote_jid", remoteJid)
        .maybeSingle();

      await supabase.from("crm_whatsapp_chats").upsert(
        {
          remote_jid: remoteJid,
          client_id: clientId,
          instance: body.instance ?? null,
          push_name: item.pushName ?? null,
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
            status: "server_ack",
            provider_message_id: item.key.id,
          },
          { onConflict: "provider_message_id" },
        );
      }
    }
  }

  if (body.event === "messages.update") {
    for (const item of toMessageList(body.data)) {
      const providerMessageId = item.key?.id ?? item.keyId;
      const status = item.status ? STATUS_MAP[item.status] : undefined;
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

// Telefones no CRM vêm de importação de planilha e ficam com formatação
// variada ("(19) 99717-1414", "551997171-4124" etc.). Comparar substring
// direto contra o texto salvo falha sempre que há traço/espaço/parênteses
// no meio dos dígitos que a gente busca — por isso normalizamos os dois
// lados com a mesma função usada no resto do app antes de comparar.
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
