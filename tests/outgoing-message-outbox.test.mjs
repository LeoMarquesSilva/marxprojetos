import assert from "node:assert/strict";
import test from "node:test";

import {
  chooseFinalOutgoingStatus,
  chooseMostAdvancedOutgoingStatus,
  finalizeOutgoingMessageIdempotently,
  reconcilePendingOutgoingMessages,
  runOutgoingMessageOutbox,
} from "../src/lib/outgoing-message-outbox.ts";

const pendingMessage = {
  id: "outbox-1",
  status: "pending",
  provider_message_id: null,
};

test("persiste pending antes de enviar e finaliza a mesma mensagem", async () => {
  const events = [];

  const result = await runOutgoingMessageOutbox({
    createPending: async () => {
      events.push("persist:outbox-1");
      return pendingMessage;
    },
    send: async () => {
      events.push("send");
      return { providerMessageId: "provider-123" };
    },
    markSent: async (id, providerMessageId) => {
      events.push(`sent:${id}:${providerMessageId}`);
      return {
        ...pendingMessage,
        status: "server_ack",
        provider_message_id: providerMessageId,
      };
    },
    markError: async () => {
      throw new Error("não deveria marcar erro");
    },
  });

  assert.deepEqual(events, [
    "persist:outbox-1",
    "send",
    "sent:outbox-1:provider-123",
  ]);
  assert.deepEqual(result, {
    success: true,
    message: {
      id: "outbox-1",
      status: "server_ack",
      provider_message_id: "provider-123",
    },
  });
});

test("não envia quando a persistência pending falha", async () => {
  let sends = 0;

  await assert.rejects(
    runOutgoingMessageOutbox({
      createPending: async () => {
        throw new Error("database unavailable");
      },
      send: async () => {
        sends += 1;
        return { providerMessageId: "provider-123" };
      },
      markSent: async () => pendingMessage,
      markError: async () => pendingMessage,
    }),
    /database unavailable/,
  );
  assert.equal(sends, 0);
});

test("marca a mensagem pending como error quando a Evolution falha", async () => {
  const markedIds = [];

  const result = await runOutgoingMessageOutbox({
    createPending: async () => pendingMessage,
    send: async () => {
      throw new Error("resposta com telefone ou segredo");
    },
    markSent: async () => {
      throw new Error("não deveria marcar enviada");
    },
    markError: async (id, safeError) => {
      markedIds.push([id, safeError]);
      return { ...pendingMessage, status: "error" };
    },
  });

  assert.deepEqual(markedIds, [
    ["outbox-1", "Não foi possível enviar a mensagem pelo WhatsApp."],
  ]);
  assert.deepEqual(result, {
    error: "Não foi possível enviar a mensagem pelo WhatsApp.",
  });
});

test("repete somente a atualização idempotente, nunca o envio", async () => {
  let sends = 0;
  let updates = 0;

  const result = await runOutgoingMessageOutbox({
    createPending: async () => pendingMessage,
    send: async () => {
      sends += 1;
      return { providerMessageId: "provider-123" };
    },
    markSent: async (id, providerMessageId) => {
      updates += 1;
      if (updates < 3) throw new Error("falha transitória");
      return {
        ...pendingMessage,
        id,
        status: "server_ack",
        provider_message_id: providerMessageId,
      };
    },
    markError: async () => pendingMessage,
  });

  assert.equal(sends, 1);
  assert.equal(updates, 3);
  assert.equal(result.success, true);
});

test("reconcilia webhook-before-finalize em uma única mensagem sem reenviar", async () => {
  const rows = new Map([
    [
      "outbox-1",
      {
        ...pendingMessage,
        conteudo: "mensagem final",
      },
    ],
  ]);
  let sends = 0;

  const result = await runOutgoingMessageOutbox({
    createPending: async () => rows.get("outbox-1"),
    send: async () => {
      sends += 1;
      rows.set("webhook-1", {
        id: "webhook-1",
        status: "server_ack",
        provider_message_id: "provider-123",
        conteudo: "[mensagem sem texto]",
      });
      return { providerMessageId: "provider-123" };
    },
    markSent: async (id, providerMessageId) =>
      finalizeOutgoingMessageIdempotently({
        providerMessageId,
        finalizePending: async () => {
          const duplicate = [...rows.values()].find(
            (row) =>
              row.id !== id &&
              row.provider_message_id === providerMessageId,
          );
          if (duplicate) throw { code: "23505" };
          const finalized = {
            ...rows.get(id),
            status: "server_ack",
            provider_message_id: providerMessageId,
          };
          rows.set(id, finalized);
          return finalized;
        },
        findProviderMessage: async () =>
          [...rows.values()].find(
            (row) => row.provider_message_id === providerMessageId,
          ) ?? null,
        adoptProviderMessage: async (providerMessage) => {
          const adopted = {
            ...providerMessage,
            conteudo: rows.get(id).conteudo,
            status: "server_ack",
          };
          rows.set(providerMessage.id, adopted);
          return adopted;
        },
        removePendingDuplicate: async () => {
          if (rows.get(id)?.provider_message_id === null) rows.delete(id);
        },
      }),
    markError: async () => {
      throw new Error("não deveria marcar erro");
    },
  });

  assert.equal(sends, 1);
  assert.deepEqual([...rows.values()], [
    {
      id: "webhook-1",
      status: "server_ack",
      provider_message_id: "provider-123",
      conteudo: "mensagem final",
    },
  ]);
  assert.deepEqual(result, {
    success: true,
    message: {
      id: "webhook-1",
      status: "server_ack",
      provider_message_id: "provider-123",
      conteudo: "mensagem final",
    },
  });
});

