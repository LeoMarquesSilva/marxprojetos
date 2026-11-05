import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePartnership,
  partnershipForecast,
  partnershipSchedule,
  partnershipSettlement,
  withClientPayment,
} from "../src/lib/project-partnership.ts";

// Plano de exemplo: sociedade de três, 25% para um sócio e o resto meio a
// meio; a hospedagem sai desde a assinatura e a conta da Apple (anual) só
// na fatura do mês seguinte.
const raw = {
  collector: "Samuel",
  partners: [
    { name: "Rogério", share: 25 },
    { name: "Samuel", share: 37.5 },
    { name: "Leonardo", share: 37.5, me: true },
  ],
  installments: { count: 6, amount: 2416.66, total: 14500, firstMonth: "2026-11-01" },
  monthly: { amount: 800, firstMonth: "2027-02-01" },
  launchMonth: "2027-01-01",
  dueDay: 3,
  costs: [
    {
      description: "Hospedagem (Supabase, Vercel)",
      amount: 264.98,
      every: "mes",
      firstMonth: "2026-11-01",
      paidBy: "Samuel",
    },
    {
      description: "Conta da Apple",
      amount: 582.99,
      every: "ano",
      firstMonth: "2026-12-01",
      paidBy: "Samuel",
    },
  ],
  payments: [{ month: "2026-11-01", paidOn: "2026-11-03" }],
};

const plan = parsePartnership(raw);

function shareOf(row, name) {
  return row.shares.find((share) => share.name === name).amount;
}

test("lê o plano e recusa porcentagens que não fecham 100%", () => {
  assert.ok(plan);
  assert.equal(plan.partners.find((partner) => partner.me).name, "Leonardo");
  assert.equal(
    parsePartnership({ ...raw, partners: [{ name: "Rogério", share: 20 }] }),
    null,
  );
  assert.equal(parsePartnership(null), null);
});

test("mês a mês bate com a divisão combinada entre os sócios", () => {
  const rows = partnershipSchedule(plan, 14);

  // Novembro: a parcela só desconta a hospedagem.
  assert.equal(rows[0].income, 2416.66);
  assert.equal(rows[0].costs, 264.98);
  assert.equal(rows[0].profit, 2151.68);
  assert.equal(shareOf(rows[0], "Rogério"), 537.92);
  assert.equal(shareOf(rows[0], "Samuel"), 806.88);
  assert.equal(shareOf(rows[0], "Leonardo"), 806.88);
  assert.deepEqual(rows[0].events, ["Assinatura"]);

  // Dezembro: a Apple cai na fatura.
  assert.equal(rows[1].costs, 847.97);
  assert.equal(rows[1].profit, 1568.69);
  assert.equal(shareOf(rows[1], "Rogério"), 392.17);
  assert.equal(shareOf(rows[1], "Samuel"), 588.26);
  assert.equal(shareOf(rows[1], "Leonardo"), 588.26);
  assert.deepEqual(rows[1].events, ["Conta da Apple no cartão do Samuel"]);

  assert.equal(shareOf(rows[2], "Rogério"), 537.92);
  assert.equal(shareOf(rows[2], "Leonardo"), 806.88);
  assert.ok(rows[2].events.includes("Lançamento"));

  // Fevereiro: parcela + 1ª mensalidade.
  assert.equal(rows[3].income, 3216.66);
  assert.equal(rows[3].profit, 2951.68);
  assert.equal(shareOf(rows[3], "Rogério"), 737.92);
  assert.equal(shareOf(rows[3], "Leonardo"), 1106.88);

  // A última parcela fecha os R$ 14.500. Meio centavo arredonda para cima e
  // quem recebe fica com o que sobra.
  assert.equal(rows[5].installment, 2416.7);
  assert.equal(shareOf(rows[5], "Leonardo"), 1106.9);
  assert.equal(shareOf(rows[5], "Samuel"), 1106.89);
  assert.ok(rows[5].events.includes("Última parcela"));

  // Mês típico depois das parcelas.
  assert.equal(rows[6].profit, 535.02);
  assert.equal(shareOf(rows[6], "Rogério"), 133.76);
  assert.equal(shareOf(rows[6], "Leonardo"), 200.63);

  // Novembro de 2027 é mês comum; a Apple renova no mês 14 (dez/2027) e a
  // mensalidade não cobre: a diferença sai dos três.
  assert.equal(rows[12].profit, 535.02);
  assert.equal(rows[13].month, "2027-12-01");
  assert.equal(rows[13].profit, -47.97);
  assert.equal(shareOf(rows[13], "Rogério"), -11.99);
  assert.equal(shareOf(rows[13], "Leonardo"), -17.99);

  const first12 = rows.slice(0, 12);
  const total = (pick) => Math.round(first12.reduce((sum, row) => sum + pick(row), 0) * 100) / 100;
  assert.equal(total((row) => row.income), 21700);
  assert.equal(total((row) => row.profit), 17937.25);
  // A conta dos sócios dá R$ 4.484,29 e R$ 6.726,44: usa a hospedagem sem
  // arredondar (convertida do dólar). Aqui é a soma do que se repassa.
  assert.equal(total((row) => shareOf(row, "Rogério")), 4484.34);
  assert.equal(total((row) => shareOf(row, "Leonardo")), 6726.46);
  // Cada mês fecha no centavo com o lucro.
  for (const row of rows) {
    const sum = row.shares.reduce((acc, share) => acc + share.amount, 0);
    assert.equal(Math.round(sum * 100) / 100, row.profit);
  }
});

