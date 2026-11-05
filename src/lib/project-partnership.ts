// Projeto em sociedade: o cliente paga a um dos sócios ("quem recebe"), que
// tira os custos do mês e divide o que sobra pela porcentagem de cada um.
// No caixa só entra a minha parte, quando o sócio repassa — lançada como
// entrada ligada ao projeto. Sem banco nem React, para testar no node:test.
//
// O plano vive em projects.partnership (jsonb). As contas seguem a planilha
// "Quanto cada um recebe por mês" combinada entre os sócios.

import {
  addMonths,
  monthStartOf,
  toAmount,
  type ForecastBill,
  type ForecastCharge,
  type ForecastTiming,
} from "@/lib/subscription-billing";

export type PartnershipPartner = {
  name: string;
  /** Porcentagem do lucro (0 a 100). As do projeto somam 100. */
  share: number;
  /** Sou eu: a parte que entra no meu caixa. */
  me?: boolean;
};

export type PartnershipCost = {
  description: string;
  amount: number;
  /** "mes" sai todo mês; "ano" sai uma vez a cada 12 meses. */
  every: "mes" | "ano";
  /** Primeiro mês em que sai (YYYY-MM-01). */
  firstMonth: string;
  /** Quem paga no cartão; o valor volta para ele antes da divisão. */
  paidBy: string;
};

export type ProjectPartnership = {
  /** Sócio em cuja conta cai o pagamento do cliente. */
  collector: string;
  partners: PartnershipPartner[];
  installments: {
    count: number;
    /** Valor de cada parcela; a última fecha o total. */
    amount: number;
    total: number;
    firstMonth: string;
  };
  /** Mensalidade do cliente; `firstMonth` depende do lançamento. */
  monthly: { amount: number; firstMonth: string } | null;
  /** Mês previsto (ou real) do lançamento. */
  launchMonth: string | null;
  /** Dia do mês em que o cliente costuma pagar. */
  dueDay: number;
  costs: PartnershipCost[];
  /** Meses que o cliente já pagou a quem recebe. */
  payments: Array<{ month: string; paidOn: string }>;
  notes?: string | null;
};

export type PartnershipShare = {
  name: string;
  me: boolean;
  amount: number;
};

export type PartnershipMonth = {
  month: string;
  /** 1 = primeiro mês do contrato. */
  index: number;
  installment: number;
  monthly: number;
  income: number;
  costs: number;
  profit: number;
  shares: PartnershipShare[];
  myShare: number;
  paidOn: string | null;
  events: string[];
};

const MONTH_PATTERN = /^\d{4}-\d{2}-01$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** Diferença de centavos entre o calculado e o repassado não vira cobrança. */
const CENT_TOLERANCE = 0.1;

function round(value: number) {
  return Math.round(value * 100) / 100;
}

