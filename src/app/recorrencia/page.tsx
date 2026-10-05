import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, Globe, Repeat, Wallet } from "lucide-react";
import type { ComponentType } from "react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageHeader } from "@/components/admin-page-header";
import { SubscriptionFormSheet } from "@/components/subscription-form-sheet";
import { SubscriptionPaymentSheet } from "@/components/subscription-payment-sheet";
import { SubscriptionPlansSheet } from "@/components/subscription-plans-sheet";
import {
  getSubscriptionFormData,
  getSubscriptionsWithPayments,
} from "@/app/actions/subscriptions";
import {
  formatBrl,
  getBillingState,
  monthStartOf,
  summarizeRecurrence,
  todayInBrasilia,
  type CurrentMonthStatus,
} from "@/lib/subscription-billing";
import { formatMonthLabel, formatShortDate } from "@/lib/subscription-format";
import { requireAuthenticatedUser } from "@/lib/supabase/require-authenticated-user";
import { SUBSCRIPTION_STATUS_LABELS, type SubscriptionPayment } from "@/types/subscription";
import { cn } from "@/lib/utils";

const MONTH_STATUS: Record<CurrentMonthStatus, { label: string; className: string }> = {
  pago: { label: "Pago", className: "bg-emerald-50 text-emerald-800" },
  pendente: { label: "A vencer", className: "bg-[#fff1ec] text-[var(--insyt-primary-dark)]" },
  atrasado: { label: "Atrasado", className: "bg-red-50 text-red-700" },
  sem_cobranca: {
    label: "Sem cobrança",
    className: "bg-[var(--insyt-canvas-alt)] text-[var(--insyt-slate)]",
  },
};