test("a 1ª parcela paga e ainda não repassada fica como pendente", () => {
  const settlement = partnershipSettlement(plan, [], "2026-11-04");
  assert.deepEqual(settlement, {
    installmentsPaid: 1,
    clientPaid: 2416.66,
    installmentsReceived: 2416.66,
    myEarned: 806.88,
    myReceived: 0,
    myPending: 806.88,
  });

  const afterTransfer = partnershipSettlement(
    plan,
    [{ kind: "entrada", amount: "806.87" }],
    "2026-11-10",
  );
  // Um centavo de diferença no repasse não fica cobrando.
  assert.equal(afterTransfer.myPending, 0);
  assert.equal(afterTransfer.myReceived, 806.87);
});

test("a previsão traz a minha parte de cada mês e quita do mais antigo", () => {
  const project = { id: "p1", title: "Loja online", plan };
  const { charges, bills } = partnershipForecast(project, [], "2026-11-04", 13);

  assert.equal(charges[0].month, "2026-11-01");
  assert.equal(charges[0].amount, 806.88);
  assert.equal(charges[0].dueOn, "2026-11-03");
  assert.equal(charges[0].timing, "a_vencer");
  assert.equal(charges[0].projectId, "p1");
  assert.equal(charges[0].note, "cliente pagou em 03/11 · falta o Samuel repassar");
  assert.equal(charges[1].amount, 588.26);
  assert.equal(charges[1].note, "cliente paga dia 03/12, depois o Samuel repassa");
  assert.equal(charges[1].dueOn, "2026-12-03");
  assert.equal(charges[1].timing, "futuro");
  // Dezembro de 2027: a Apple renova e a minha parte do buraco vira conta.
  assert.equal(bills.length, 1);
  assert.equal(bills[0].month, "2027-12-01");
  assert.equal(bills[0].amount, 17.99);

  const paid = partnershipForecast(
    project,
    [{ kind: "entrada", amount: 806.88 + 100 }],
    "2026-11-04",
    12,
  );
  assert.equal(paid.charges[0].month, "2026-12-01");
  assert.equal(paid.charges[0].amount, 488.26);
});

test("marcar e desmarcar o pagamento do cliente", () => {
  const marked = withClientPayment(plan, "2026-12-01", "2026-12-03");
  assert.deepEqual(
    marked.payments.map((payment) => payment.month),
    ["2026-11-01", "2026-12-01"],
  );
  assert.equal(partnershipSettlement(marked, [], "2026-12-05").myEarned, 1395.14);

  const unmarked = withClientPayment(marked, "2026-11-01", null);
  assert.deepEqual(unmarked.payments, [{ month: "2026-12-01", paidOn: "2026-12-03" }]);
});
