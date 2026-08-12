import assert from "node:assert/strict";
import test from "node:test";

import * as webhookCore from "../src/lib/whatsapp-webhook-core.ts";

const {
  parseWebhookPayload,
  requireSupabaseSuccess,
  resolveClientId,
  shouldIncrementUnread,
} = webhookCore;

const ingestArgs = {
  p_remote_jid: "5511999999999@s.whatsapp.net",
  p_client_id: null,
  p_from_me: false,
  p_conteudo: "Olá",
  p_status: "delivery_ack",
  p_provider_message_id: "provider-123",
  p_raw: { key: { id: "provider-123" } },
  p_instance: "principal",
  p_push_name: "Contato",
  p_lid_jid: null,
  p_message_at: "2026-08-11T20:00:00.000Z",
};

function createTransactionalRpc({ failAfterMessageOnce = false } = {}) {
  let state = { message: null, unreadCount: 0 };
  let queue = Promise.resolve();

  const rpc = (functionName, args) => {
    const execute = async () => {
      assert.equal(functionName, "ingest_crm_whatsapp_message");
      const snapshot = structuredClone(state);

      try {
        const inserted = state.message === null;
        state.message = {
          providerMessageId: args.p_provider_message_id,
          content: args.p_conteudo,
          unreadCounted: state.message?.unreadCounted ?? false,
        };

        const unreadIncremented =
          !args.p_from_me && state.message.unreadCounted === false;
        if (unreadIncremented) state.message.unreadCounted = true;

        if (failAfterMessageOnce) {
          failAfterMessageOnce = false;
          throw new Error("falha após mensagem, antes do contador");
        }

        if (unreadIncremented) state.unreadCount += 1;
        return {
          data: [
            {
              message_id: "message-1",
              inserted,
              unread_incremented: unreadIncremented,
            },
          ],
          error: null,
        };
      } catch (error) {
        state = snapshot;
        return { data: null, error };
      }
    };

    const pending = queue.then(execute, execute);
    queue = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  };

  return {
    client: { rpc },
    getState: () => structuredClone(state),
  };
}

test("mantém o client_id existente quando o matching por telefone falha", () => {
  assert.equal(resolveClientId(null, "client-existing"), "client-existing");
});

test("prefere o client_id encontrado pelo telefone ao vínculo antigo", () => {
  assert.equal(resolveClientId("client-matched", "client-existing"), "client-matched");
});

test("rejeita JSON malformado sem expor o conteúdo recebido", () => {
  assert.deepEqual(parseWebhookPayload('{"event":'), { ok: false });
});

test("aceita um payload JSON de webhook em formato de objeto", () => {
  assert.deepEqual(
    parseWebhookPayload('{"event":"messages.upsert","data":[]}'),
    {
      ok: true,
      value: { event: "messages.upsert", data: [] },
    },
  );
});

test("converte erro crítico do Supabase em código operacional sem detalhes", () => {
  assert.throws(
    () =>
      requireSupabaseSuccess(
        { data: null, error: { message: "telefone +5511999999999" } },
        "message.upsert",
      ),
    (error) =>
      error instanceof Error &&
      error.message === "webhook_database_failure:message.upsert" &&
      !error.message.includes("5511999999999"),
  );
});

test("retry após rollback entre mensagem e contador incrementa unread uma vez", async () => {
  assert.equal(
    typeof webhookCore.ingestWebhookMessageTransactionally,
    "function",
  );
  const database = createTransactionalRpc({ failAfterMessageOnce: true });

  await assert.rejects(
    webhookCore.ingestWebhookMessageTransactionally(database.client, ingestArgs),
    /webhook_database_failure:message.ingest_rpc/,
  );
  const result = await webhookCore.ingestWebhookMessageTransactionally(
    database.client,
    { ...ingestArgs, p_conteudo: "conteúdo atualizado no retry" },
  );

  assert.deepEqual(result, {
    messageId: "message-1",
    inserted: true,
    unreadIncremented: true,
  });
  assert.deepEqual(database.getState(), {
    message: {
      providerMessageId: "provider-123",
      content: "conteúdo atualizado no retry",
      unreadCounted: true,
    },
    unreadCount: 1,
  });
});

test("duas ingestões concorrentes do mesmo provider reivindicam unread uma vez", async () => {
  assert.equal(
    typeof webhookCore.ingestWebhookMessageTransactionally,
    "function",
  );
  const database = createTransactionalRpc();

  const results = await Promise.all([
    webhookCore.ingestWebhookMessageTransactionally(database.client, ingestArgs),
    webhookCore.ingestWebhookMessageTransactionally(database.client, ingestArgs),
  ]);

  assert.equal(results.filter((result) => result.inserted).length, 1);
  assert.equal(
    results.filter((result) => result.unreadIncremented).length,
    1,
  );
  assert.equal(database.getState().unreadCount, 1);
});

test("status confirmado avança monotonicamente e nunca recebe error", () => {
  assert.equal(typeof webhookCore.advanceWebhookMessageStatus, "function");

  assert.equal(
    webhookCore.advanceWebhookMessageStatus("read", "delivery_ack"),
    "read",
  );
  assert.equal(
    webhookCore.advanceWebhookMessageStatus("delivery_ack", "server_ack"),
    "delivery_ack",
  );
  assert.equal(
    webhookCore.advanceWebhookMessageStatus("server_ack", "error"),
    "server_ack",
  );
  assert.equal(
    webhookCore.advanceWebhookMessageStatus("pending", "error"),
    "error",
  );
  assert.equal(
    webhookCore.advanceWebhookMessageStatus("error", "delivery_ack"),
    "delivery_ack",
  );
});

test("sem provider id mantém incremento conservador para mensagem recebida", () => {
  assert.equal(
    shouldIncrementUnread({
      fromMe: false,
      providerMessageId: null,
      isNew: false,
    }),
    true,
  );
});