/** Meses inteiros de `from` até `to` (ambos YYYY-MM-01). */
export function monthsBetween(from: string, to: string) {
  return (
    (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
    (Number(to.slice(5, 7)) - Number(from.slice(5, 7)))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Lê o jsonb do banco. Plano incompleto ou com porcentagens que não fecham
 * 100% volta null: melhor o projeto aparecer como comum do que dividir errado.
 */
export function parsePartnership(raw: unknown): ProjectPartnership | null {
  if (!isRecord(raw)) return null;
  const { collector, partners, installments, monthly, launchMonth, dueDay, costs, payments } =
    raw;

  if (typeof collector !== "string" || !collector.trim()) return null;
  if (!Array.isArray(partners) || partners.length === 0) return null;
  const parsedPartners: PartnershipPartner[] = [];
  for (const partner of partners) {
    if (!isRecord(partner) || typeof partner.name !== "string") return null;
    const share = Number(partner.share);
    if (!Number.isFinite(share) || share < 0) return null;
    parsedPartners.push({ name: partner.name, share, me: partner.me === true });
  }
  const totalShare = parsedPartners.reduce((sum, partner) => sum + partner.share, 0);
  if (Math.abs(totalShare - 100) > 0.001) return null;

  if (!isRecord(installments)) return null;
  const count = Number(installments.count);
  const amount = toAmount(installments.amount as number | string);
  const total = toAmount(installments.total as number | string);
  if (!Number.isInteger(count) || count < 0) return null;
  if (typeof installments.firstMonth !== "string" || !MONTH_PATTERN.test(installments.firstMonth)) {
    return null;
  }

  let parsedMonthly: ProjectPartnership["monthly"] = null;
  if (isRecord(monthly)) {
    if (typeof monthly.firstMonth !== "string" || !MONTH_PATTERN.test(monthly.firstMonth)) {
      return null;
    }
    parsedMonthly = {
      amount: toAmount(monthly.amount as number | string),
      firstMonth: monthly.firstMonth,
    };
  }

  const parsedCosts: PartnershipCost[] = [];
  for (const cost of Array.isArray(costs) ? costs : []) {
    if (!isRecord(cost) || typeof cost.description !== "string") return null;
    if (typeof cost.firstMonth !== "string" || !MONTH_PATTERN.test(cost.firstMonth)) return null;
    parsedCosts.push({
      description: cost.description,
      amount: toAmount(cost.amount as number | string),
      every: cost.every === "ano" ? "ano" : "mes",
      firstMonth: cost.firstMonth,
      paidBy: typeof cost.paidBy === "string" ? cost.paidBy : collector,
    });
  }

  const parsedPayments: ProjectPartnership["payments"] = [];
  for (const payment of Array.isArray(payments) ? payments : []) {
    if (!isRecord(payment)) continue;
    if (typeof payment.month !== "string" || !MONTH_PATTERN.test(payment.month)) continue;
    if (typeof payment.paidOn !== "string" || !DATE_PATTERN.test(payment.paidOn)) continue;
    parsedPayments.push({ month: payment.month, paidOn: payment.paidOn });
  }

  const day = Number(dueDay);
  return {
    collector,
    partners: parsedPartners,
    installments: { count, amount, total, firstMonth: installments.firstMonth },
    monthly: parsedMonthly,
    launchMonth:
      typeof launchMonth === "string" && MONTH_PATTERN.test(launchMonth) ? launchMonth : null,
    dueDay: Number.isInteger(day) && day >= 1 && day <= 28 ? day : 10,
    costs: parsedCosts,
    payments: parsedPayments,
    notes: typeof raw.notes === "string" ? raw.notes : null,
  };
}

/** Valor da parcela do mês; a última fecha o total combinado. */
function installmentFor(plan: ProjectPartnership, month: string) {
  const { count, amount, total, firstMonth } = plan.installments;
  const position = monthsBetween(firstMonth, month);
  if (position < 0 || position >= count) return 0;
  if (position === count - 1) return round(total - amount * (count - 1));
  return amount;
}

function costsFor(plan: ProjectPartnership, month: string) {
  let sum = 0;
  const events: string[] = [];
  for (const cost of plan.costs) {
    const elapsed = monthsBetween(cost.firstMonth, month);
    if (elapsed < 0) continue;
    if (cost.every === "mes") {
      sum += cost.amount;
    } else if (elapsed % 12 === 0) {
      sum += cost.amount;
      events.push(`${cost.description} no cartão do ${cost.paidBy}`);
    }
  }
  return { costs: round(sum), events };
}

/** Porcentagem em centavos inteiros, meio centavo para longe do zero. */
function percentOf(value: number, percent: number) {
  const cents = Math.round(value * 100);
  const raw = (Math.abs(cents) * percent) / 100;
  return (Math.sign(cents) * Math.round(raw)) / 100;
}

/**
 * Divide o lucro do mês. Cada sócio que não recebe leva a sua porcentagem
 * arredondada no centavo; quem recebe fica com o que sobra, para a soma
 * fechar com o dinheiro que está na conta dele.
 */
export function splitProfit(plan: ProjectPartnership, profit: number): PartnershipShare[] {
  const others = plan.partners
    .filter((partner) => partner.name !== plan.collector)
    .map((partner) => ({
      name: partner.name,
      me: Boolean(partner.me),
      amount: percentOf(profit, partner.share),
    }));
  const rest = round(profit - others.reduce((sum, share) => sum + share.amount, 0));
  return plan.partners.map((partner) =>
    partner.name === plan.collector
      ? { name: partner.name, me: Boolean(partner.me), amount: rest }
      : others.find((share) => share.name === partner.name)!,
  );
}

/** Mês a mês do contrato, do primeiro mês até `months` meses depois. */
export function partnershipSchedule(
  plan: ProjectPartnership,
  months: number,
): PartnershipMonth[] {
  const start = plan.installments.firstMonth;
  const lastInstallment = addMonths(start, plan.installments.count - 1);
  const paidOn = new Map(plan.payments.map((payment) => [payment.month, payment.paidOn]));
  const rows: PartnershipMonth[] = [];

  for (let index = 0; index < months; index++) {
    const month = addMonths(start, index);
    const installment = installmentFor(plan, month);
    const monthly =
      plan.monthly && month >= plan.monthly.firstMonth ? plan.monthly.amount : 0;
    const income = round(installment + monthly);
    const { costs, events: costEvents } = costsFor(plan, month);
    const profit = round(income - costs);
    const shares = splitProfit(plan, profit);

    const events: string[] = [];
    if (index === 0) events.push("Assinatura");
    if (plan.launchMonth === month) events.push("Lançamento");
    if (plan.monthly?.firstMonth === month) events.push("1ª mensalidade");
    if (plan.installments.count > 1 && month === lastInstallment) events.push("Última parcela");
    events.push(...costEvents);

    rows.push({
      month,
      index: index + 1,
      installment,
      monthly,
      income,
      costs,
      profit,
      shares,
      myShare: shares.find((share) => share.me)?.amount ?? 0,
      paidOn: paidOn.get(month) ?? null,
      events,
    });
  }
  return rows;
}

/** Meses do primeiro até `until` (inclusive). */
function scheduleUntil(plan: ProjectPartnership, until: string) {
  const months = monthsBetween(plan.installments.firstMonth, monthStartOf(until)) + 1;
  return months > 0 ? partnershipSchedule(plan, months) : [];
}

export type PartnershipSettlement = {
  /** Parcelas da implantação que o cliente já pagou. */
  installmentsPaid: number;
  /** Quanto o cliente já pagou a quem recebe. */
  clientPaid: number;
  /** Só a parte das parcelas da implantação, para abater do contrato. */
  installmentsReceived: number;
  /** Minha parte dos meses que o cliente já pagou. */
  myEarned: number;
  /** O que já entrou no meu caixa (repasses ligados ao projeto). */
  myReceived: number;
  /** O que quem recebe ainda me deve dos meses pagos. */
  myPending: number;
};

export function partnershipSettlement(
  plan: ProjectPartnership,
  myEntries: Array<{ kind: "entrada" | "saida"; amount: number | string }>,
  today: string,
): PartnershipSettlement {
  // Até o mês atual ou até o último mês marcado, se o cliente adiantou.
  const until = plan.payments.reduce(
    (latest, payment) => (payment.month > latest ? payment.month : latest),
    monthStartOf(today),
  );
  const paidRows = scheduleUntil(plan, until).filter((row) => row.paidOn);

  const received = myEntries
    .filter((entry) => entry.kind === "entrada")
    .reduce((sum, entry) => sum + toAmount(entry.amount), 0);
  const paidBack = myEntries
    .filter((entry) => entry.kind === "saida")
    .reduce((sum, entry) => sum + toAmount(entry.amount), 0);
  const myEarned = round(paidRows.reduce((sum, row) => sum + row.myShare, 0));
  const myReceived = round(received - paidBack);
  const pending = round(myEarned - myReceived);

  return {
    installmentsPaid: paidRows.filter((row) => row.installment > 0).length,
    clientPaid: round(paidRows.reduce((sum, row) => sum + row.income, 0)),
    installmentsReceived: round(paidRows.reduce((sum, row) => sum + row.installment, 0)),
    myEarned,
    myReceived,
    myPending: pending < CENT_TOLERANCE ? 0 : pending,
  };
}

/**
 * Minha parte de cada mês ainda não repassada, no formato da previsão de
 * Finanças. Os repasses recebidos quitam os meses do mais antigo para o mais
 * novo. Mês com lucro negativo (a Apple renova e só entra a mensalidade) vira
 * conta: a minha parte do que faltou para cobrir os custos.
 */
export function partnershipForecast(
  project: { id: string; title: string; plan: ProjectPartnership },
  myEntries: Array<{ kind: "entrada" | "saida"; amount: number | string }>,
  today: string,
  horizon: number,
): { charges: ForecastCharge[]; bills: ForecastBill[] } {
  const { plan } = project;
  const current = monthStartOf(today);
  const rows = scheduleUntil(plan, addMonths(current, horizon));

  let received = myEntries
    .filter((entry) => entry.kind === "entrada")
    .reduce((sum, entry) => sum + toAmount(entry.amount), 0);
  let paidIn = myEntries
    .filter((entry) => entry.kind === "saida")
    .reduce((sum, entry) => sum + toAmount(entry.amount), 0);

  const charges: ForecastCharge[] = [];
  const bills: ForecastBill[] = [];
  for (const row of rows) {
    const dueOn = row.paidOn ?? `${row.month.slice(0, 7)}-${String(plan.dueDay).padStart(2, "0")}`;
    const timing: ForecastTiming =
      row.month < current ? "atrasado" : row.month === current ? "a_vencer" : "futuro";

    if (row.myShare > 0) {
      const covered = Math.min(row.myShare, Math.max(0, received));
      received -= covered;
      const open = round(row.myShare - covered);
      if (open < CENT_TOLERANCE) continue;
      const day = `${dueOn.slice(8, 10)}/${dueOn.slice(5, 7)}`;
      charges.push({
        id: `sociedade:${project.id}:${row.month}`,
        subscriptionId: "",
        projectId: project.id,
        note: row.paidOn
          ? `cliente pagou em ${day} · falta o ${plan.collector} repassar`
          : `cliente paga dia ${day}, depois o ${plan.collector} repassa`,
        clientName: `${project.title} · repasse do ${plan.collector}`,
        amount: open,
        dueOn,
        month: row.month,
        timing,
      });
    } else if (row.myShare < 0) {
      const owed = -row.myShare;
      const covered = Math.min(owed, Math.max(0, paidIn));
      paidIn -= covered;
      const open = round(owed - covered);
      if (open < CENT_TOLERANCE) continue;
      bills.push({
        id: `sociedade:${project.id}:${row.month}`,
        expenseId: "",
        projectId: project.id,
        description: `${project.title} · sua parte dos custos`,
        category: "Repasse a sócio",
        amount: open,
        dueOn,
        month: row.month,
        timing,
      });
    }
  }
  return { charges, bills };
}

/** Marca (ou desmarca, com `paidOn` null) o mês como pago pelo cliente. */
export function withClientPayment(
  plan: ProjectPartnership,
  month: string,
  paidOn: string | null,
): ProjectPartnership {
  const payments = plan.payments.filter((payment) => payment.month !== month);
  if (paidOn) payments.push({ month, paidOn });
  payments.sort((a, b) => a.month.localeCompare(b.month));
  return { ...plan, payments };
}
