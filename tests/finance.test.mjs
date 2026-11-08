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
  openItemsForMonth,
  projectBalances,
  projectCash,
  sumCharges,
  daysUntil,
  dueLabel,
  getBillingState,
  paymentTrail,
  sortByUrgency,
} from "../src/lib/subscription-billing.ts";
import {
  installmentStates,
  nextInstallmentDate,
  parsePaymentSchedule,
  scheduleForecast,
} from "../src/lib/project-schedule.ts";
import {
  countByWorkStatus,
  isDueSoon,
  isTrackedProject,
  isWorkOverdue,
  nextDeliveredOn,
  onTimeRate,
  relativeDay,
} from "../src/lib/project-work.ts";

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

test("no mês atual, o que está atrasado aparece junto com o que vence no mês", () => {
  const items = [
    { id: "out", month: "2026-10-01", timing: "atrasado" },
    { id: "nov", month: "2026-11-01", timing: "a_vencer" },
    { id: "dez", month: "2026-12-01", timing: "futuro" },
  ];
  const ids = (list) => list.map((item) => item.id);

  assert.deepEqual(ids(openItemsForMonth(items, "2026-11-01", "2026-11-01")), ["out", "nov"]);
  // Fora do mês atual, cada mês mostra só o que é dele.
  assert.deepEqual(ids(openItemsForMonth(items, "2026-10-01", "2026-11-01")), ["out"]);
  assert.deepEqual(ids(openItemsForMonth(items, "2026-12-01", "2026-11-01")), ["dez"]);
});

test("o rótulo de vencimento fala em dias perto da data e marca o atraso", () => {
  const today = "2026-11-08";
  assert.equal(daysUntil("2026-12-08", today), 30);
  assert.equal(daysUntil("2026-10-13", today), -26);

  assert.deepEqual(dueLabel("2026-10-13", today), { text: "venceu 13/10, há 26 dias", late: true });
  assert.deepEqual(dueLabel("2026-11-07", today), { text: "venceu 07/11, há 1 dia", late: true });
  assert.deepEqual(dueLabel("2026-11-08", today), { text: "vence hoje", late: false });
  assert.deepEqual(dueLabel("2026-11-09", today), { text: "vence amanhã", late: false });
  assert.deepEqual(dueLabel("2026-11-13", today), { text: "vence em 5 dias, 13/11", late: false });
  assert.deepEqual(dueLabel("2026-11-20", today), { text: "vence 20/11", late: false });
});

test("a lista de assinaturas começa por quem deve e termina em quem já pagou", () => {
  const today = "2026-11-12";
  const build = (client_name, billing_day, paidMonths) => {
    const subscription = {
      client_name,
      amount: 100,
      billing_day,
      status: "ativa",
      started_on: "2026-10-01",
      ended_on: null,
    };
    const payments = paidMonths.map((reference_month) => ({ reference_month, amount: 100 }));
    return { subscription, state: getBillingState(subscription, payments, today) };
  };

  const pagou = build("Pagou", 5, ["2026-10-01", "2026-11-01"]);
  const devendo = build("Devendo", 5, ["2026-10-01"]);
  const venceDepois = build("Vence dia 25", 25, ["2026-10-01"]);
  const venceAntes = build("Vence dia 15", 15, ["2026-10-01"]);

  const order = sortByUrgency([pagou, venceDepois, devendo, venceAntes]).map(
    (row) => row.subscription.client_name,
  );
  assert.deepEqual(order, ["Devendo", "Vence dia 15", "Vence dia 25", "Pagou"]);
});

test("o histórico curto mostra só meses cobrados, com pago, atrasado e em aberto", () => {
  const subscription = {
    amount: 100,
    billing_day: 15,
    status: "ativa",
    started_on: "2026-09-01",
    ended_on: null,
  };
  const trail = paymentTrail(
    subscription,
    [{ reference_month: "2026-09-01", amount: 100, paid_on: "2026-09-16" }],
    "2026-11-08",
  );
  assert.deepEqual(trail, [
    { month: "2026-09-01", status: "pago", paidOn: "2026-09-16" },
    { month: "2026-10-01", status: "atrasado", paidOn: null },
    { month: "2026-11-01", status: "aberto", paidOn: null },
  ]);
});

