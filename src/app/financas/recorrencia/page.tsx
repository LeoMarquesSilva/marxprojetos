import Link from "next/link";
import { ChevronRight, Globe } from "lucide-react";
import { FinanceEntrySheet } from "@/components/finance-entry-sheet";
import { FinanceInstallmentChips } from "@/components/finance-installments";
import { FinanceRecurringSheet } from "@/components/finance-recurring-sheet";
import {
  BillSettle,
  BillSettleOptions,
  ChargeSettle,
  InstallmentSettle,
} from "@/components/finance-settle";
import {
  FinanceChip,
  FinanceEmpty,
  FinanceKpi,
  FinanceKpiGrid,
  FinanceSection,
} from "@/components/finance-ui";
import { SubscriptionFormSheet } from "@/components/subscription-form-sheet";
import { SubscriptionPaymentSheet } from "@/components/subscription-payment-sheet";
import { SubscriptionPlansSheet } from "@/components/subscription-plans-sheet";
import { getSubscriptionFormData } from "@/app/actions/subscriptions";
import {
  isRecurringExpenseActive,
  openItemsForMonth,
  sumCharges,
  type ForecastBill,
} from "@/lib/finance";
import { loadFinanceData, type SubscriptionRow } from "@/lib/finance-page-data";
import type { InstallmentState } from "@/lib/project-schedule";
import {
  dueDateFor,
  dueLabel,
  formatBrl,
  paymentTrail,
  sortByUrgency,
  summarizeRecurrence,
  toAmount,
  type CurrentMonthStatus,
  type TrailMonth,
} from "@/lib/subscription-billing";
import {
  formatMonthLabel,
  formatShortDate,
  formatShortMonth,
} from "@/lib/subscription-format";
import { cn } from "@/lib/utils";
import type { FinanceProjectOption, FinanceRecurringExpense } from "@/types/finance";
import {
  PAYMENT_METHODS,
  SUBSCRIPTION_STATUS_LABELS,
  type SubscriptionClientOption,
  type SubscriptionPlan,
  type SubscriptionSiteOption,
} from "@/types/subscription";

const MONTH_STATUS: Record<
  CurrentMonthStatus,
  { label: string; tone: "good" | "open" | "late" | "neutral" }
> = {
  pago: { label: "Pago", tone: "good" },
  pendente: { label: "A vencer", tone: "open" },
  atrasado: { label: "Atrasado", tone: "late" },
  sem_cobranca: { label: "Sem cobrança", tone: "neutral" },
};

