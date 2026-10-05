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
function isBillableMonth(subscription: BillingSubscription, month: string) {
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
