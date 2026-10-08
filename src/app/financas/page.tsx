import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Landmark,
  Repeat,
  Scale,
  Wallet,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageHeader } from "@/components/admin-page-header";
import { FinanceEntryDelete, FinanceEntrySheet } from "@/components/finance-entry-sheet";
import {
  FinanceBillPay,
  FinanceRecurringEnd,
  FinanceRecurringSheet,
} from "@/components/finance-recurring-sheet";
import { FinanceProjection } from "@/components/finance-projection";
import { FinanceProjectValueDialog } from "@/components/finance-project-value";
import {
  getFinanceEntries,
  getFinanceProjects,
  getFinanceSettings,
  getRecurringExpenses,
} from "@/app/actions/finance";
import { getSubscriptionsWithPayments } from "@/app/actions/subscriptions";
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
  sumCharges,
  type ForecastBill,
  type ForecastCharge,
  type LedgerLine,
} from "@/lib/finance";
import {
  addMonths,
  formatBrl,
  isBillableMonth,
  monthStartOf,
  todayInBrasilia,
  toAmount,
} from "@/lib/subscription-billing";
import { formatMonthLabel, formatShortDate } from "@/lib/subscription-format";
import { requireAuthenticatedUser } from "@/lib/supabase/require-authenticated-user";
import { cn } from "@/lib/utils";
import type { FinanceEntry, FinanceProjectOption } from "@/types/finance";

const MONTH_QUERY = /^(\d{4})-(\d{2})$/;
const FORECAST_HORIZON = 12;
const AHEAD_MONTHS = 5;