export default async function RecorrenciaPage() {
  const [data, { clients, sites, plans }] = await Promise.all([
    loadFinanceData(),
    getSubscriptionFormData(),
  ]);
  const {
    today,
    currentMonth,
    subscriptionRows,
    recurringExpenses,
    activeExpenses,
    activeSubscriptions,
    notBilledYet,
    fixedIncome,
    fixedExpense,
    bills,
    charges,
    clientBySubscription,
    shareBySubscription,
    ownOptions,
    projectOptions,
    scheduleByProject,
  } = data;

  const monthName = formatMonthLabel(currentMonth).split(" de ")[0];

  // Implantações parceladas: têm fim, então ficam em bloco próprio e não somam
  // em "Entra por mês" nem na sobra fixa, para esses números seguirem valendo.
  const installmentProjects = ownOptions.flatMap((project) => {
    const states = scheduleByProject.get(project.id) ?? [];
    const next = states.find((state) => state.open > 0);
    return next ? [{ project, states, next }] : [];
  });
  const installmentsOpen = installmentProjects.reduce(
    (total, { states }) => total + states.reduce((sum, state) => sum + state.open, 0),
    0,
  );
  const installmentsThisMonth = sumCharges(
    openItemsForMonth(
      charges.filter((charge) => charge.parcela),
      currentMonth,
      currentMonth,
    ),
  );
  const summary = summarizeRecurrence(
    subscriptionRows.map(({ subscription, payments }) => ({ subscription, payments })),
    today,
  );

  // Quantos clientes ativos em cada plano/adicional, para o catálogo.
  const planUsage: Record<string, number> = {};
  for (const subscription of activeSubscriptions) {
    for (const id of [subscription.plan_id, ...subscription.addon_ids]) {
      if (id) planUsage[id] = (planUsage[id] ?? 0) + 1;
    }
  }

  // Cancelada só sai da frente depois de quitada: quem ainda deve continua na lista.
  const sorted = sortByUrgency(subscriptionRows);
  const isSettledCancel = ({ subscription, state }: SubscriptionRow) =>
    subscription.status === "cancelada" && state.openMonths.length === 0;
  const visibleRows = sorted.filter((row) => !isSettledCancel(row));
  const canceledRows = sorted.filter(isSettledCancel);

  const isEnded = (expense: FinanceRecurringExpense) =>
    Boolean(expense.ended_on && expense.ended_on <= today);
  const runningExpenses = recurringExpenses.filter((expense) => !isEnded(expense));
  const endedExpenses = recurringExpenses.filter(isEnded);
  const subscriptionOptions = activeSubscriptions.map((subscription) => ({
    id: subscription.id,
    clientName: subscription.client_name,
  }));

  const leftover = Math.round((fixedIncome - fixedExpense) * 100) / 100;

  return (
    <div className="space-y-6">
      <section className="insyt-card overflow-hidden">
        <FinanceKpiGrid>
          <FinanceKpi
            label="Entra por mês"
            value={formatBrl(fixedIncome)}
            hint={
              <>
                {notBilledYet.length > 0
                  ? `${activeSubscriptions.length} ativas · ${notBilledYet.length} começa${notBilledYet.length === 1 ? "" : "m"} depois`
                  : `${activeSubscriptions.length} ${activeSubscriptions.length === 1 ? "assinatura ativa" : "assinaturas ativas"}`}
                {installmentsThisMonth > 0
                  ? ` · + ${formatBrl(installmentsThisMonth)} de parcelas em ${monthName}`
                  : ""}
              </>
            }
          />
          <FinanceKpi
            label="Sai por mês"
            value={`−${formatBrl(fixedExpense)}`}
            hint={`${activeExpenses.length} ${activeExpenses.length === 1 ? "gasto fixo" : "gastos fixos"}`}
          />
          <FinanceKpi
            label="Sobra fixa"
            value={formatBrl(leftover)}
            tone={leftover < 0 ? "danger" : "default"}
            hint="o mínimo que fica, antes de projetos"
          />
          <FinanceKpi
            label={`Recebido em ${monthName}`}
            value={formatBrl(summary.receivedThisMonth)}
            hintTone={summary.overdueTotal > 0 ? "danger" : "default"}
            hint={
              summary.overdueTotal > 0
                ? `${formatBrl(summary.overdueTotal)} em atraso · ${summary.overdueClients} ${summary.overdueClients === 1 ? "cliente" : "clientes"}`
                : summary.toReceiveThisMonth > 0
                  ? `falta ${formatBrl(summary.toReceiveThisMonth)} de mensalidades · ninguém atrasado`
                  : "todas as mensalidades recebidas"
            }
          />
        </FinanceKpiGrid>
      </section>

      <FinanceSection
        title="Entra todo mês"
        subtitle="Quem deve aparece primeiro, depois quem vai vencer e quem já pagou."
        action={
          <span className="flex flex-wrap items-center gap-2">
            <SubscriptionPlansSheet plans={plans} usage={planUsage} />
            <SubscriptionFormSheet clients={clients} sites={sites} plans={plans} />
          </span>
        }
      >
        {subscriptionRows.length === 0 ? (
          <FinanceEmpty>
            Nenhuma assinatura ainda. Cadastre o plano mensal de cada cliente para acompanhar aqui
            quem pagou, quem está devendo e quanto entra por mês.
          </FinanceEmpty>
        ) : (
          <ul className="divide-y divide-[var(--insyt-border)]">
            {visibleRows.map((row) => (
              <SubscriptionItem
                key={row.subscription.id}
                row={row}
                today={today}
                currentMonth={currentMonth}
                plans={plans}
                sites={sites}
                clients={clients}
                share={shareBySubscription.get(row.subscription.id) ?? 0}
              />
            ))}
          </ul>
        )}
        {canceledRows.length > 0 ? (
          <Collapsed label={`Canceladas (${canceledRows.length})`}>
            <ul className="divide-y divide-[var(--insyt-border)]">
              {canceledRows.map((row) => (
                <SubscriptionItem
                  key={row.subscription.id}
                  row={row}
                  today={today}
                  currentMonth={currentMonth}
                  plans={plans}
                  sites={sites}
                  clients={clients}
                  share={0}
                />
              ))}
            </ul>
          </Collapsed>
        ) : null}
      </FinanceSection>

      {installmentProjects.length > 0 ? (
        <FinanceSection
          title="Entra por um tempo"
          subtitle="Implantações parceladas. Têm fim, então não somam em Entra por mês nem na Sobra fixa."
          action={
            <span className="text-sm font-bold tabular-nums text-[var(--insyt-black)]">
              {formatBrl(installmentsOpen)}
            </span>
          }
        >
          <ul className="divide-y divide-[var(--insyt-border)]">
            {installmentProjects.map(({ project, states, next }) => (
              <InstallmentItem
                key={project.id}
                project={project}
                states={states}
                next={next}
                today={today}
                projectOptions={projectOptions}
              />
            ))}
          </ul>
        </FinanceSection>
      ) : null}

      <FinanceSection
        title="Sai todo mês"
        subtitle="Imposto, repasses e ferramentas. Cada mês fica em aberto até você marcar como pago."
        action={<FinanceRecurringSheet subscriptions={subscriptionOptions} />}
      >
        {recurringExpenses.length === 0 ? (
          <FinanceEmpty>
            Nenhum gasto fixo ainda. Cadastre o DAS, repasses e ferramentas para a projeção saber o
            que sai todo mês.
          </FinanceEmpty>
        ) : (
          <ul className="divide-y divide-[var(--insyt-border)]">
            {runningExpenses.map((expense) => (
              <ExpenseItem
                key={expense.id}
                expense={expense}
                today={today}
                currentMonth={currentMonth}
                bills={bills}
                linkedTo={
                  expense.subscription_id
                    ? clientBySubscription.get(expense.subscription_id)
                    : undefined
                }
                subscriptionOptions={subscriptionOptions}
              />
            ))}
          </ul>
        )}
        {endedExpenses.length > 0 ? (
          <Collapsed label={`Encerrados (${endedExpenses.length})`}>
            <ul className="divide-y divide-[var(--insyt-border)]">
              {endedExpenses.map((expense) => (
                <ExpenseItem
                  key={expense.id}
                  expense={expense}
                  today={today}
                  currentMonth={currentMonth}
                  bills={bills}
                  linkedTo={
                    expense.subscription_id
                      ? clientBySubscription.get(expense.subscription_id)
                      : undefined
                  }
                  subscriptionOptions={subscriptionOptions}
                />
              ))}
            </ul>
          </Collapsed>
        ) : null}
      </FinanceSection>
    </div>
  );
}

