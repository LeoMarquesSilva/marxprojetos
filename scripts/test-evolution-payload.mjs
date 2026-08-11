import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFindMessagesBody,
  latestEvolutionMessageStatus,
  normalizeEvolutionMessagePage,
  resolveEvolutionMessageJid,
} from "../src/lib/evolution-payload.ts";

test("findMessages usa a paginação offset/page exigida pela Evolution", () => {
  assert.deepEqual(
    buildFindMessagesBody("5519999999999@s.whatsapp.net", 100, 2),
    {
      where: { key: { remoteJid: "5519999999999@s.whatsapp.net" } },
      offset: 100,
      page: 2,
    },
  );
});

test("normaliza a resposta paginada de findMessages", () => {
  const result = normalizeEvolutionMessagePage({
    messages: {
      total: 120,
      pages: 3,
      currentPage: 2,
      records: [{ id: "message-1" }],
    },
  });

  assert.equal(result.totalPages, 3);
  assert.equal(result.currentPage, 2);
  assert.deepEqual(result.records, [{ id: "message-1" }]);
});

test("troca LID pelo remoteJidAlt de telefone", () => {
  assert.deepEqual(
    resolveEvolutionMessageJid({
      remoteJid: "226280452669555@lid",
      remoteJidAlt: "5519996718987@s.whatsapp.net",
    }),
    {
      remoteJid: "5519996718987@s.whatsapp.net",
      lidJid: "226280452669555@lid",
    },
  );
});

test("usa senderPn quando o webhook LID não traz remoteJidAlt", () => {
  assert.deepEqual(
    resolveEvolutionMessageJid({
      remoteJid: "226280452669555@lid",
      senderPn: "5519996718987@s.whatsapp.net",
    }),
    {
      remoteJid: "5519996718987@s.whatsapp.net",
      lidJid: "226280452669555@lid",
    },
  );
});

test("usa o recibo mais recente retornado por findMessages", () => {
  assert.equal(
    latestEvolutionMessageStatus({
      status: "SERVER_ACK",
      MessageUpdate: [
        { status: "DELIVERY_ACK" },
        { status: "READ" },
      ],
    }),
    "read",
  );
});