test("finalização que vence a corrida não executa reconciliação", async () => {
  let reconciliations = 0;

  const finalized = await finalizeOutgoingMessageIdempotently({
    providerMessageId: "provider-123",
    finalizePending: async () => ({
      ...pendingMessage,
      status: "server_ack",
      provider_message_id: "provider-123",
    }),
    findProviderMessage: async () => {
      reconciliations += 1;
      return null;
    },
    adoptProviderMessage: async (message) => message,
    removePendingDuplicate: async () => {
      reconciliations += 1;
    },
  });

  assert.equal(reconciliations, 0);
  assert.equal(finalized.id, "outbox-1");
  assert.equal(finalized.provider_message_id, "provider-123");
});

test("reconciliação não rebaixa status confirmado pelo webhook", () => {
  assert.equal(chooseFinalOutgoingStatus("delivery_ack"), "delivery_ack");
  assert.equal(chooseFinalOutgoingStatus("read"), "read");
  assert.equal(chooseFinalOutgoingStatus("pending"), "server_ack");
  assert.equal(chooseFinalOutgoingStatus("error"), "server_ack");
  assert.equal(
    chooseMostAdvancedOutgoingStatus("read", "server_ack"),
    "read",
  );
  assert.equal(
    chooseMostAdvancedOutgoingStatus("delivery_ack", "played"),
    "played",
  );
});

const pendingForReconciliation = {
  id: "pending-1",
  remoteJid: "5511999999999@s.whatsapp.net",
  text: "Mensagem já enviada",
  createdAt: "2026-08-11T15:00:00.000Z",
  providerMessageId: null,
};

const matchingEvolutionMessage = {
  providerMessageId: "provider-recovered",
  remoteJid: "5511999999999@s.whatsapp.net",
  fromMe: true,
  content: "Mensagem já enviada",
  createdAt: "2026-08-11T15:00:20.000Z",
  status: "delivery_ack",
};

test("reconcilia uma correspondência inequívoca da Evolution", async () => {
  const finalized = [];

  const result = await reconcilePendingOutgoingMessages({
    now: new Date("2026-08-11T15:05:00.000Z"),
    listPending: async () => [pendingForReconciliation],
    findRecent: async () => [matchingEvolutionMessage],
    finalizeMatch: async (pending, match) => {
      finalized.push([pending.id, match.providerMessageId, match.status]);
    },
    markExpired: async () => {
      throw new Error("mensagem reconciliável não deve expirar");
    },
  });

  assert.deepEqual(finalized, [
    ["pending-1", "provider-recovered", "delivery_ack"],
  ]);
  assert.deepEqual(result, { reconciled: 1, expired: 0, errors: [] });
});

test("mantém pending quando duas mensagens podem corresponder", async () => {
  let finalized = 0;
  let expired = 0;

  const result = await reconcilePendingOutgoingMessages({
    now: new Date("2026-08-11T15:05:00.000Z"),
    listPending: async () => [pendingForReconciliation],
    findRecent: async () => [
      matchingEvolutionMessage,
      {
        ...matchingEvolutionMessage,
        providerMessageId: "provider-ambiguous",
        createdAt: "2026-08-11T15:00:30.000Z",
      },
    ],
    finalizeMatch: async () => {
      finalized += 1;
    },
    markExpired: async () => {
      expired += 1;
    },
  });

  assert.equal(finalized, 0);
  assert.equal(expired, 0);
  assert.deepEqual(result, { reconciled: 0, expired: 0, errors: [] });
});

test("expira pending antigo sem correspondência com erro seguro", async () => {
  const expirations = [];

  const result = await reconcilePendingOutgoingMessages({
    now: new Date("2026-08-11T16:00:00.000Z"),
    listPending: async () => [pendingForReconciliation],
    findRecent: async () => [],
    finalizeMatch: async () => {
      throw new Error("mensagem sem match não deve ser finalizada");
    },
    markExpired: async (pending, safeError) => {
      expirations.push([pending.id, safeError]);
    },
  });

  assert.deepEqual(expirations, [
    ["pending-1", "Não foi possível confirmar o envio da mensagem."],
  ]);
  assert.deepEqual(result, { reconciled: 0, expired: 1, errors: [] });
});

test("consumidor de pending nunca chama send", async () => {
  let sends = 0;

  await reconcilePendingOutgoingMessages({
    now: new Date("2026-08-11T15:05:00.000Z"),
    listPending: async () => [pendingForReconciliation],
    findRecent: async () => [],
    finalizeMatch: async () => undefined,
    markExpired: async () => undefined,
    send: async () => {
      sends += 1;
    },
  });

  assert.equal(sends, 0);
});

