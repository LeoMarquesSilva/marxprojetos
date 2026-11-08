import "server-only";

import { cache } from "react";
import {
  getFinanceEntries,
  getFinanceProjects,
  getFinanceSettings,
  getRecurringExpenses,
} from "@/app/actions/finance";
import { getSubscriptionsWithPayments } from "@/app/actions/subscriptions";
import type { PartnershipView } from "@/components/finance-partnership";
import {
  buildLedger,
  cashBalance,
  forecastBills,
  forecastCharges,
  isRecurringExpenseActive,
  projectBalances,
  sumCharges,
} from "@/lib/finance";
import {
  monthsBetween,
  parsePartnership,
  partnershipForecast,
  partnershipSchedule,
  partnershipSettlement,
} from "@/lib/project-partnership";
import {
  getBillingState,
  isBillableMonth,
  monthStartOf,
  todayInBrasilia,
  toAmount,
} from "@/lib/subscription-billing";
import { formatMonthLabel } from "@/lib/subscription-format";
import type { FinanceProjectOption } from "@/types/finance";
import type { SubscriptionPayment } from "@/types/subscription";

const FORECAST_HORIZON = 12;

function round(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Tudo que as abas de Finanças precisam, calculado uma vez por requisição:
 * o layout e a página pedem os mesmos dados e o `cache` evita buscar duas vezes.
 */
export const loadFinanceData = cache(async () => {
  const today = todayInBrasilia();
  const currentMonth = monthStartOf(today);

  const [{ subscriptions, payments }, entries, recurringExpenses, settings, projects] =
    await Promise.all([
      getSubscriptionsWithPayments(),
      getFinanceEntries(),
      getRecurringExpenses(),
      getFinanceSettings(),
      getFinanceProjects(),
    ]);

  // Projeto em sociedade: o cliente paga a outro sócio, então o valor cheio
  // não é "a receber" meu. Sai da lista de projetos e ganha painel próprio.
  const partnerships = projects.flatMap((project) => {
    const plan = parsePartnership(project.partnership);
    return plan ? [{ project, plan }] : [];
  });
  const partnershipIds = new Set(partnerships.map(({ project }) => project.id));
  const ownProjects = projects.filter((project) => !partnershipIds.has(project.id));
  const entriesOf = (projectId: string) =>
    entries.filter((entry) => entry.project_id === projectId);

  const balances = projectBalances(ownProjects, entries);
  const receivedByProject = new Map(balances.map((item) => [item.id, item.received]));
  const ownOptions: FinanceProjectOption[] = ownProjects.map((project) => ({
    id: project.id,
    title: project.title,
    contractAmount: project.contract_amount === null ? null : toAmount(project.contract_amount),
    received: receivedByProject.get(project.id) ?? 0,
    receivedBefore: toAmount(project.received_before),
  }));
  const partnershipViews: PartnershipView[] = partnerships.map(({ project, plan }) => {
    const settlement = partnershipSettlement(plan, entriesOf(project.id), today);
    const elapsed = monthsBetween(plan.installments.firstMonth, currentMonth);
    // Até a primeira renovação de custo anual (a Apple), para o mês negativo
    // aparecer na tabela.
    const firstRenewal = Math.max(
      0,
      ...plan.costs
        .filter((cost) => cost.every === "ano")
        .map((cost) => monthsBetween(plan.installments.firstMonth, cost.firstMonth) + 13),
    );
    return {
      id: project.id,
      title: project.title,
      contractAmount: project.contract_amount === null ? null : toAmount(project.contract_amount),
      plan,
      settlement,
      // Primeiro ano inteiro e a renovação, andando junto com o mês atual
      // depois disso.
      rows: partnershipSchedule(plan, Math.max(12, firstRenewal, elapsed + 3)),
      option: {
        id: project.id,
        title: project.title,
        contractAmount: settlement.myEarned,
        received: settlement.myReceived,
        receivedBefore: 0,
        receiveLabel: `repasse do ${plan.collector}`,
      },
    };
  });
  const projectOptions = [...ownOptions, ...partnershipViews.map((view) => view.option)];
  const projectTitle = new Map(projects.map((project) => [project.id, project.title]));
  const projectReceivable = round(
    balances.reduce((sum, item) => sum + (item.remaining ?? 0), 0),
  );

  const clientBySubscription = new Map(
    subscriptions.map((subscription) => [subscription.id, subscription.client_name]),
  );

  const ledger = buildLedger(
    entries.map((entry) => ({
      ...entry,
      detail: entry.reference_month
        ? `gasto fixo de ${formatMonthLabel(monthStartOf(entry.reference_month))}`
        : entry.project_id
          ? (projectTitle.get(entry.project_id) ?? null)
          : null,
    })),
    payments.map((payment) => ({
      id: payment.id,
      subscription_id: payment.subscription_id,
      reference_month: payment.reference_month,
      amount: payment.amount,
      paid_on: payment.paid_on,
      clientName: clientBySubscription.get(payment.subscription_id) ?? "Recorrência",
      referenceLabel: `referente a ${formatMonthLabel(monthStartOf(payment.reference_month))}`,
    })),
  );

  // A minha parte de cada mês da sociedade entra na previsão como repasse a
  // receber (ou, no mês em que o lucro fica negativo, como conta).
  const partnershipForecasts = partnershipViews.map((view) =>
    partnershipForecast(
      { id: view.id, title: view.title, plan: view.plan },
      entriesOf(view.id),
      today,
      FORECAST_HORIZON,
    ),
  );
  const byDueDate = (a: { dueOn: string }, b: { dueOn: string }) => a.dueOn.localeCompare(b.dueOn);
  const charges = [
    ...forecastCharges(subscriptions, payments, today, FORECAST_HORIZON),
    ...partnershipForecasts.flatMap((forecast) => forecast.charges),
  ].sort(byDueDate);
  const bills = [
    ...forecastBills(recurringExpenses, entries, today, FORECAST_HORIZON),
    ...partnershipForecasts.flatMap((forecast) => forecast.bills),
  ].sort(byDueDate);

  // Repasses ligados a cada recorrência, para mostrar o líquido de cada uma.
  const activeExpenses = recurringExpenses.filter(
    (expense) => isRecurringExpenseActive(expense, currentMonth) || expense.started_on > today,
  );
  const shareBySubscription = new Map<string, number>();
  for (const expense of activeExpenses) {
    if (!expense.subscription_id) continue;
    shareBySubscription.set(
      expense.subscription_id,
      (shareBySubscription.get(expense.subscription_id) ?? 0) + toAmount(expense.amount),
    );
  }

  // Mês típico: o que a recorrência traz e o que sai fixo, sem os avulsos.
  const activeSubscriptions = subscriptions.filter(
    (subscription) => subscription.status === "ativa",
  );
  const fixedIncome = round(
    activeSubscriptions.reduce((sum, subscription) => sum + toAmount(subscription.amount), 0),
  );
  const fixedExpense = round(
    activeExpenses.reduce((sum, expense) => sum + toAmount(expense.amount), 0),
  );
  const notBilledYet = activeSubscriptions.filter(
    (subscription) => !isBillableMonth(subscription, currentMonth),
  );

  const paymentsBySubscription = new Map<string, SubscriptionPayment[]>();
  for (const payment of payments) {
    const list = paymentsBySubscription.get(payment.subscription_id) ?? [];
    list.push(payment);
    paymentsBySubscription.set(payment.subscription_id, list);
  }
  const subscriptionRows = subscriptions.map((subscription) => {
    const subscriptionPayments = paymentsBySubscription.get(subscription.id) ?? [];
    const state = getBillingState(subscription, subscriptionPayments, today);
    // Em dia, dá para adiantar o próximo mês; com meses em aberto, o
    // pagamento vai primeiro para eles.
    const payableMonths =
      state.openMonths.length > 0
        ? state.openMonths
        : state.nextDue
          ? [monthStartOf(state.nextDue)]
          : [];
    return { subscription, payments: subscriptionPayments, state, payableMonths };
  });
  const rowBySubscription = new Map(subscriptionRows.map((row) => [row.subscription.id, row]));

  const overdueCharges = charges.filter((charge) => charge.timing === "atrasado");
  const startingCash = settings
    ? cashBalance(ledger, settings.balance_amount, settings.balance_on, today)
    : cashBalance(ledger, 0, "0000-01-01", today);

  return {
    today,
    currentMonth,
    payments,
    entries,
    entryById: new Map(entries.map((entry) => [entry.id, entry])),
    recurringExpenses,
    settings,
    balances,
    ownOptions,
    partnershipViews,
    projectOptions,
    projectReceivable,
    clientBySubscription,
    ledger,
    charges,
    bills,
    overdueIncome: sumCharges(overdueCharges),
    activeExpenses,
    activeSubscriptions,
    shareBySubscription,
    fixedIncome,
    fixedExpense,
    notBilledYet,
    subscriptionRows,
    rowBySubscription,
    startingCash,
  };
});

export type FinanceData = Awaited<ReturnType<typeof loadFinanceData>>;
export type SubscriptionRow = FinanceData["subscriptionRows"][number];
