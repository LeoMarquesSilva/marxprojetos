import assert from "node:assert/strict";
import test from "node:test";
import {
  addMonths,
  billableMonthsUntil,
  firstDueDate,
  getBillingState,
  parseBrlAmount,
  planListPrice,
  splitSitesForClient,
  summarizeRecurrence,
  todayInBrasilia,
} from "../src/lib/subscription-billing.ts";

const base = {
  amount: "79.50",
  billing_day: 10,
  status: "ativa",
  started_on: "2026-08-01",
  ended_on: null,
};

test("vira o ano ao somar meses", () => {
  assert.equal(addMonths("2026-11-01", 2), "2027-01-01");
  assert.equal(addMonths("2026-01-01", -1), "2025-12-01");
});

test("usa a data civil de Brasília, não a UTC", () => {
  // 01:00 UTC do dia 1 ainda é dia 30 à noite em Brasília.
  assert.equal(todayInBrasilia(new Date("2026-10-01T01:00:00Z")), "2026-09-30");
});

test("primeiro mês só é cobrado se o vencimento cai depois do início", () => {
  const sub = { ...base, started_on: "2026-09-29" };
  assert.deepEqual(billableMonthsUntil(sub, "2026-09-30"), []);
  assert.deepEqual(billableMonthsUntil(sub, "2026-10-05"), ["2026-10-01"]);
});

test("mês atual antes do vencimento fica pendente, depois fica atrasado", () => {
  const payments = [
    { reference_month: "2026-08-01", amount: 79.5 },
    { reference_month: "2026-09-01", amount: 79.5 },
  ];
  assert.equal(getBillingState(base, payments, "2026-10-05").currentStatus, "pendente");
  assert.equal(getBillingState(base, payments, "2026-10-10").currentStatus, "pendente");

  const late = getBillingState(base, payments, "2026-10-11");
  assert.equal(late.currentStatus, "atrasado");
  assert.deepEqual(late.overdueMonths, ["2026-10-01"]);
});

test("meses antigos sem pagamento contam como atraso e viram o próximo vencimento", () => {
  const state = getBillingState(base, [{ reference_month: "2026-09-01", amount: 79.5 }], "2026-09-20");
  assert.equal(state.currentStatus, "pago");
  assert.deepEqual(state.overdueMonths, ["2026-08-01"]);
  assert.equal(state.nextDue, "2026-08-10");
});

test("tudo pago aponta o próximo vencimento do mês seguinte", () => {
  const state = getBillingState(
    base,
    [
      { reference_month: "2026-08-01", amount: 79.5 },
      { reference_month: "2026-09-01", amount: 79.5 },
    ],
    "2026-09-20",
  );
  assert.equal(state.nextDue, "2026-10-10");
});

test("cancelada para de gerar meses a partir do fim", () => {
  const sub = { ...base, status: "cancelada", ended_on: "2026-09-05" };
  const state = getBillingState(sub, [{ reference_month: "2026-08-01", amount: 79.5 }], "2026-10-20");
  assert.equal(state.currentStatus, "sem_cobranca");
  assert.deepEqual(state.openMonths, []);
  assert.equal(state.nextDue, null);
});

test("entende valores digitados no formato brasileiro", () => {
  assert.equal(parseBrlAmount("79,50"), 79.5);
  assert.equal(parseBrlAmount("R$ 1.297,00"), 1297);
  assert.equal(parseBrlAmount("159"), 159);
  assert.equal(parseBrlAmount("abc"), null);
  assert.equal(parseBrlAmount(""), null);
});

test("resumo soma recorrência ativa, recebido e atraso", () => {
  const summary = summarizeRecurrence(
    [
      {
        subscription: base,
        payments: [{ reference_month: "2026-09-01", amount: "79.50" }],
      },
      { subscription: { ...base, amount: 79.5 }, payments: [] },
      {
        subscription: { ...base, status: "cancelada", ended_on: "2026-08-05" },
        payments: [],
      },
    ],
    "2026-09-20",
  );

  assert.deepEqual(summary, {
    mrr: 159,
    activeCount: 2,
    receivedThisMonth: 79.5,
    toReceiveThisMonth: 79.5,
    // 1º: agosto em aberto. 2º: agosto e setembro em aberto.
    overdueTotal: 79.5 * 3,
    overdueClients: 2,
  });
});

test("primeiro vencimento cai no mês seguinte se o dia já passou", () => {
  assert.equal(firstDueDate("2026-09-29", 10), "2026-10-10");
  assert.equal(firstDueDate("2026-09-05", 10), "2026-09-10");
  assert.equal(firstDueDate("2026-12-20", 10), "2027-01-10");
});

test("preço de tabela soma plano e adicionais", () => {
  assert.equal(planListPrice({ price: "119.00" }, [{ price: 39 }]), 158);
  assert.equal(planListPrice(null, []), 0);
});

test("sugere os sites do cliente pelo vínculo do CRM e pela empresa", () => {
  const sites = [
    { id: "a", company: "Ordem Digital" },
    { id: "b", company: "LZ Advogados" },
    { id: "c", company: "Pereira Garcia Advocacia" },
    { id: "d", company: null },
  ];
  const result = splitSitesForClient(sites, {
    name: "Leticia",
    company: "ordem digital ",
    project_id: "d",
  });
  assert.deepEqual(result.suggested.map((site) => site.id), ["a", "d"]);
  assert.deepEqual(result.others.map((site) => site.id), ["b", "c"]);
});
