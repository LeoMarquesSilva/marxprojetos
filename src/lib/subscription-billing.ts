// Regras de cobrança da recorrência, sem banco nem React — testáveis direto
// no node:test. Datas trafegam como "YYYY-MM-DD" (data civil de Brasília):
// comparar strings nesse formato é comparar datas, sem fuso no meio.

export type BillingSubscription = {
  amount: number | string;
  billing_day: number;
  status: "ativa" | "cancelada";
  started_on: string;
  ended_on: string | null;
};

export type BillingPayment = {
  reference_month: string;
  amount: number | string;
};

export type CurrentMonthStatus =
  /** Mês atual já pago. */
  | "pago"
  /** Vence ainda este mês e não foi pago. */
  | "pendente"
  /** Venceu e não foi pago. */
  | "atrasado"
  /** Não há cobrança neste mês (começa depois ou já foi cancelada). */
  | "sem_cobranca";

export function todayInBrasilia(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function monthStartOf(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function addMonths(month: string, count: number): string {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1 + count;
  const nextYear = year + Math.floor(monthIndex / 12);
  const nextMonth = ((monthIndex % 12) + 12) % 12;
  return `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-01`;
}

export function dueDateFor(month: string, billingDay: number): string {
  return `${month.slice(0, 7)}-${String(billingDay).padStart(2, "0")}`;
}

/** Mês é cobrado se o vencimento cai dentro da vigência da assinatura. */
export function isBillableMonth(subscription: BillingSubscription, month: string) {
  const due = dueDateFor(month, subscription.billing_day);
  if (due < subscription.started_on) return false;
  if (subscription.ended_on && due >= subscription.ended_on) return false;
  return true;
}

/**
 * Meses já devidos até o mês atual (inclusive), do mais antigo ao mais novo.
 * O mês atual entra mesmo antes do vencimento — ele aparece como pendente.
 */
export function billableMonthsUntil(
  subscription: BillingSubscription,
  today: string,
): string[] {
  const months: string[] = [];
  const lastMonth = monthStartOf(today);
  for (
    let month = monthStartOf(subscription.started_on);
    month <= lastMonth;
    month = addMonths(month, 1)
  ) {
    if (isBillableMonth(subscription, month)) months.push(month);
  }
  return months;
}

export type SubscriptionBillingState = {
  currentMonth: string;
  currentStatus: CurrentMonthStatus;
  /** Meses vencidos e não pagos, do mais antigo ao mais novo. */
  overdueMonths: string[];
  /** Meses devidos e não pagos (vencidos + o atual, se ainda não venceu). */
  openMonths: string[];
  /** Próximo vencimento em aberto; null se cancelada e tudo quitado. */
  nextDue: string | null;
};

export function getBillingState(
  subscription: BillingSubscription,
  payments: BillingPayment[],
  today: string,
): SubscriptionBillingState {
  const paid = new Set(payments.map((payment) => monthStartOf(payment.reference_month)));
  const currentMonth = monthStartOf(today);
  const billable = billableMonthsUntil(subscription, today);
  const openMonths = billable.filter((month) => !paid.has(month));
  const overdueMonths = openMonths.filter(
    (month) => dueDateFor(month, subscription.billing_day) < today,
  );

  let currentStatus: CurrentMonthStatus = "sem_cobranca";
  if (billable.includes(currentMonth)) {
    if (paid.has(currentMonth)) currentStatus = "pago";
    else if (overdueMonths.includes(currentMonth)) currentStatus = "atrasado";
    else currentStatus = "pendente";
  }

  let nextDue: string | null = openMonths[0]
    ? dueDateFor(openMonths[0], subscription.billing_day)
    : null;

  if (!nextDue && subscription.status === "ativa") {
    // Tudo quitado: o próximo vencimento é o primeiro mês cobrável à frente.
    for (let offset = 1; offset <= 24 && !nextDue; offset++) {
      const month = addMonths(currentMonth, offset);
      if (isBillableMonth(subscription, month)) {
        nextDue = dueDateFor(month, subscription.billing_day);
      }
    }
  }

  return { currentMonth, currentStatus, overdueMonths, openMonths, nextDue };
}

export function toAmount(value: number | string | null | undefined): number {
  const amount = typeof value === "string" ? Number(value) : (value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

/** Aceita "79,50", "79.50", "R$ 1.297,00". Devolve null se não for número. */
export function parseBrlAmount(input: string): number | null {
  const cleaned = input.replace(/[R$\s]/g, "");
  if (!cleaned) return null;
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100) / 100;
}

export function formatBrl(value: number | string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(toAmount(value));
}

export type RecurrenceSummary = {
  /** Soma mensal das assinaturas ativas. */
  mrr: number;
  activeCount: number;
  /** Recebido com referência ao mês atual. */
  receivedThisMonth: number;
  /** Mês atual ainda não pago (pendente ou atrasado). */
  toReceiveThisMonth: number;
  /** Soma de todos os meses vencidos e não pagos. */
  overdueTotal: number;
  overdueClients: number;
};

export function summarizeRecurrence(
  items: { subscription: BillingSubscription; payments: BillingPayment[] }[],
  today: string,
): RecurrenceSummary {
  const currentMonth = monthStartOf(today);
  const summary: RecurrenceSummary = {
    mrr: 0,
    activeCount: 0,
    receivedThisMonth: 0,
    toReceiveThisMonth: 0,
    overdueTotal: 0,
    overdueClients: 0,
  };

  for (const { subscription, payments } of items) {
    const amount = toAmount(subscription.amount);
    const state = getBillingState(subscription, payments, today);

    if (subscription.status === "ativa") {
      summary.mrr += amount;
      summary.activeCount += 1;
    }

    for (const payment of payments) {
      if (monthStartOf(payment.reference_month) === currentMonth) {
        summary.receivedThisMonth += toAmount(payment.amount);
      }
    }

    if (state.currentStatus === "pendente" || state.currentStatus === "atrasado") {
      summary.toReceiveThisMonth += amount;
    }

    if (state.overdueMonths.length > 0) {
      summary.overdueTotal += amount * state.overdueMonths.length;
      summary.overdueClients += 1;
    }
  }

  return summary;
}

/** Primeiro vencimento a partir do início da cobrança. */
export function firstDueDate(startedOn: string, billingDay: number): string {
  const month = monthStartOf(startedOn);
  const due = dueDateFor(month, billingDay);
  return due >= startedOn ? due : dueDateFor(addMonths(month, 1), billingDay);
}

/** Preço de tabela: plano base + adicionais marcados. */
export function planListPrice(
  plan: { price: number | string } | null | undefined,
  addons: { price: number | string }[],
): number {
  const total =
    toAmount(plan?.price) + addons.reduce((sum, addon) => sum + toAmount(addon.price), 0);
  return Math.round(total * 100) / 100;
}

function normalizeName(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Separa os sites do cliente escolhido (vinculado no CRM ou com a mesma
 * empresa) do resto, para o formulário mostrar primeiro o que importa.
 */
export function splitSitesForClient<
  Site extends { id: string; company: string | null },
>(
  sites: Site[],
  client: { name: string; company: string | null; project_id: string | null } | null,
): { suggested: Site[]; others: Site[] } {
  if (!client) return { suggested: [], others: sites };

  const names = new Set(
    [client.company, client.name].map(normalizeName).filter(Boolean),
  );
  const suggested: Site[] = [];
  const others: Site[] = [];
  for (const site of sites) {
    const matches =
      site.id === client.project_id || names.has(normalizeName(site.company));
    (matches ? suggested : others).push(site);
  }
  return { suggested, others };
}

export type LedgerLine = {
  id: string;
  kind: "entrada" | "saida";
  amount: number;
  occurredOn: string;
  category: string;
  description: string;
  /** Texto curto embaixo, como o mês de referência de uma recorrência. */
  detail: string | null;
  source: "lancamento" | "recorrencia";
};

export type ForecastTiming = "atrasado" | "a_vencer" | "futuro";

export type ForecastCharge = {
  id: string;
  subscriptionId: string;
  clientName: string;
  amount: number;
  dueOn: string;
  month: string;
  timing: ForecastTiming;
};

export type FinanceSubscription = BillingSubscription & {
  id: string;
  client_name: string;
};

type ManualEntry = {
  id: string;
  kind: "entrada" | "saida";
  amount: number | string;
  occurred_on: string;
  category: string;
  description: string;
};

type ReceivedPayment = BillingPayment & {
  id: string;
  subscription_id: string;
  paid_on: string;
  clientName: string;
  referenceLabel: string;
};

export function buildLedger(entries: ManualEntry[], payments: ReceivedPayment[]): LedgerLine[] {
  const manual: LedgerLine[] = entries.map((entry) => ({
    id: entry.id,
    kind: entry.kind,
    amount: toAmount(entry.amount),
    occurredOn: entry.occurred_on,
    category: entry.category,
    description: entry.description,
    detail: null,
    source: "lancamento",
  }));

  const received: LedgerLine[] = payments.map((payment) => ({
    id: payment.id,
    kind: "entrada",
    amount: toAmount(payment.amount),
    occurredOn: payment.paid_on,
    category: "Recorrência",
    description: payment.clientName,
    detail: payment.referenceLabel,
    source: "recorrencia",
  }));

  return [...manual, ...received].sort((a, b) => {
    if (a.occurredOn !== b.occurredOn) return b.occurredOn.localeCompare(a.occurredOn);
    return a.description.localeCompare(b.description, "pt-BR");
  });
}

export function linesInMonth(lines: LedgerLine[], month: string): LedgerLine[] {
  const start = monthStartOf(month);
  return lines.filter((line) => monthStartOf(line.occurredOn) === start);
}

export function monthTotals(lines: LedgerLine[]) {
  let income = 0;
  let expense = 0;
  for (const line of lines) {
    if (line.kind === "entrada") income += line.amount;
    else expense += line.amount;
  }
  return {
    income: roundMoney(income),
    expense: roundMoney(expense),
    balance: roundMoney(income - expense),
  };
}

/**
 * Cobranças de recorrência ainda não pagas, do início de cada assinatura
 * até `horizon` meses à frente do mês atual. O que já entrou fica no
 * caixa (paid_on); aqui só o que ainda vai entrar ou já deveria ter entrado.
 */
export function forecastCharges(
  subscriptions: FinanceSubscription[],
  payments: Array<{ subscription_id: string; reference_month: string }>,
  today: string,
  horizon: number,
): ForecastCharge[] {
  const current = monthStartOf(today);
  const horizonMonth = addMonths(current, horizon);
  const paidBySubscription = new Map<string, Set<string>>();
  for (const payment of payments) {
    const paid = paidBySubscription.get(payment.subscription_id) ?? new Set<string>();
    paid.add(monthStartOf(payment.reference_month));
    paidBySubscription.set(payment.subscription_id, paid);
  }

  const charges: ForecastCharge[] = [];
  for (const subscription of subscriptions) {
    const paid = paidBySubscription.get(subscription.id) ?? new Set<string>();
    for (
      let month = monthStartOf(subscription.started_on);
      month <= horizonMonth;
      month = addMonths(month, 1)
    ) {
      if (!isBillableMonth(subscription, month)) continue;
      if (paid.has(month)) continue;

      const dueOn = dueDateFor(month, subscription.billing_day);
      const timing: ForecastTiming =
        dueOn < today ? "atrasado" : month === current ? "a_vencer" : "futuro";

      charges.push({
        id: `${subscription.id}:${month}`,
        subscriptionId: subscription.id,
        clientName: subscription.client_name,
        amount: toAmount(subscription.amount),
        dueOn,
        month,
        timing,
      });
    }
  }

  charges.sort((a, b) => {
    if (a.dueOn !== b.dueOn) return a.dueOn.localeCompare(b.dueOn);
    return a.clientName.localeCompare(b.clientName, "pt-BR");
  });
  return charges;
}

export function chargesInMonth(charges: ForecastCharge[], month: string) {
  const start = monthStartOf(month);
  return charges.filter((charge) => charge.month === start);
}

export function sumCharges(charges: ForecastCharge[]) {
  return roundMoney(charges.reduce((sum, charge) => sum + charge.amount, 0));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