const camilaSchedule = parsePaymentSchedule([
  { dueOn: "2026-12-10", amount: 750 },
  { dueOn: "2026-11-10", amount: 1500, label: "entrada" },
  { dueOn: "2027-01-10", amount: "750.00" },
  { dueOn: "2027-02-10", amount: 750 },
  { dueOn: "2027-03-10", amount: 750 },
]);

test("o plano de parcelas ignora item inválido e fica em ordem de data", () => {
  assert.deepEqual(parsePaymentSchedule(null), []);
  assert.deepEqual(parsePaymentSchedule({ dueOn: "2026-11-10" }), []);
  assert.deepEqual(
    parsePaymentSchedule([
      { dueOn: "10/11/2026", amount: 100 },
      { dueOn: "2026-11-10", amount: 0 },
      null,
      { dueOn: "2026-11-10", amount: 100, label: "  " },
    ]),
    [{ dueOn: "2026-11-10", amount: 100, label: null }],
  );
  assert.deepEqual(
    camilaSchedule.map((item) => item.dueOn),
    ["2026-11-10", "2026-12-10", "2027-01-10", "2027-02-10", "2027-03-10"],
  );
});

test("sem nada recebido, a entrada vence no mês e as outras ficam numeradas", () => {
  const states = installmentStates(camilaSchedule, 0, "2026-11-08");
  assert.deepEqual(
    states.map(({ name, open, status }) => [name, open, status]),
    [
      ["entrada", 1500, "a_vencer"],
      ["parcela 1 de 4", 750, "futuro"],
      ["parcela 2 de 4", 750, "futuro"],
      ["parcela 3 de 4", 750, "futuro"],
      ["parcela 4 de 4", 750, "futuro"],
    ],
  );
});

test("o recebido abate da parcela mais antiga e o resto continua em aberto", () => {
  const states = installmentStates(camilaSchedule, "1700.00", "2026-12-15");
  assert.deepEqual(
    states.slice(0, 3).map(({ paid, open, status }) => [paid, open, status]),
    [
      [1500, 0, "pago"],
      [200, 550, "atrasado"],
      [0, 750, "futuro"],
    ],
  );

  const quitado = installmentStates(camilaSchedule, 4500, "2026-11-08");
  assert.equal(quitado.every((state) => state.status === "pago"), true);
});

test("parcela em aberto entra na previsão e na projeção de caixa", () => {
  const today = "2026-11-08";
  const charges = scheduleForecast(
    { id: "camila", title: "Site Camila Gracioli" },
    installmentStates(camilaSchedule, 0, today),
  );

  assert.equal(charges.length, 5);
  assert.deepEqual(charges[0], {
    id: "parcela:camila:0",
    subscriptionId: "",
    projectId: "camila",
    parcela: { projectTitle: "Site Camila Gracioli", name: "entrada" },
    clientName: "Site Camila Gracioli · entrada",
    amount: 1500,
    dueOn: "2026-11-10",
    month: "2026-11-01",
    timing: "a_vencer",
  });

  const [novembro, dezembro] = projectCash({
    startingCash: 1000,
    today,
    charges,
    bills: [],
    months: 2,
  });
  assert.equal(novembro.income, 1500);
  assert.equal(novembro.closing, 2500);
  assert.equal(dezembro.income, 750);
  assert.equal(dezembro.closing, 3250);

  const pago = scheduleForecast(
    { id: "camila", title: "Site Camila Gracioli" },
    installmentStates(camilaSchedule, 1500, today),
  );
  assert.equal(pago.length, 4);
  assert.equal(pago[0].clientName, "Site Camila Gracioli · parcela 1 de 4");
});