export default async function RecurrencePage() {
  const { user } = await requireAuthenticatedUser();
  const [{ subscriptions, payments }, { clients, sites, plans }] = await Promise.all([
    getSubscriptionsWithPayments(),
    getSubscriptionFormData(),
  ]);
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const siteById = new Map(sites.map((site) => [site.id, site]));

  // Quantos clientes ativos em cada plano/adicional, para o catálogo.
  const planUsage: Record<string, number> = {};
  for (const subscription of subscriptions) {
    if (subscription.status !== "ativa") continue;
    for (const id of [subscription.plan_id, ...subscription.addon_ids]) {
      if (id) planUsage[id] = (planUsage[id] ?? 0) + 1;
    }
  }

  const today = todayInBrasilia();
  const currentMonthLabel = formatMonthLabel(monthStartOf(today));

  const paymentsBySubscription = new Map<string, SubscriptionPayment[]>();
  for (const payment of payments) {
    const list = paymentsBySubscription.get(payment.subscription_id) ?? [];
    list.push(payment);
    paymentsBySubscription.set(payment.subscription_id, list);
  }

  const rows = subscriptions.map((subscription) => {
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

  const summary = summarizeRecurrence(
    rows.map(({ subscription, payments }) => ({ subscription, payments })),
    today,
  );

  return (
    <AdminShell userEmail={user.email}>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-fluid">
        <AdminPageHeader
          icon={Repeat}
          title="Recorrência"
          description="Planos mensais de hospedagem e manutenção: quem está ativo, quem pagou e quem está devendo."
          activeHref="/recorrencia"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <SubscriptionPlansSheet plans={plans} usage={planUsage} />
              <SubscriptionFormSheet clients={clients} sites={sites} plans={plans} />
            </div>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            icon={Repeat}
            label="Recorrência mensal"
            value={formatBrl(summary.mrr)}
            hint={`${summary.activeCount} ${summary.activeCount === 1 ? "plano ativo" : "planos ativos"}`}
            accent
          />
          <SummaryCard
            icon={CheckCircle2}
            label="Recebido"
            value={formatBrl(summary.receivedThisMonth)}
            hint={`referente a ${currentMonthLabel}`}
          />
          <SummaryCard
            icon={CalendarClock}
            label="A receber"
            value={formatBrl(summary.toReceiveThisMonth)}
            hint={`ainda de ${currentMonthLabel}`}
          />
          <SummaryCard
            icon={AlertTriangle}
            label="Em atraso"
            value={formatBrl(summary.overdueTotal)}
            hint={
              summary.overdueClients > 0
                ? `${summary.overdueClients} ${summary.overdueClients === 1 ? "cliente" : "clientes"}`
                : "ninguém devendo"
            }
            danger={summary.overdueTotal > 0}
          />
        </div>

        {rows.length === 0 ? (
          <div className="insyt-card flex flex-col items-center gap-3 py-20 text-center">
            <Wallet className="size-7 text-[var(--insyt-muted)]" />
            <h2 className="text-lg font-semibold">Nenhuma assinatura ainda</h2>
            <p className="max-w-sm text-sm text-[var(--insyt-muted)]">
              Cadastre o plano mensal de cada cliente para acompanhar aqui quem
              pagou, quem está devendo e quanto entra por mês.
            </p>
          </div>
        ) : (
          <div className="insyt-card divide-y divide-[var(--insyt-border)] overflow-hidden">
            {rows.map(({ subscription, payments: subscriptionPayments, state, payableMonths }) => {
              const monthStatus = MONTH_STATUS[state.currentStatus];
              const canceled = subscription.status === "cancelada";
              const planLabel = [
                planById.get(subscription.plan_id ?? "")?.name ?? subscription.plan_name,
                ...subscription.addon_ids.map((id) => planById.get(id)?.name).filter(Boolean),
              ].join(" + ");
              const coveredSites = subscription.project_ids
                .map((id) => siteById.get(id))
                .filter((site) => site !== undefined);

              return (
                <div
                  key={subscription.id}
                  className={cn(
                    "grid gap-4 px-6 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:px-8",
                    canceled && "opacity-60",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {subscription.crm_client_id ? (
                        <Link
                          href={`/crm/${subscription.crm_client_id}`}
                          className="truncate font-bold text-[var(--insyt-black)] hover:text-[var(--insyt-primary)]"
                        >
                          {subscription.client_name}
                        </Link>
                      ) : (
                        <h2 className="truncate font-bold text-[var(--insyt-black)]">
                          {subscription.client_name}
                        </h2>
                      )}
                      {canceled ? (
                        <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-semibold text-stone-600">
                          {SUBSCRIPTION_STATUS_LABELS.cancelada}
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                            monthStatus.className,
                          )}
                        >
                          {monthStatus.label}
                        </span>
                      )}
                      {state.overdueMonths.length > 1 ||
                      (state.overdueMonths.length === 1 &&
                        state.currentStatus !== "atrasado") ? (
                        <span className="text-[11px] font-semibold text-red-700">
                          {state.overdueMonths.length}{" "}
                          {state.overdueMonths.length === 1 ? "mês" : "meses"} em aberto
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-[var(--insyt-muted)]">
                      {planLabel}
                      {subscription.description ? ` · ${subscription.description}` : ""}
                    </p>
                    {coveredSites.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {coveredSites.map((site) => (
                          <Link
                            key={site.id}
                            href={`/sites/${site.id}`}
                            className="inline-flex items-center gap-1 rounded-full bg-[var(--insyt-canvas-alt)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--insyt-slate)] hover:text-[var(--insyt-primary)]"
                          >
                            <Globe className="size-3" />
                            {site.title}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-1 text-xs text-[var(--insyt-muted)]">
                      {canceled && subscription.ended_on
                        ? `Cancelada em ${formatShortDate(subscription.ended_on)}`
                        : state.nextDue
                          ? `${state.overdueMonths.length > 0 ? "Venceu" : "Próximo vencimento"} ${formatShortDate(state.nextDue)}`
                          : `Vence todo dia ${subscription.billing_day}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 sm:justify-end">
                    <p className="mr-2 text-right">
                      <span className="block text-lg font-bold tracking-tight text-[var(--insyt-black)]">
                        {formatBrl(subscription.amount)}
                      </span>
                      <span className="text-xs text-[var(--insyt-muted)]">
                        por mês · dia {subscription.billing_day}
                        {subscription.payment_method ? ` · ${subscription.payment_method}` : ""}
                      </span>
                    </p>
                    <SubscriptionPaymentSheet
                      subscription={subscription}
                      payments={subscriptionPayments}
                      payableMonths={payableMonths}
                    />
                    <SubscriptionFormSheet
                      subscription={subscription}
                      clients={clients}
                      sites={sites}
                      plans={plans}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminShell>
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
          "mt-3 text-3xl font-bold tracking-tight",
          danger ? "text-red-700" : "text-[var(--insyt-black)]",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-[var(--insyt-muted)]">{hint}</p>
    </div>
  );
}
