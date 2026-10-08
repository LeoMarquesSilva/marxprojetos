import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Repeat,
  Scale,
  Wallet,
} from "lucide-react";
import type { ComponentType } from "react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageHeader } from "@/components/admin-page-header";
import { FinanceEntryDelete, FinanceEntrySheet } from "@/components/finance-entry-sheet";
import { getFinanceEntries } from "@/app/actions/finance";
import { getSubscriptionsWithPayments } from "@/app/actions/subscriptions";
import {
  buildLedger,
  chargesInMonth,
  forecastCharges,
  linesInMonth,
  monthTotals,
  sumCharges,
  type ForecastCharge,
  type LedgerLine,
} from "@/lib/finance";
import {
  addMonths,
  formatBrl,
  monthStartOf,
  todayInBrasilia,
} from "@/lib/subscription-billing";
import { formatMonthLabel, formatShortDate } from "@/lib/subscription-format";
import { requireAuthenticatedUser } from "@/lib/supabase/require-authenticated-user";
import { cn } from "@/lib/utils";

const MONTH_QUERY = /^(\d{4})-(\d{2})$/;
const FORECAST_HORIZON = 5;

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

  const [{ subscriptions, payments }, entries] = await Promise.all([
    getSubscriptionsWithPayments(),
    getFinanceEntries(),
  ]);

  const clientBySubscription = new Map(
    subscriptions.map((subscription) => [subscription.id, subscription.client_name]),
  );

  const ledger = buildLedger(
    entries,
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
  const months = monthWindow(currentMonth, selectedMonth);
  const maxBar = Math.max(
    1,
    ...months.map((month) => {
      const totals = monthTotals(linesInMonth(ledger, month));
      return Math.max(totals.income, totals.expense);
    }),
  );

  const monthLines = linesInMonth(ledger, selectedMonth);
  const totals = monthTotals(monthLines);
  const monthCharges = chargesInMonth(charges, selectedMonth);
  const expected = sumCharges(monthCharges);
  const overdue = charges.filter((charge) => charge.timing === "atrasado");
  const ahead = charges.filter(
    (charge) => charge.timing === "futuro" && charge.month !== selectedMonth,
  );
  const aheadByMonth = groupByMonth(ahead);

  const monthTitle = capitalize(formatMonthLabel(selectedMonth));
  const expectedLabel =
    selectedMonth < currentMonth
      ? "Ainda em aberto"
      : selectedMonth === currentMonth
        ? "A receber"
        : "Previsto";

  return (
    <AdminShell userEmail={user.email}>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-fluid">
        <AdminPageHeader
          icon={Wallet}
          title="Finanças"
          description="O que entrou e saiu em cada mês, o que as recorrências ainda vão trazer e os gastos do estúdio."
          activeHref="/financas"
          quickLinks={[
            { href: "/financas", label: "Caixa", icon: Wallet },
            { href: "/recorrencia", label: "Recorrência", icon: Repeat },
          ]}
          actions={<FinanceEntrySheet />}
        />

        {overdue.length > 0 ? (
          <Link
            href="/recorrencia"
            className="insyt-card flex items-start gap-3 border border-red-100 bg-red-50 px-5 py-4 text-red-800"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p className="text-sm">
              <span className="font-semibold">{formatBrl(sumCharges(overdue))} em atraso</span>
              {" · "}
              {overdue
                .slice(0, 3)
                .map((charge) => charge.clientName)
                .join(", ")}
              {overdue.length > 3 ? ` e mais ${overdue.length - 3}` : ""}. A cobrança continua na
              recorrência.
            </p>
          </Link>
        ) : null}

        <div className="insyt-card px-4 py-5 sm:px-6">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {months.map((month) => {
              const monthTotalsForBar = monthTotals(linesInMonth(ledger, month));
              const selected = month === selectedMonth;
              const incomeHeight = barHeight(monthTotalsForBar.income, maxBar);
              const expenseHeight = barHeight(monthTotalsForBar.expense, maxBar);
              return (
                <Link
                  key={month}
                  href={`/financas?mes=${month.slice(0, 7)}`}
                  className={cn(
                    "flex min-w-[4.5rem] flex-1 flex-col items-center gap-2 rounded-2xl px-2 py-3 transition-colors",
                    selected
                      ? "bg-[var(--insyt-canvas)]"
                      : "hover:bg-[var(--insyt-canvas)]/70",
                  )}
                >
                  <span
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-wider",
                      selected ? "text-[var(--insyt-black)]" : "text-[var(--insyt-muted)]",
                    )}
                  >
                    {shortMonth(month)}
                  </span>
                  <span className="flex h-16 items-end gap-1">
                    <span
                      className="w-2 rounded-full bg-emerald-500"
                      style={{ height: incomeHeight }}
                    />
                    <span
                      className="w-2 rounded-full bg-stone-300"
                      style={{ height: expenseHeight }}
                    />
                  </span>
                  <span className="text-[10px] text-[var(--insyt-muted)]">
                    {month === currentMonth ? "agora" : ""}
                  </span>
                </Link>
              );
            })}
          </div>
          <p className="mt-2 flex items-center gap-3 px-2 text-[11px] text-[var(--insyt-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              Entrou
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-stone-300" />
              Saiu
            </span>
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            icon={ArrowDownLeft}
            label="Entrou"
            value={formatBrl(totals.income)}
            hint={monthTitle}
            accent
          />
          <SummaryCard
            icon={ArrowUpRight}
            label="Saiu"
            value={formatBrl(totals.expense)}
            hint={monthTitle}
          />
          <SummaryCard
            icon={Scale}
            label="Saldo"
            value={formatBrl(totals.balance)}
            hint={totals.balance < 0 ? "saiu mais do que entrou" : "o que sobrou no mês"}
            danger={totals.balance < 0}
          />
          <SummaryCard
            icon={CalendarClock}
            label={expectedLabel}
            value={formatBrl(expected)}
            hint={
              monthCharges.length > 0
                ? `${monthCharges.length} ${monthCharges.length === 1 ? "cobrança" : "cobranças"} de recorrência`
                : "nenhuma cobrança de recorrência"
            }
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="insyt-card overflow-hidden">
            <header className="border-b border-[var(--insyt-border)] px-6 py-4">
              <h2 className="font-bold text-[var(--insyt-black)]">Movimentos</h2>
              <p className="mt-1 text-xs text-[var(--insyt-muted)]">{monthTitle}</p>
            </header>
            {monthLines.length === 0 ? (
              <p className="px-6 py-10 text-sm text-[var(--insyt-muted)]">
                Nada neste mês. Parcelas de projeto e gastos entram pelo botão Lançar.
                Mensalidade marcada como paga na recorrência aparece aqui na data do
                pagamento.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--insyt-border)]">
                {monthLines.map((line) => (
                  <MovementRow key={`${line.source}:${line.id}`} line={line} />
                ))}
              </ul>
            )}
          </section>

          <section className="insyt-card overflow-hidden">
            <header className="border-b border-[var(--insyt-border)] px-6 py-4">
              <h2 className="font-bold text-[var(--insyt-black)]">Recorrência do mês</h2>
              <p className="mt-1 text-xs text-[var(--insyt-muted)]">
                {expectedLabel.toLowerCase()} em {monthTitle.toLowerCase()}
              </p>
            </header>
            {monthCharges.length === 0 ? (
              <p className="px-6 py-10 text-sm text-[var(--insyt-muted)]">
                Nenhuma cobrança em aberto neste mês.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--insyt-border)]">
                {monthCharges.map((charge) => (
                  <ChargeRow key={charge.id} charge={charge} />
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="insyt-card overflow-hidden">
          <header className="border-b border-[var(--insyt-border)] px-6 py-4">
            <h2 className="font-bold text-[var(--insyt-black)]">Pela frente</h2>
            <p className="mt-1 text-xs text-[var(--insyt-muted)]">
              Mensalidades ainda não pagas nos próximos meses.
            </p>
          </header>
          {aheadByMonth.length === 0 ? (
            <p className="px-6 py-10 text-sm text-[var(--insyt-muted)]">
              Nenhuma recorrência futura além do mês selecionado.
            </p>
          ) : (
            <div className="divide-y divide-[var(--insyt-border)]">
              {aheadByMonth.map(([month, items]) => (
                <div key={month} className="px-6 py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link
                      href={`/financas?mes=${month.slice(0, 7)}`}
                      className="text-sm font-semibold text-[var(--insyt-black)] hover:text-[var(--insyt-primary)]"
                    >
                      {capitalize(formatMonthLabel(month))}
                    </Link>
                    <span className="text-sm font-bold text-[var(--insyt-black)]">
                      {formatBrl(sumCharges(items))}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {items.map((charge) => (
                      <li
                        key={charge.id}
                        className="flex items-baseline justify-between gap-3 text-sm text-[var(--insyt-slate)]"
                      >
                        <span className="min-w-0 truncate">
                          {charge.clientName}
                          <span className="text-[var(--insyt-muted)]">
                            {" "}
                            · vence {formatShortDate(charge.dueOn)}
                          </span>
                        </span>
                        <span className="shrink-0">{formatBrl(charge.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}

function MovementRow({ line }: { line: LedgerLine }) {
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
          "shrink-0 text-sm font-bold",
          incoming ? "text-emerald-800" : "text-[var(--insyt-black)]",
        )}
      >
        {incoming ? "" : "−"}
        {formatBrl(line.amount)}
      </p>
      {line.source === "lancamento" ? <FinanceEntryDelete id={line.id} /> : null}
    </li>
  );
}

function ChargeRow({ charge }: { charge: ForecastCharge }) {
  const late = charge.timing === "atrasado";
  return (
    <li className="flex items-center gap-3 px-6 py-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--insyt-black)]">
          {charge.clientName}
        </p>
        <p className="text-xs text-[var(--insyt-muted)]">
          vence {formatShortDate(charge.dueOn)}
          {late ? " · atrasado" : ""}
        </p>
      </div>
      <p className={cn("text-sm font-bold", late ? "text-red-700" : "text-[var(--insyt-black)]")}>
        {formatBrl(charge.amount)}
      </p>
      <Link
        href="/recorrencia"
        className="text-xs font-semibold text-[var(--insyt-primary)] hover:underline"
      >
        Abrir
      </Link>
    </li>
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

function barHeight(value: number, max: number) {
  if (value <= 0) return 4;
  return Math.max(8, Math.round((value / max) * 64));
}

function shortMonth(month: string) {
  const label = format(parseISO(month), "MMM", { locale: ptBR }).replace(".", "");
  return capitalize(label);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function groupByMonth(charges: ForecastCharge[]) {
  const groups = new Map<string, ForecastCharge[]>();
  for (const charge of charges) {
    const list = groups.get(charge.month) ?? [];
    list.push(charge);
    groups.set(charge.month, list);
  }
  return [...groups.entries()];
}