export default async function FinancasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { user } = await requireAuthenticatedUser();
  const params = await searchParams;
  const today = todayInBrasilia();
  const currentMonth = monthStartOf(today);
  const selectedMonth = resolveMonth(params.mes, currentMonth);

  const [{ subscriptions, payments }, entries, recurringExpenses, settings, projects] =
    await Promise.all([
      getSubscriptionsWithPayments(),
      getFinanceEntries(),
      getRecurringExpenses(),
      getFinanceSettings(),
      getFinanceProjects(),
    ]);

  const balances = projectBalances(projects, entries);
  const receivedByProject = new Map(balances.map((item) => [item.id, item.received]));
  const projectOptions: FinanceProjectOption[] = projects.map((project) => ({
    id: project.id,
    title: project.title,
    contractAmount: project.contract_amount === null ? null : toAmount(project.contract_amount),
    received: receivedByProject.get(project.id) ?? 0,
    receivedBefore: toAmount(project.received_before),
  }));
  const projectTitle = new Map(projects.map((project) => [project.id, project.title]));
  const projectReceivable = round(
    balances.reduce((sum, item) => sum + (item.remaining ?? 0), 0),
  );

  const clientBySubscription = new Map(
    subscriptions.map((subscription) => [subscription.id, subscription.client_name]),
  );
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));

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

  const charges = forecastCharges(subscriptions, payments, today, FORECAST_HORIZON);
  const bills = forecastBills(recurringExpenses, entries, today, FORECAST_HORIZON);

  // Repasses ligados a cada recorrência, para mostrar o líquido de cada uma.
  const activeExpenses = recurringExpenses.filter((expense) =>
    isRecurringExpenseActive(expense, currentMonth) || expense.started_on > today,
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

  const months = monthWindow(currentMonth, selectedMonth);
  const bars = months.map((month) => {
    const realized = monthTotals(linesInMonth(ledger, month));
    return {
      month,
      income: realized.income,
      expense: realized.expense,
      expectedIncome: sumCharges(chargesInMonth(charges, month)),
      expectedExpense: sumCharges(chargesInMonth(bills, month)),
    };
  });
  const maxBar = Math.max(
    1,
    ...bars.map((bar) =>
      Math.max(bar.income + bar.expectedIncome, bar.expense + bar.expectedExpense),
    ),
  );

  const monthLines = linesInMonth(ledger, selectedMonth);
  const totals = monthTotals(monthLines);
  const byCategory = expensesByCategory(monthLines);
  const monthCharges = chargesInMonth(charges, selectedMonth);
  const monthBills = chargesInMonth(bills, selectedMonth);
  const toReceive = sumCharges(monthCharges);
  const toPay = sumCharges(monthBills);
  const projected = round(totals.balance + toReceive - toPay);

  const overdueCharges = charges.filter((charge) => charge.timing === "atrasado");
  const overdueBills = bills.filter((bill) => bill.timing === "atrasado");
  // A projeção olha 12 meses; a lista "Pela frente" fica nos próximos meses.
  const aheadLimit = addMonths(currentMonth, AHEAD_MONTHS);
  const isAhead = (item: { timing: string; month: string }) =>
    item.timing === "futuro" && item.month !== selectedMonth && item.month <= aheadLimit;
  const ahead = groupAhead(charges.filter(isAhead), bills.filter(isAhead));

  const startingCash = settings
    ? cashBalance(ledger, settings.balance_amount, settings.balance_on, today)
    : cashBalance(ledger, 0, "0000-01-01", today);

  const monthTitle = capitalize(formatMonthLabel(selectedMonth));
  const isPast = selectedMonth < currentMonth;
  const subscriptionOptions = activeSubscriptions.map((subscription) => ({
    id: subscription.id,
    clientName: subscription.client_name,
  }));

  return (
    <AdminShell userEmail={user.email}>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-fluid">
        <AdminPageHeader
          icon={Wallet}
          title="Finanças"
          description="O que entrou e saiu em cada mês, o que ainda vai entrar e sair, e quanto sobra do que é fixo."
          activeHref="/financas"
          quickLinks={[
            { href: "/financas", label: "Caixa", icon: Wallet },
            { href: "/recorrencia", label: "Recorrência", icon: Repeat },
          ]}
          actions={<FinanceEntrySheet projects={projectOptions} />}
        />

        {overdueCharges.length > 0 || overdueBills.length > 0 ? (
          <div className="insyt-card space-y-2 border border-red-100 bg-red-50 px-5 py-4 text-red-800">
            {overdueCharges.length > 0 ? (
              <Link href="/recorrencia" className="flex items-start gap-3 hover:underline">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p className="text-sm">
                  <span className="font-semibold">
                    {formatBrl(sumCharges(overdueCharges))} a receber em atraso
                  </span>
                  {" · "}
                  {namesPreview(overdueCharges.map((charge) => charge.clientName))}. A
                  cobrança continua na recorrência.
                </p>
              </Link>
            ) : null}
            {overdueBills.length > 0 ? (
              <p className="flex items-start gap-3 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  <span className="font-semibold">
                    {formatBrl(sumCharges(overdueBills))} de gasto fixo vencido
                  </span>
                  {" · "}
                  {namesPreview(overdueBills.map((bill) => bill.description))}. Marque como
                  pago no mês em que venceu.
                </span>
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="insyt-card px-4 py-5 sm:px-6">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {bars.map((bar) => {
              const selected = bar.month === selectedMonth;
              const balance = round(bar.income - bar.expense);
              return (
                <Link
                  key={bar.month}
                  href={`/financas?mes=${bar.month.slice(0, 7)}`}
                  aria-current={selected ? "page" : undefined}
                  title={[
                    capitalize(formatMonthLabel(bar.month)),
                    `Entrou ${formatBrl(bar.income)}`,
                    `Saiu ${formatBrl(bar.expense)}`,
                    bar.expectedIncome > 0 ? `A receber ${formatBrl(bar.expectedIncome)}` : null,
                    bar.expectedExpense > 0 ? `A pagar ${formatBrl(bar.expectedExpense)}` : null,
                  ]
                    .filter(Boolean)
                    .join("\n")}
                  className={cn(
                    "flex min-w-[4.5rem] flex-1 flex-col items-center gap-2 rounded-2xl px-2 py-3 transition-colors",
                    selected
                      ? "bg-[var(--insyt-canvas)] ring-1 ring-[var(--insyt-border)]"
                      : "hover:bg-[var(--insyt-canvas)]/70",
                  )}
                >
                  <span
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-wider",
                      selected ? "text-[var(--insyt-black)]" : "text-[var(--insyt-muted)]",
                    )}
                  >
                    {shortMonth(bar.month)}
                  </span>
                  <span className="flex h-20 items-end gap-1">
                    <StackedBar
                      done={bar.income}
                      expected={bar.expectedIncome}
                      max={maxBar}
                      doneClass="bg-emerald-500"
                      expectedClass="bg-emerald-200"
                    />
                    <StackedBar
                      done={bar.expense}
                      expected={bar.expectedExpense}
                      max={maxBar}
                      doneClass="bg-stone-400"
                      expectedClass="bg-stone-200"
                    />
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-semibold tabular-nums",
                      bar.income === 0 && bar.expense === 0
                        ? "text-[var(--insyt-muted)]"
                        : balance < 0
                          ? "text-red-700"
                          : "text-[var(--insyt-slate)]",
                    )}
                  >
                    {bar.month === currentMonth
                      ? "agora"
                      : bar.income === 0 && bar.expense === 0
                        ? "—"
                        : compactBrl(balance)}
                  </span>
                </Link>
              );
            })}
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-2 text-[11px] text-[var(--insyt-muted)]">
            <Legend className="bg-emerald-500">Entrou</Legend>
            <Legend className="bg-emerald-200">A receber</Legend>
            <Legend className="bg-stone-400">Saiu</Legend>
            <Legend className="bg-stone-200">A pagar</Legend>
            <span className="ml-auto hidden sm:inline">Número embaixo: saldo do mês</span>
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            icon={ArrowDownLeft}
            label="Entrou"
            value={formatBrl(totals.income)}
            hint={
              toReceive > 0
                ? `+ ${formatBrl(toReceive)} ${isPast ? "ainda em aberto" : "a receber"}`
                : monthTitle
            }
            accent
          />
          <SummaryCard
            icon={ArrowUpRight}
            label="Saiu"
            value={formatBrl(totals.expense)}
            hint={
              toPay > 0
                ? `+ ${formatBrl(toPay)} ${isPast ? "ainda em aberto" : "a pagar"}`
                : monthTitle
            }
          />
          <SummaryCard
            icon={Scale}
            label="Saldo até agora"
            value={formatBrl(totals.balance)}
            hint={totals.balance < 0 ? "saiu mais do que entrou" : "entrou menos o que saiu"}
            danger={totals.balance < 0}
          />
          <SummaryCard
            icon={CalendarClock}
            label={isPast ? "Se tudo fosse pago" : "Fecha o mês em"}
            value={formatBrl(projected)}
            hint="saldo + a receber − a pagar"
            danger={projected < 0}
          />
        </div>

        <section className="insyt-card grid gap-6 px-6 py-5 sm:grid-cols-3">
          <FixedStat
            label="Recorrência por mês"
            value={formatBrl(fixedIncome)}
            hint={
              notBilledYet.length > 0
                ? `${activeSubscriptions.length} ativas · ${notBilledYet.length} começa${notBilledYet.length === 1 ? "" : "m"} depois`
                : `${activeSubscriptions.length} ${activeSubscriptions.length === 1 ? "ativa" : "ativas"}`
            }
          />
          <FixedStat
            label="Gastos fixos por mês"
            value={`− ${formatBrl(fixedExpense)}`}
            hint={`${activeExpenses.length} ${activeExpenses.length === 1 ? "gasto" : "gastos"} · imposto, repasse, ferramentas`}
          />
          <FixedStat
            label="Sobra fixa"
            value={formatBrl(round(fixedIncome - fixedExpense))}
            hint="o mínimo que fica todo mês, antes de projetos"
            strong
            danger={fixedIncome - fixedExpense < 0}
          />
        </section>

        <FinanceProjection
          today={today}
          startingCash={startingCash}
          reserve={settings ? toAmount(settings.reserve_amount) : 0}
          balanceOn={settings?.balance_on ?? null}
          hasBalance={Boolean(settings)}
          charges={charges}
          bills={bills}
          overdueIncome={sumCharges(overdueCharges)}
          projectReceivable={projectReceivable}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            title="A receber"
            subtitle={`recorrência ${isPast ? "em aberto" : "do mês"} · ${monthTitle.toLowerCase()}`}
            total={toReceive}
            empty="Nenhuma mensalidade em aberto neste mês."
          >
            {monthCharges.map((charge) => (
              <ChargeRow
                key={charge.id}
                charge={charge}
                share={shareBySubscription.get(charge.subscriptionId) ?? 0}
              />
            ))}
          </Panel>

          <Panel
            title="A pagar"
            subtitle={`gastos fixos ${isPast ? "em aberto" : "do mês"} · ${monthTitle.toLowerCase()}`}
            total={toPay}
            negative
            empty={
              recurringExpenses.length === 0
                ? "Nenhum gasto fixo cadastrado. Cadastre o DAS, repasses e ferramentas em Gastos fixos."
                : "Tudo pago neste mês."
            }
          >
            {monthBills.map((bill) => (
              <BillRow key={bill.id} bill={bill} />
            ))}
          </Panel>
        </div>

        <section className="insyt-card overflow-hidden">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--insyt-border)] px-6 py-4">
            <div>
              <h2 className="font-bold text-[var(--insyt-black)]">Projetos</h2>
              <p className="mt-1 text-xs text-[var(--insyt-muted)]">
                {projectReceivable > 0
                  ? `${formatBrl(projectReceivable)} ainda a receber de desenvolvimento`
                  : "valor fechado de cada site e quanto já entrou"}
              </p>
            </div>
            <FinanceProjectValueDialog projects={projectOptions} />
          </header>
          {balances.length === 0 ? (
            <p className="px-6 py-8 text-sm text-[var(--insyt-muted)]">
              Nenhum projeto com valor fechado. Informe o valor combinado e ligue as
              parcelas ao projeto quando lançar.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--insyt-border)]">
              {balances.map((balance) => {
                const option = projectOptions.find((item) => item.id === balance.id);
                const paidShare =
                  balance.contractAmount && balance.contractAmount > 0
                    ? Math.min(100, Math.round((balance.received / balance.contractAmount) * 100))
                    : 0;
                const settled = balance.remaining === 0;
                return (
                  <li
                    key={balance.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4"
                  >
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="truncate text-sm font-semibold text-[var(--insyt-black)]">
                        {balance.title}
                      </p>
                      <p className="truncate text-xs text-[var(--insyt-muted)]">
                        {balance.contractAmount !== null
                          ? `fechado ${formatBrl(balance.contractAmount)} · recebido ${formatBrl(balance.received)}${
                              option && option.receivedBefore > 0
                                ? ` (${formatBrl(option.receivedBefore)} antes do sistema)`
                                : ""
                            }`
                          : `recebido ${formatBrl(balance.received)} · sem valor fechado`}
                        {balance.spent > 0 ? ` · custos ${formatBrl(balance.spent)}` : ""}
                      </p>
                      {balance.contractAmount !== null ? (
                        <div className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-[var(--insyt-canvas)]">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${paidShare}%` }}
                          />
                        </div>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          "text-sm font-bold tabular-nums",
                          settled ? "text-emerald-800" : "text-[var(--insyt-black)]",
                        )}
                      >
                        {balance.remaining === null
                          ? "—"
                          : settled
                            ? "Quitado"
                            : `falta ${formatBrl(balance.remaining)}`}
                      </p>
                      {balance.spent > 0 ? (
                        <p className="text-xs text-[var(--insyt-muted)]">
                          margem {formatBrl(round(balance.received - balance.spent))}
                        </p>
                      ) : null}
                    </div>
                    <span className="flex items-center gap-1">
                      {option && !settled ? (
                        <FinanceEntrySheet projects={projectOptions} receiveProject={option} />
                      ) : null}
                      {option ? (
                        <FinanceProjectValueDialog projects={projectOptions} project={option} />
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="insyt-card overflow-hidden lg:col-span-2">
            <header className="flex items-baseline justify-between gap-3 border-b border-[var(--insyt-border)] px-6 py-4">
              <div>
                <h2 className="font-bold text-[var(--insyt-black)]">Movimentos</h2>
                <p className="mt-1 text-xs text-[var(--insyt-muted)]">
                  {monthTitle} · {monthLines.length}{" "}
                  {monthLines.length === 1 ? "lançamento" : "lançamentos"}
                </p>
              </div>
            </header>
            {monthLines.length === 0 ? (
              <p className="px-6 py-10 text-sm text-[var(--insyt-muted)]">
                Nada neste mês. Parcelas de projeto e gastos avulsos entram pelo botão
                Lançar. Mensalidade paga e gasto fixo marcado como pago aparecem aqui
                sozinhos.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--insyt-border)]">
                {monthLines.map((line) => (
                  <MovementRow
                    key={`${line.source}:${line.id}`}
                    line={line}
                    entry={line.source === "lancamento" ? entryById.get(line.id) : undefined}
                    projects={projectOptions}
                  />
                ))}
              </ul>
            )}
          </section>

          <div className="space-y-4">
            <section className="insyt-card overflow-hidden">
              <header className="border-b border-[var(--insyt-border)] px-6 py-4">
                <h2 className="font-bold text-[var(--insyt-black)]">Para onde foi</h2>
                <p className="mt-1 text-xs text-[var(--insyt-muted)]">
                  saídas de {monthTitle.toLowerCase()} por categoria
                </p>
              </header>
              {byCategory.length === 0 ? (
                <p className="px-6 py-8 text-sm text-[var(--insyt-muted)]">
                  Nenhuma saída neste mês.
                </p>
              ) : (
                <ul className="space-y-3 px-6 py-5">
                  {byCategory.map((item) => (
                    <li key={item.category}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-[var(--insyt-slate)]">{item.category}</span>
                        <span className="font-semibold tabular-nums text-[var(--insyt-black)]">
                          {formatBrl(item.amount)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--insyt-canvas)]">
                        <div
                          className="h-full rounded-full bg-stone-400"
                          style={{
                            width: `${Math.max(4, Math.round((item.amount / totals.expense) * 100))}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="insyt-card overflow-hidden">
              <header className="flex items-start justify-between gap-3 border-b border-[var(--insyt-border)] px-6 py-4">
                <div>
                  <h2 className="font-bold text-[var(--insyt-black)]">Gastos fixos</h2>
                  <p className="mt-1 text-xs text-[var(--insyt-muted)]">
                    o que sai todo mês
                  </p>
                </div>
                <FinanceRecurringSheet subscriptions={subscriptionOptions} />
              </header>
              {recurringExpenses.length === 0 ? (
                <p className="px-6 py-8 text-sm text-[var(--insyt-muted)]">
                  Nenhum gasto fixo ainda.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--insyt-border)]">
                  {recurringExpenses.map((expense) => {
                    const ended = Boolean(expense.ended_on && expense.ended_on <= today);
                    const linkedTo = expense.subscription_id
                      ? clientBySubscription.get(expense.subscription_id)
                      : null;
                    return (
                      <li
                        key={expense.id}
                        className={cn("flex items-center gap-2 px-6 py-3", ended && "opacity-50")}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[var(--insyt-black)]">
                            {expense.description}
                          </p>
                          <p className="truncate text-xs text-[var(--insyt-muted)]">
                            {ended
                              ? `encerrado em ${formatShortDate(expense.ended_on!)}`
                              : `todo dia ${expense.due_day}`}
                            {" · "}
                            {expense.category}
                            {linkedTo ? ` · de ${linkedTo}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-bold tabular-nums text-[var(--insyt-black)]">
                          {formatBrl(expense.amount)}
                        </span>
                        <FinanceRecurringSheet
                          expense={expense}
                          subscriptions={subscriptionOptions}
                        />
                        {ended ? null : (
                          <FinanceRecurringEnd
                            id={expense.id}
                            description={expense.description}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>

        <section className="insyt-card overflow-hidden">
          <header className="border-b border-[var(--insyt-border)] px-6 py-4">
            <h2 className="font-bold text-[var(--insyt-black)]">Pela frente</h2>
            <p className="mt-1 text-xs text-[var(--insyt-muted)]">
              O que a recorrência traz e os gastos fixos levam nos próximos meses.
            </p>
          </header>
          {ahead.length === 0 ? (
            <p className="px-6 py-10 text-sm text-[var(--insyt-muted)]">
              Nada previsto além do mês selecionado.
            </p>
          ) : (
            <div className="grid divide-y divide-[var(--insyt-border)] md:grid-cols-2 md:divide-y-0 xl:grid-cols-3">
              {ahead.map(({ month, charges: monthIn, bills: monthOut }) => {
                const income = sumCharges(monthIn);
                const expense = sumCharges(monthOut);
                return (
                  <div
                    key={month}
                    className="px-6 py-5 md:border-b md:border-[var(--insyt-border)]"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <Link
                        href={`/financas?mes=${month.slice(0, 7)}`}
                        className="text-sm font-semibold text-[var(--insyt-black)] hover:text-[var(--insyt-primary)]"
                      >
                        {capitalize(formatMonthLabel(month))}
                      </Link>
                      <span
                        className={cn(
                          "text-sm font-bold tabular-nums",
                          income - expense < 0 ? "text-red-700" : "text-[var(--insyt-black)]",
                        )}
                      >
                        {formatBrl(round(income - expense))}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--insyt-muted)]">
                      entra {formatBrl(income)} · sai {formatBrl(expense)}
                    </p>
                    <ul className="mt-3 space-y-1">
                      {monthIn.map((charge) => (
                        <AheadItem
                          key={charge.id}
                          label={charge.clientName}
                          dueOn={charge.dueOn}
                          amount={charge.amount}
                        />
                      ))}
                      {monthOut.map((bill) => (
                        <AheadItem
                          key={bill.id}
                          label={bill.description}
                          dueOn={bill.dueOn}
                          amount={bill.amount}
                          negative
                        />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}

function Panel({
  title,
  subtitle,
  total,
  negative = false,
  empty,
  children,
}: {
  title: string;
  subtitle: string;
  total: number;
  negative?: boolean;
  empty: string;
  children: ReactNode[];
}) {
  return (
    <section className="insyt-card overflow-hidden">
      <header className="flex items-baseline justify-between gap-3 border-b border-[var(--insyt-border)] px-6 py-4">
        <div>
          <h2 className="font-bold text-[var(--insyt-black)]">{title}</h2>
          <p className="mt-1 text-xs text-[var(--insyt-muted)]">{subtitle}</p>
        </div>
        {total > 0 ? (
          <span className="text-sm font-bold tabular-nums text-[var(--insyt-black)]">
            {negative ? "− " : ""}
            {formatBrl(total)}
          </span>
        ) : null}
      </header>
      {children.length === 0 ? (
        <p className="px-6 py-10 text-sm text-[var(--insyt-muted)]">{empty}</p>
      ) : (
        <ul className="divide-y divide-[var(--insyt-border)]">{children}</ul>
      )}
    </section>
  );
}

function MovementRow({
  line,
  entry,
  projects,
}: {
  line: LedgerLine;
  entry?: FinanceEntry;
  projects: FinanceProjectOption[];
}) {
  const incoming = line.kind === "entrada";
  return (
    <li className="flex items-center gap-3 px-6 py-4">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          incoming ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600",
        )}
      >
        {incoming ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--insyt-black)]">
          {line.description}
        </p>
        <p className="truncate text-xs text-[var(--insyt-muted)]">
          {formatShortDate(line.occurredOn)} · {line.category}
          {line.detail ? ` · ${line.detail}` : ""}
        </p>
      </div>
      <p
        className={cn(
          "shrink-0 text-sm font-bold tabular-nums",
          incoming ? "text-emerald-800" : "text-[var(--insyt-black)]",
        )}
      >
        {incoming ? "" : "−"}
        {formatBrl(line.amount)}
      </p>
      {entry ? (
        <span className="flex shrink-0 items-center">
          <FinanceEntrySheet entry={entry} projects={projects} />
          <FinanceEntryDelete id={entry.id} label={entry.description} />
        </span>
      ) : (
        <Link
          href="/recorrencia"
          title="Pagamento da recorrência: edite na recorrência"
          className="shrink-0 px-2 text-xs font-semibold text-[var(--insyt-primary)] hover:underline"
        >
          Abrir
        </Link>
      )}
    </li>
  );
}

function ChargeRow({ charge, share }: { charge: ForecastCharge; share: number }) {
  const late = charge.timing === "atrasado";
  return (
    <li className="flex items-center gap-3 px-6 py-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--insyt-black)]">
          {charge.clientName}
        </p>
        <p className="truncate text-xs text-[var(--insyt-muted)]">
          vence {formatShortDate(charge.dueOn)}
          {late ? <span className="text-red-700"> · atrasado</span> : ""}
          {share > 0 ? ` · líquido ${formatBrl(round(charge.amount - share))} após repasse` : ""}
        </p>
      </div>
      <p
        className={cn(
          "shrink-0 text-sm font-bold tabular-nums",
          late ? "text-red-700" : "text-[var(--insyt-black)]",
        )}
      >
        {formatBrl(charge.amount)}
      </p>
      <Link
        href="/recorrencia"
        className="shrink-0 text-xs font-semibold text-[var(--insyt-primary)] hover:underline"
      >
        Abrir
      </Link>
    </li>
  );
}

function BillRow({ bill }: { bill: ForecastBill }) {
  const late = bill.timing === "atrasado";
  return (
    <li className="flex items-center gap-3 px-6 py-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--insyt-black)]">
          {bill.description}
        </p>
        <p className="truncate text-xs text-[var(--insyt-muted)]">
          vence {formatShortDate(bill.dueOn)} · {bill.category}
          {late ? <span className="text-red-700"> · vencido</span> : ""}
        </p>
      </div>
      <p
        className={cn(
          "shrink-0 text-sm font-bold tabular-nums",
          late ? "text-red-700" : "text-[var(--insyt-black)]",
        )}
      >
        −{formatBrl(bill.amount)}
      </p>
      <FinanceBillPay expenseId={bill.expenseId} month={bill.month} />
    </li>
  );
}

function AheadItem({
  label,
  dueOn,
  amount,
  negative = false,
}: {
  label: string;
  dueOn: string;
  amount: number;
  negative?: boolean;
}) {
  return (
    <li className="flex items-baseline justify-between gap-3 text-sm text-[var(--insyt-slate)]">
      <span className="min-w-0 truncate">
        {label}
        <span className="text-[var(--insyt-muted)]"> · dia {dueOn.slice(8, 10)}</span>
      </span>
      <span className={cn("shrink-0 tabular-nums", negative ? "" : "text-emerald-800")}>
        {negative ? "−" : ""}
        {formatBrl(amount)}
      </span>
    </li>
  );
}

function StackedBar({
  done,
  expected,
  max,
  doneClass,
  expectedClass,
}: {
  done: number;
  expected: number;
  max: number;
  doneClass: string;
  expectedClass: string;
}) {
  const doneHeight = done > 0 ? Math.max(6, Math.round((done / max) * 80)) : 0;
  const expectedHeight = expected > 0 ? Math.max(6, Math.round((expected / max) * 80)) : 0;
  if (doneHeight === 0 && expectedHeight === 0) {
    return <span className="h-1 w-2 rounded-full bg-[var(--insyt-border)]" />;
  }
  return (
    <span className="flex w-2 flex-col overflow-hidden rounded-full">
      {expectedHeight > 0 ? (
        <span className={expectedClass} style={{ height: expectedHeight }} />
      ) : null}
      {doneHeight > 0 ? <span className={doneClass} style={{ height: doneHeight }} /> : null}
    </span>
  );
}

function Legend({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", className)} />
      {children}
    </span>
  );
}

function FixedStat({
  label,
  value,
  hint,
  strong = false,
  danger = false,
}: {
  label: string;
  value: string;
  hint: string;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      {strong ? (
        <Landmark className="mt-0.5 size-4 shrink-0 text-[var(--insyt-primary)]" />
      ) : null}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--insyt-muted)]">
          {label}
        </p>
        <p
          className={cn(
            "mt-1 text-xl font-bold tabular-nums tracking-tight",
            danger ? "text-red-700" : "text-[var(--insyt-black)]",
          )}
        >
          {value}
        </p>
        <p className="mt-0.5 text-xs text-[var(--insyt-muted)]">{hint}</p>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = false,
  danger = false,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="insyt-card p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--insyt-muted)]">
          {label}
        </p>
        <Icon
          className={cn(
            "size-5",
            danger
              ? "text-red-600"
              : accent
                ? "text-[var(--insyt-primary)]"
                : "text-[var(--insyt-slate)]",
          )}
        />
      </div>
      <p
        className={cn(
          "mt-3 text-3xl font-bold tabular-nums tracking-tight",
          danger ? "text-red-700" : "text-[var(--insyt-black)]",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-[var(--insyt-muted)]">{hint}</p>
    </div>
  );
}

function resolveMonth(raw: string | undefined, currentMonth: string) {
  const match = raw?.match(MONTH_QUERY);
  if (!match) return currentMonth;
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) return currentMonth;
  return `${match[1]}-${match[2]}-01`;
}

function monthWindow(currentMonth: string, selectedMonth: string) {
  let start = addMonths(currentMonth, -5);
  let end = addMonths(currentMonth, 3);
  if (selectedMonth < start) start = selectedMonth;
  if (selectedMonth > end) end = selectedMonth;
  const months: string[] = [];
  for (let month = start; month <= end; month = addMonths(month, 1)) {
    months.push(month);
  }
  return months;
}

function shortMonth(month: string) {
  const label = format(parseISO(month), "MMM", { locale: ptBR }).replace(".", "");
  return capitalize(label);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

/** "R$ 1,2 mil" no gráfico, onde não cabe o valor inteiro. */
function compactBrl(value: number) {
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return `${sign}${(abs / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  }
  return `${sign}${Math.round(abs).toLocaleString("pt-BR")}`;
}

function namesPreview(names: string[]) {
  const unique = [...new Set(names)];
  const shown = unique.slice(0, 3).join(", ");
  return unique.length > 3 ? `${shown} e mais ${unique.length - 3}` : shown;
}

function groupAhead(charges: ForecastCharge[], bills: ForecastBill[]) {
  const groups = new Map<string, { charges: ForecastCharge[]; bills: ForecastBill[] }>();
  const groupFor = (month: string) => {
    const group = groups.get(month) ?? { charges: [], bills: [] };
    groups.set(month, group);
    return group;
  };
  for (const charge of charges) groupFor(charge.month).charges.push(charge);
  for (const bill of bills) groupFor(bill.month).bills.push(bill);
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, group]) => ({ month, ...group }));
}