test("a próxima parcela cai no mesmo dia, ou no último dia do mês mais curto", () => {
  assert.equal(nextInstallmentDate("2026-11-10"), "2026-12-10");
  assert.equal(nextInstallmentDate("2026-12-10"), "2027-01-10");
  assert.equal(nextInstallmentDate("2027-01-31"), "2027-02-28");
  assert.equal(nextInstallmentDate("2028-01-31"), "2028-02-29");
});

const work = (work_status, due_on = null, delivered_on = null) => ({
  work_status,
  due_on,
  delivered_on,
});

test("status de produção conta quem não foi classificado à parte", () => {
  const counts = countByWorkStatus([
    work("em_andamento"),
    work("em_andamento"),
    work("concluido"),
    work(null),
    work("qualquer coisa"),
  ]);
  assert.equal(counts.em_andamento, 2);
  assert.equal(counts.concluido, 1);
  assert.equal(counts.sem_status, 2);
});

test("entrega no prazo só conta quem foi concluído e tinha prazo", () => {
  assert.equal(onTimeRate([work("concluido"), work("em_andamento", "2026-11-01")]), null);
  assert.deepEqual(
    onTimeRate([
      work("concluido", "2026-11-10", "2026-11-10"),
      work("concluido", "2026-11-10", "2026-11-12"),
      work("concluido", null, "2026-11-12"),
      work("em_andamento", "2026-11-10"),
    ]),
    { rate: 50, total: 2 },
  );
});

test("prazo vencido e entrega próxima ignoram concluído e pausado", () => {
  const today = "2026-11-08";
  assert.equal(isWorkOverdue(work("em_andamento", "2026-11-07"), today), true);
  assert.equal(isWorkOverdue(work(null, "2026-11-07"), today), true);
  assert.equal(isWorkOverdue(work("em_andamento", "2026-11-08"), today), false);
  assert.equal(isWorkOverdue(work("concluido", "2026-11-07"), today), false);
  assert.equal(isWorkOverdue(work("pausado", "2026-11-07"), today), false);

  assert.equal(isDueSoon(work("em_revisao", "2026-11-15"), today), true);
  assert.equal(isDueSoon(work("em_revisao", "2026-11-16"), today), false);
  assert.equal(isDueSoon(work("em_revisao", "2026-11-01"), today), true);
  assert.equal(isDueSoon(work("concluido", "2026-11-10"), today), false);
  assert.equal(isDueSoon(work("em_revisao"), today), false);
});

test("concluir registra a entrega sem apagar data já informada, e reabrir limpa", () => {
  assert.equal(nextDeliveredOn("concluido", null, "2026-11-08"), "2026-11-08");
  assert.equal(nextDeliveredOn("concluido", "2026-10-27", "2026-11-08"), "2026-10-27");
  assert.equal(nextDeliveredOn("em_revisao", "2026-10-27", "2026-11-08"), null);
  assert.equal(nextDeliveredOn(null, "2026-10-27", "2026-11-08"), null);
});

test("rascunho de proposta fica fora da lista de projetos", () => {
  assert.equal(isTrackedProject({ title: "Proposta — CCR Advogados", status: "draft" }), false);
  assert.equal(isTrackedProject({ title: "Proposta — CCR Advogados", status: "sent" }), true);
  assert.equal(isTrackedProject({ title: "Site Camila Gracioli", status: "draft" }), true);
});

test("projeto arquivado sai da lista e das contas", () => {
  assert.equal(isTrackedProject({ title: "Site Camila Gracioli", status: "archived" }), false);
  assert.equal(isTrackedProject({ title: "Site Camila Gracioli", status: "reviewed" }), true);
});

test("a data relativa fala em dias até um mês", () => {
  const today = "2026-11-08";
  assert.equal(relativeDay("2026-11-08", today), "hoje");
  assert.equal(relativeDay("2026-11-07", today), "ontem");
  assert.equal(relativeDay("2026-11-03", today), "há 5 dias");
  assert.equal(relativeDay("2026-09-01", today), "01/09/2026");
});
