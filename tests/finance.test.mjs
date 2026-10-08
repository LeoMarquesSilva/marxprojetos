import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLedger,
  cashBalance,
  chargesInMonth,
  expensesByCategory,
  forecastBills,
  forecastCharges,
  isRecurringExpenseActive,
  linesInMonth,
  monthTotals,
  projectBalances,
  projectCash,
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

const das = {
  id: "das",
  description: "DAS do MEI",
  category: "Imposto",
  amount: "86.05",
  due_day: 20,
  started_on: "2026-10-01",
  ended_on: null,
};

const repasse = {
  id: "repasse",
  description: "Repasse do Samuel (sócio) — 3C",
  category: "Repasse a sócio",
  amount: 77.48,
  due_day: 13,
  started_on: "2026-10-01",
  ended_on: null,
};

test("gasto fixo aparece todo mês até ser pago e vencido fica atrasado", () => {
  const bills = forecastBills([das, repasse], [], "2026-10-15", 1);
  const october = chargesInMonth(bills, "2026-10-01");

  assert.deepEqual(
    october.map((bill) => [bill.description, bill.timing]),
    [
      ["Repasse do Samuel (sócio) — 3C", "atrasado"],
      ["DAS do MEI", "a_vencer"],
    ],
  );
  assert.equal(sumCharges(october), 163.53);
  assert.equal(chargesInMonth(bills, "2026-11-01").length, 2);
});

test("mês pago do gasto fixo some da previsão e encerrado para de contar", () => {
  const bills = forecastBills(
    [das, { ...repasse, ended_on: "2026-11-01" }],
    [
      { recurring_expense_id: "das", reference_month: "2026-10-01" },
      { recurring_expense_id: null, reference_month: null },
    ],
    "2026-10-08",
    2,
  );

  assert.deepEqual(
    bills.map((bill) => bill.id),
    ["repasse:2026-10-01", "das:2026-11-01", "das:2026-12-01"],
  );
  assert.equal(isRecurringExpenseActive(das, "2026-09-01"), false);
});

test("saídas do mês somadas por categoria, da maior para a menor", () => {
  const ledger = buildLedger(
    [
      { id: "a", kind: "saida", amount: "86.05", occurred_on: "2026-10-20", category: "Imposto", description: "DAS" },
      { id: "b", kind: "saida", amount: 20, occurred_on: "2026-10-02", category: "Ferramentas", description: "Figma" },
      { id: "c", kind: "saida", amount: 30, occurred_on: "2026-10-03", category: "Ferramentas", description: "Vercel" },
      { id: "d", kind: "entrada", amount: 500, occurred_on: "2026-10-03", category: "Projeto", description: "Site" },
    ],
    [],
  );

  assert.deepEqual(expensesByCategory(ledger), [
    { category: "Imposto", amount: 86.05 },
    { category: "Ferramentas", amount: 50 },
  ]);
});

test("saldo de hoje parte do valor conferido no banco e soma só o que veio depois", () => {
  const ledger = buildLedger(
    [
      { id: "antes", kind: "entrada", amount: 500, occurred_on: "2026-10-01", category: "Projeto", description: "Já no saldo" },
      { id: "depois", kind: "saida", amount: 86.05, occurred_on: "2026-10-05", category: "Imposto", description: "DAS" },
      { id: "futuro", kind: "saida", amount: 99, occurred_on: "2026-10-30", category: "Outros", description: "Agendado" },
    ],
    [],
  );

  assert.equal(cashBalance(ledger, "1000.00", "2026-10-01", "2026-10-08"), 913.95);
});

test("projeção acumula mês a mês e mostra quanto sobra sem retirada", () => {
  const today = "2026-10-08";
  const charges = forecastCharges(
    [
      ordem,
      { id: "3c", client_name: "3C", amount: 193.7, billing_day: 13, status: "ativa", started_on: "2026-10-01", ended_on: null },
      { ...ordem, id: "velha", client_name: "Atrasada", started_on: "2026-09-01", billing_day: 5 },
    ],
    [{ subscription_id: "velha", reference_month: "2026-09-01" }],
    today,
    12,
  );
  const bills = forecastBills([das, repasse], [], today, 12);

  const rows = projectCash({ startingCash: 1000, today, charges, bills, months: 3 });
  // Outubro: entra Ordem 79,50 + 3C 193,70 (a "velha" de 05/10 está atrasada e fica de fora);
  // sai DAS 86,05 + repasse 77,48.
  assert.deepEqual(rows[0], {
    month: "2026-10-01",
    opening: 1000,
    income: 273.2,
    expense: 163.53,
    draw: 0,
    closing: 1109.67,
  });
  assert.equal(rows[1].opening, rows[0].closing);
  assert.equal(rows[1].income, 352.7);
  assert.equal(rows[2].closing, 1488.01);

  const counting = projectCash({ startingCash: 1000, today, charges, bills, months: 1, includeOverdue: true });
  assert.equal(counting[0].income, 352.7);

  const drawing = projectCash({ startingCash: 1000, today, charges, bills, months: 3, monthlyDraw: 100 });
  assert.equal(drawing[2].closing, 1188.01);
});

test("projeto mostra quanto entrou, quanto custou e quanto falta receber", () => {
  const balances = projectBalances(
    [
      { id: "outeiral", title: "Outeiral Advocacia - Site", contract_amount: "1297.00" },
      { id: "lz", title: "LZ Advogados", contract_amount: 800 },
      { id: "sem-valor", title: "Sem valor", contract_amount: null },
      { id: "fora", title: "Sem nada", contract_amount: null },
    ],
    [
      { kind: "entrada", amount: "648.50", project_id: "outeiral" },
      { kind: "saida", amount: 100, project_id: "outeiral" },
      { kind: "entrada", amount: 900, project_id: "lz" },
      { kind: "entrada", amount: 50, project_id: "sem-valor" },
      { kind: "entrada", amount: 10, project_id: null },
    ],
  );

  assert.deepEqual(
    balances.map((item) => [item.id, item.received, item.spent, item.remaining]),
    [
      ["outeiral", 648.5, 100, 648.5],
      ["lz", 900, 0, 0],
      ["sem-valor", 50, 0, null],
    ],
  );
});

test("o recebido antes do sistema abate o que falta sem precisar de lançamento", () => {
  const [outeiral] = projectBalances(
    [{ id: "outeiral", title: "Outeiral", contract_amount: "1297.00", received_before: "648.50" }],
    [],
  );
  assert.equal(outeiral.received, 648.5);
  assert.equal(outeiral.remaining, 648.5);

  const [quitado] = projectBalances(
    [{ id: "outeiral", title: "Outeiral", contract_amount: 1297, received_before: 648.5 }],
    [{ kind: "entrada", amount: 648.5, project_id: "outeiral" }],
  );
  assert.equal(quitado.remaining, 0);
});