function InstallmentItem({
  project,
  states,
  next,
  today,
  projectOptions,
}: {
  project: FinanceProjectOption;
  states: InstallmentState[];
  next: InstallmentState;
  today: string;
  projectOptions: FinanceProjectOption[];
}) {
  const due = dueLabel(next.dueOn, today);
  const late = next.status === "atrasado";

  return (
    <li className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 sm:px-6">
      <div className="min-w-0 flex-1 basis-64">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold text-[var(--insyt-black)]">{project.title}</span>
          {late ? (
            <FinanceChip tone="late">Atrasada</FinanceChip>
          ) : next.status === "a_vencer" ? (
            <FinanceChip tone="open">A vencer</FinanceChip>
          ) : (
            <FinanceChip tone="neutral">Próxima</FinanceChip>
          )}
        </div>
        <p className="mt-1 text-xs text-[var(--insyt-muted)]">
          {next.name} ·{" "}
          <span className={cn(late && "font-semibold text-red-700")}>{due.text}</span>
        </p>
        <div className="mt-2">
          <FinanceInstallmentChips states={states} />
        </div>
      </div>

      <p
        className={cn(
          "shrink-0 font-bold tabular-nums tracking-tight",
          late ? "text-red-700" : "text-[var(--insyt-black)]",
        )}
      >
        {formatBrl(next.open)}
      </p>

      <span className="ml-auto flex shrink-0 items-center gap-1">
        {next.status !== "futuro" ? (
          <InstallmentSettle
            projectId={project.id}
            projectTitle={project.title}
            name={next.name}
            amount={next.open}
          />
        ) : null}
        <FinanceEntrySheet
          projects={projectOptions}
          receiveProject={project}
          defaultAmount={next.open}
          defaultDescription={`${project.title} — ${next.name}`}
          iconOnly
        />
      </span>
    </li>
  );
}

