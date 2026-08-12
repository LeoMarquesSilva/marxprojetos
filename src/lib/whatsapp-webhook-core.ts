import type { SupabaseClient } from "@supabase/supabase-js";

export type WebhookPayload = {
  event?: string;
  instance?: string;
  data?: unknown;
};

export type WebhookMessageStatus =
  | "pending"
  | "server_ack"
  | "delivery_ack"
  | "read"
  | "played"
  | "error";

export type WebhookMessageIngestArgs = {
  p_remote_jid: string;
  p_client_id: string | null;
  p_from_me: boolean;
  p_conteudo: string;
  p_status: WebhookMessageStatus;
  p_provider_message_id: string;
  p_raw: unknown;
  p_instance: string | null;
  p_push_name: string | null;
  p_lid_jid: string | null;
  p_message_at: string;
};

type WebhookMessageIngestRow = {
  message_id: string;
  inserted: boolean;
  unread_incremented: boolean;
};

const STATUS_RANK: Record<Exclude<WebhookMessageStatus, "error">, number> = {
  pending: 0,
  server_ack: 1,
  delivery_ack: 2,
  read: 3,
  played: 4,
};

export function advanceWebhookMessageStatus(
  current: WebhookMessageStatus,
  incoming: WebhookMessageStatus,
): WebhookMessageStatus {
  if (incoming === "error") {
    return current === "pending" || current === "error" ? "error" : current;
  }
  if (current === "error") return incoming;
  return STATUS_RANK[incoming] > STATUS_RANK[current] ? incoming : current;
}

export async function ingestWebhookMessageTransactionally(
  supabase: Pick<SupabaseClient, "rpc">,
  args: WebhookMessageIngestArgs,
): Promise<{
  messageId: string;
  inserted: boolean;
  unreadIncremented: boolean;
}> {
  const result = await supabase.rpc("ingest_crm_whatsapp_message", args);
  requireSupabaseSuccess(result, "message.ingest_rpc");

  const row = (
    Array.isArray(result.data) ? result.data[0] : result.data
  ) as WebhookMessageIngestRow | null;
  if (
    !row ||
    typeof row.message_id !== "string" ||
    typeof row.inserted !== "boolean" ||
    typeof row.unread_incremented !== "boolean"
  ) {
    throw new Error("webhook_database_failure:message.ingest_rpc_result");
  }

  return {
    messageId: row.message_id,
    inserted: row.inserted,
    unreadIncremented: row.unread_incremented,
  };
}

export function shouldIncrementUnread({
  fromMe,
  providerMessageId,
  isNew,
}: {
  fromMe: boolean;
  providerMessageId: string | null | undefined;
  isNew: boolean;
}): boolean {
  if (fromMe) return false;
  return providerMessageId ? isNew : true;
}

export function resolveClientId(
  matchedClientId: string | null,
  existingClientId: string | null | undefined,
): string | null {
  return matchedClientId ?? existingClientId ?? null;
}

export function parseWebhookPayload(
  rawBody: string,
): { ok: true; value: WebhookPayload } | { ok: false } {
  try {
    const value: unknown = JSON.parse(rawBody);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false };
    }
    return { ok: true, value: value as WebhookPayload };
  } catch {
    return { ok: false };
  }
}

export function requireSupabaseSuccess<T extends { error: unknown }>(
  result: T,
  operation: string,
): T {
  if (result.error) {
    throw new Error(`webhook_database_failure:${operation}`);
  }
  return result;
}

