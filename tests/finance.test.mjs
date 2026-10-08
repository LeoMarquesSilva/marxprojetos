import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLedger,
  chargesInMonth,
  forecastCharges,
  linesInMonth,
  monthTotals,
  sumCharges,
} from "../src/lib/subscription-billing.ts";

const outeiral = {
  id: "outeiral",
  client_name: "Outeiral Advocacia",
  amount: "147.00",
  billing_day: 8,
  status: "ativa",
  started_on: "2026-11-08",
  ended_on: null,
};

const ordem = {
  id: "ordem",
  client_name: "Ordem Digital",
  amount: 79.5,
  billing_day: 15,
  status: "ativa",
  started_on: "2026-09-30",
  ended_on: null,
};

test("caixa do mês soma lançamento manual e recorrência pela data em que entrou", () => {
  const ledger = buildLedger(
    [
      {
        id: "parcela",
        kind: "entrada",
        amount: "648.50",
        occurred_on: "2026-10-02",
        category: "Projeto",
        description: "Outeiral — 50%",
      },
      {
        id: "ferramenta",
        kind: "saida",
        amount: 49,
        occurred_on: "2026-10-03",
        category: "Ferramentas",
        description: "Hospedagem",
      },
    ],
    [
      {
        id: "pagto",
        subscription_id: "ordem",
        reference_month: "2026-09-01",
        amount: "79.50",
        paid_on: "2026-10-16",
        clientName: "Ordem Digital",
        referenceLabel: "referente a setembro de 2026",
      },
    ],
  );

  const october = linesInMonth(ledger, "2026-10-01");
  assert.equal(october.length, 3);
  assert.deepEqual(monthTotals(october), {
    income: 728,
    expense: 49,
    balance: 679,
  });
  assert.equal(linesInMonth(ledger, "2026-09-01").length, 0);
});

test("recorrência que começa no mês que vem não entra na cobrança deste mês", () => {
  const charges = forecastCharges([outeiral, ordem], [], "2026-10-08", 2);

  assert.deepEqual(
    chargesInMonth(charges, "2026-10-01").map((charge) => charge.clientName),
    ["Ordem Digital"],
  );
  assert.equal(chargesInMonth(charges, "2026-10-01")[0]?.timing, "a_vencer");

  const november = chargesInMonth(charges, "2026-11-01");
  assert.deepEqual(
    november.map((charge) => charge.clientName),
    ["Outeiral Advocacia", "Ordem Digital"],
  );
  assert.equal(sumCharges(november), 226.5);
  assert.ok(november.every((charge) => charge.timing === "futuro"));
});

test("mês já pago some da previsão e vencido fica atrasado", () => {
  const charges = forecastCharges(
    [ordem],
    [{ subscription_id: "ordem", reference_month: "2026-10-01" }],
    "2026-11-20",
    1,
  );

  assert.equal(chargesInMonth(charges, "2026-10-01").length, 0);
  assert.equal(chargesInMonth(charges, "2026-11-01")[0]?.timing, "atrasado");
});