function SubscriptionItem({
  row,
  today,
  currentMonth,
  plans,
  sites,
  clients,
  share,
}: {
  row: SubscriptionRow;
  today: string;
  currentMonth: string;
  plans: SubscriptionPlan[];
  sites: SubscriptionSiteOption[];
  clients: SubscriptionClientOption[];
  share: number;
}) {
  const { subscription, payments, state, payableMonths } = row;
  const canceled = subscription.status === "cancelada";
  const monthStatus = MONTH_STATUS[state.currentStatus];
  const oldestOpen = state.openMonths[0];
  const overdue = state.overdueMonths.length > 0;

  const planLabel = [
    plans.find((plan) => plan.id === subscription.plan_id)?.name ?? subscription.plan_name,
    ...subscription.addon_ids.map((id) => plans.find((plan) => plan.id === id)?.name),
  ]
    .filter(Boolean)
    .join(" + ");
  const coveredSites = subscription.project_ids
    .map((id) => sites.find((site) => site.id === id))
    .filter((site) => site !== undefined);

  const dueText =
    canceled && subscription.ended_on && !oldestOpen
      ? `cancelada em ${formatShortDate(subscription.ended_on)}`
      : oldestOpen
        ? dueLabel(dueDateFor(oldestOpen, subscription.billing_day), today).text
        : state.nextDue
          ? `próximo ${state.nextDue.slice(8, 10)}/${state.nextDue.slice(5, 7)}`
          : `todo dia ${subscription.billing_day}`;

  return (
    <li
      id={`assinatura-${subscription.id}`}
      className={cn(
        "flex scroll-mt-6 flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 sm:px-6",
        canceled && !oldestOpen && "opacity-60",
      )}
    >
      <div className="min-w-0 flex-1 basis-64">
        <div className="flex flex-wrap items-center gap-2">
          {subscription.crm_client_id ? (
            <Link
              href={`/crm/${subscription.crm_client_id}`}
              className="truncate font-semibold text-[var(--insyt-black)] hover:text-[var(--insyt-primary-dark)]"
            >
              {subscription.client_name}
            </Link>
          ) : (
            <span className="truncate font-semibold text-[var(--insyt-black)]">
              {subscription.client_name}
            </span>
          )}
          {canceled ? (
            <FinanceChip tone="neutral">{SUBSCRIPTION_STATUS_LABELS.cancelada}</FinanceChip>
          ) : (
            <FinanceChip tone={overdue ? "late" : monthStatus.tone}>
              {overdue && state.currentStatus !== "atrasado" ? "Atrasado" : monthStatus.label}
            </FinanceChip>
          )}
          {state.overdueMonths.length > 1 ? (
            <span className="text-[11px] font-semibold text-red-700">
              {state.overdueMonths.length} meses em aberto
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-[var(--insyt-muted)]">
          <span className={cn(overdue && "font-semibold text-red-700")}>{dueText}</span>
          {" · "}
          {planLabel}
          {subscription.description ? ` · ${subscription.description}` : ""}
          {subscription.payment_method ? ` · ${subscription.payment_method}` : ""}
        </p>
        {coveredSites.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {coveredSites.map((site) => (
              <Link
                key={site.id}
                href={`/sites/${site.id}`}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--insyt-slate)] hover:text-[var(--insyt-primary-dark)]"
              >
                <Globe className="size-3" />
                {site.title}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <PaymentTrail trail={paymentTrail(subscription, payments, today)} />

      <p className="shrink-0 text-right">
        <span className="block font-bold tabular-nums tracking-tight text-[var(--insyt-black)]">
          {formatBrl(subscription.amount)}
        </span>
        {share > 0 ? (
          <span className="block text-[11px] text-[var(--insyt-muted)]">
            líquido {formatBrl(toAmount(subscription.amount) - share)}
          </span>
        ) : null}
      </p>

      <span className="ml-auto flex shrink-0 items-center gap-1">
        {oldestOpen ? (
          <ChargeSettle
            subscriptionId={subscription.id}
            clientName={subscription.client_name}
            month={oldestOpen}
            amount={toAmount(subscription.amount)}
            method={subscription.payment_method ?? PAYMENT_METHODS[0]}
            label={oldestOpen === currentMonth ? "Recebi" : `Recebi ${formatShortMonth(oldestOpen)}`}
          />
        ) : null}
        <SubscriptionPaymentSheet
          subscription={subscription}
          payments={payments}
          payableMonths={payableMonths}
        />
        <SubscriptionFormSheet
          subscription={subscription}
          clients={clients}
          sites={sites}
          plans={plans}
        />
      </span>
    </li>
  );
}

function ExpenseItem({
  expense,
  today,
  currentMonth,
  bills,
  linkedTo,
  subscriptionOptions,
}: {
  expense: FinanceRecurringExpense;
  today: string;
  currentMonth: string;
  bills: ForecastBill[];
  linkedTo?: string;
  subscriptionOptions: { id: string; clientName: string }[];
}) {
  const ended = Boolean(expense.ended_on && expense.ended_on <= today);
  const open = bills.filter((bill) => bill.expenseId === expense.id && bill.timing !== "futuro");
  const oldest = open[0];
  const overdue = oldest?.timing === "atrasado";
  const billedNow = isRecurringExpenseActive(expense, currentMonth);

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 sm:px-6",
        ended && !oldest && "opacity-60",
      )}
    >
      <div className="min-w-0 flex-1 basis-64">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold text-[var(--insyt-black)]">
            {expense.description}
          </span>
          {oldest ? (
            <FinanceChip tone={overdue ? "late" : "open"}>
              {overdue ? "Vencido" : "A pagar"}
            </FinanceChip>
          ) : billedNow && !ended ? (
            <FinanceChip tone="good">Pago</FinanceChip>
          ) : null}
          {open.filter((bill) => bill.timing === "atrasado").length > 1 ? (
            <span className="text-[11px] font-semibold text-red-700">
              {open.filter((bill) => bill.timing === "atrasado").length} meses em aberto
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-[var(--insyt-muted)]">
          <span className={cn(overdue && "font-semibold text-red-700")}>
            {ended
              ? `encerrado em ${formatShortDate(expense.ended_on!)}`
              : oldest
                ? dueLabel(oldest.dueOn, today).text
                : `todo dia ${expense.due_day}`}
          </span>
          {" · "}
          {expense.category}
          {linkedTo ? ` · de ${linkedTo}` : ""}
        </p>
      </div>

      <p className="shrink-0 font-bold tabular-nums tracking-tight text-[var(--insyt-black)]">
        −{formatBrl(expense.amount)}
      </p>

      <span className="ml-auto flex shrink-0 items-center gap-1">
        {oldest ? (
          <>
            <BillSettle
              expenseId={expense.id}
              description={expense.description}
              month={oldest.month}
              amount={oldest.amount}
              label={oldest.month === currentMonth ? "Paguei" : `Paguei ${formatShortMonth(oldest.month)}`}
            />
            <BillSettleOptions
              expenseId={expense.id}
              description={expense.description}
              month={oldest.month}
              amount={oldest.amount}
            />
          </>
        ) : null}
        <FinanceRecurringSheet expense={expense} subscriptions={subscriptionOptions} />
      </span>
    </li>
  );
}

const TRAIL_TONES: Record<TrailMonth["status"], string> = {
  pago: "bg-emerald-100 text-emerald-800",
  atrasado: "bg-red-100 text-red-700",
  aberto: "bg-[#fff1ec] text-[var(--insyt-primary-dark)]",
};

const TRAIL_LABELS: Record<TrailMonth["status"], string> = {
  pago: "pago",
  atrasado: "atrasado",
  aberto: "a vencer",
};

/** Os últimos meses de relance: quem paga em dia e quem costuma atrasar. */
function PaymentTrail({ trail }: { trail: TrailMonth[] }) {
  if (trail.length === 0) return null;
  return (
    <ol className="hidden shrink-0 items-center gap-1 md:flex" aria-label="Últimos meses">
      {trail.map((item) => {
        const label = `${formatMonthLabel(item.month)}: ${
          item.paidOn ? `pago em ${formatShortDate(item.paidOn)}` : TRAIL_LABELS[item.status]
        }`;
        return (
          <li
            key={item.month}
            title={label}
            aria-label={label}
            className={cn(
              "flex h-6 min-w-8 items-center justify-center rounded-md px-1 text-[11px] font-semibold capitalize tabular-nums",
              TRAIL_TONES[item.status],
            )}
          >
            {formatShortMonth(item.month)}
          </li>
        );
      })}
    </ol>
  );
}

function Collapsed({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group border-t border-[var(--insyt-border)]">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-5 py-3 text-xs font-semibold text-[var(--insyt-slate)] hover:text-[var(--insyt-black)] sm:px-6">
        <ChevronRight className="size-3.5 transition-transform duration-150 group-open:rotate-90" />
        {label}
      </summary>
      <div className="border-t border-[var(--insyt-border)]">{children}</div>
    </details>
  );
}
