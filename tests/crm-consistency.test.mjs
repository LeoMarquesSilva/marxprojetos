import assert from "node:assert/strict";
import test from "node:test";

let rules = {};
try {
  rules = await import("../src/lib/crm-rules.ts");
} catch {
  // RED: o módulo nasce com a implementação das regras abaixo.
}

test("mudança para perdido exige motivo não vazio e normaliza espaços", () => {
  assert.deepEqual(rules.buildCrmStagePatch?.("perdido", "   ", "agora"), {
    error: "Informe o motivo da perda.",
  });
  assert.deepEqual(
    rules.buildCrmStagePatch?.("perdido", "  Sem orçamento  ", "agora"),
    {
      patch: {
        stage: "perdido",
        lost_reason: "Sem orçamento",
        updated_at: "agora",
      },
    },
  );
});

test("mudança para outro estágio preserva o motivo já registrado", () => {
  const result = rules.buildCrmStagePatch?.("proposta", null, "agora");

  assert.deepEqual(result, {
    patch: { stage: "proposta", updated_at: "agora" },
  });
  assert.equal(
    Object.hasOwn(result?.patch ?? {}, "lost_reason"),
    false,
    "não deve sobrescrever lost_reason com null",
  );
});

test("edição de cliente perdido rejeita apagar motivo e normaliza atualização", () => {
  assert.deepEqual(
    rules.buildCrmClientUpdatePatch?.(
      { name: "Cliente", lost_reason: "   " },
      "perdido",
      "agora",
    ),
    { error: "Informe o motivo da perda." },
  );
  assert.deepEqual(
    rules.buildCrmClientUpdatePatch?.(
      { lost_reason: "  Sem orçamento  " },
      "perdido",
      "agora",
    ),
    {
      patch: {
        lost_reason: "Sem orçamento",
        updated_at: "agora",
      },
    },
  );
});

test("edição sem lost_reason preserva motivo e não exige consultar estágio", () => {
  const result = rules.buildCrmClientUpdatePatch?.(
    { name: "  Cliente  " },
    undefined,
    "agora",
  );

  assert.deepEqual(result, {
    patch: { name: "  Cliente  ", updated_at: "agora" },
  });
  assert.equal(Object.hasOwn(result?.patch ?? {}, "lost_reason"), false);
});

test("tentativa de apagar motivo pede estágio atual antes de decidir", () => {
  assert.deepEqual(
    rules.buildCrmClientUpdatePatch?.(
      { lost_reason: null },
      undefined,
      "agora",
    ),
    { requiresCurrentStage: true },
  );
  assert.deepEqual(
    rules.buildCrmClientUpdatePatch?.(
      { lost_reason: null },
      "proposta",
      "agora",
    ),
    {
      patch: { lost_reason: null, updated_at: "agora" },
      requiresNonLostStage: true,
    },
  );
});

test("limite de atrasados usa a data corrente de Brasília no formato armazenado", () => {
  assert.equal(
    rules.getBrasiliaStoredDayStart?.(
      new Date("2026-08-12T01:30:00.000Z"),
    ),
    "2026-08-11T12:00:00.000Z",
  );
  assert.equal(
    rules.getBrasiliaStoredDayStart?.(
      new Date("2026-08-12T03:30:00.000Z"),
    ),
    "2026-08-12T12:00:00.000Z",
  );
});

test("prospect correspondente usa telefone normalizado ou remote_jid e ignora vinculados", () => {
  const prospects = [
    {
      id: "ja-vinculado",
      phone: "(19) 98198-4137",
      phone_e164: "5519981984137",
      crm_client_id: "cliente-antigo",
    },
    {
      id: "por-telefone-formatado",
      phone: "019 98198-4137",
      phone_e164: null,
      crm_client_id: null,
    },
    {
      id: "outro",
      phone: "(11) 99999-9999",
      phone_e164: "5511999999999",
      crm_client_id: null,
    },
  ];

  assert.equal(
    rules.findUnlinkedProspectIdByPhone?.(
      prospects,
      "5519981984137@s.whatsapp.net",
      "",
    ),
    "por-telefone-formatado",
  );
  assert.equal(
    rules.findUnlinkedProspectIdByPhone?.(
      prospects,
      "5511888888888@s.whatsapp.net",
      "(11) 99999-9999",
    ),
    "outro",
  );
});
