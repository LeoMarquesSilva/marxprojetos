import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { FinanceEntryDelete, FinanceEntrySheet } from "@/components/finance-entry-sheet";
import { FinanceBalanceDialog } from "@/components/finance-projection";
import {
  BillSettle,
  BillSettleOptions,
  ChargeSettle,
  FinancePaymentDelete,
} from "@/components/finance-settle";
import {
  FinanceEmpty,
  FinanceKpi,
  FinanceKpiGrid,
  FinanceSection,
} from "@/components/finance-ui";
import { SubscriptionPaymentSheet } from "@/components/subscription-payment-sheet";
import {
  chargesInMonth,
  expensesByCategory,
  linesInMonth,
  monthTotals,
  openItemsForMonth,
  projectCash,
  sumCharges,
  type ForecastBill,
  type ForecastCharge,
  type LedgerLine,
} from "@/lib/finance";
import { loadFinanceData, type FinanceData } from "@/lib/finance-page-data";
import { addMonths, dueLabel, formatBrl, toAmount } from "@/lib/subscription-billing";
import {
  formatMonthLabel,
  formatShortDate,
  formatShortMonth,
} from "@/lib/subscription-format";
import { cn } from "@/lib/utils";
import { PAYMENT_METHODS } from "@/types/subscription";

const MONTH_QUERY = /^(\d{4})-(\d{2})$/;

export default async function FinancasMesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const params = await searchParams;
  const data = await loadFinanceData();
  const { today, currentMonth, ledger, charges, bills, settings, startingCash, overdueIncome } =
    data;

  const selectedMonth = resolveMonth(params.mes, currentMonth);
  const isCurrent = selectedMonth === currentMonth;
  const isPast = selectedMonth < currentMonth;
  const monthLabel = formatMonthLabel(selectedMonth);
  const monthName = monthLabel.split(" de ")[0];

  const monthLines = linesInMonth(ledger, selectedMonth);
  const totals = monthTotals(monthLines);
  const byCategory = expensesByCategory(monthLines);

  const openCharges = openItemsForMonth(charges, selectedMonth, currentMonth);
  const openBills = openItemsForMonth(bills, selectedMonth, currentMonth);
  const toReceive = sumCharges(openCharges);
  const toPay = sumCharges(openBills);
  const isLate = (item: { timing: string }) => item.timing === "atrasado";
  const lateReceive = sumCharges(openCharges.filter(isLate));
  const latePay = sumCharges(openBills.filter(isLate));
  // Olhando outro mês, o atraso continua avisando: é o que mais importa resolver.
  const lateElsewhere = isCurrent
    ? 0
    : sumCharges(charges.filter((item) => isLate(item) && item.month !== selectedMonth)) +
      sumCharges(bills.filter((item) => isLate(item) && item.month !== selectedMonth));

  // Mesma conta da aba Projeção, para os dois números nunca divergirem.
  const closing = isPast
    ? null
    : (projectCash({ startingCash, today, charges, bills, months: 13 }).find(
        (row) => row.month === selectedMonth,
      ) ?? null);

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

  return (
    <div className="space-y-6">
      <section className="insyt-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 pt-4 sm:px-5">
          <div className="flex items-center gap-1">
            <MonthStep month={addMonths(selectedMonth, -1)} currentMonth={currentMonth} direction="prev" />
            <h2 className="min-w-44 text-center text-lg font-bold text-[var(--insyt-black)]">
              {capitalize(monthLabel)}
            </h2>
            <MonthStep month={addMonths(selectedMonth, 1)} currentMonth={currentMonth} direction="next" />
            {isCurrent ? null : (
              <Link
                href="/financas"
                className="ml-2 text-xs font-semibold text-[var(--insyt-primary-dark)] hover:underline"
              >
                Voltar para hoje
              </Link>
            )}
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--insyt-muted)]">
            <Legend className="bg-emerald-500">Entrou</Legend>
            <Legend className="bg-emerald-200">A receber</Legend>
            <Legend className="bg-stone-400">Saiu</Legend>
            <Legend className="bg-stone-200">A pagar</Legend>
          </p>
        </div>

        <nav aria-label="Escolher mês" className="flex gap-1 overflow-x-auto px-3 py-3 sm:px-4">
          {bars.map((bar) => {
            const selected = bar.month === selectedMonth;
            const current = bar.month === currentMonth;
            // No celular cabem cinco meses: os vizinhos do escolhido. As setas levam adiante.
            const nearSelected =
              bar.month >= addMonths(selectedMonth, -2) && bar.month <= addMonths(selectedMonth, 2);
            return (
              <Link
                key={bar.month}
                href={monthHref(bar.month, currentMonth)}
                aria-current={selected ? "page" : undefined}
                aria-label={capitalize(formatMonthLabel(bar.month))}
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
                  "min-w-14 flex-1 flex-col items-center gap-1.5 rounded-xl px-1 pb-1.5 pt-2 transition-colors duration-150",
                  nearSelected ? "flex" : "hidden sm:flex",
                  selected
                    ? "bg-[var(--insyt-canvas)] ring-1 ring-[var(--insyt-border)]"
                    : "hover:bg-[var(--insyt-canvas)]/70",
                )}
              >
                <span className="flex h-12 items-end gap-1">
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
                    "text-[11px] font-semibold capitalize",
                    current
                      ? "text-[var(--insyt-primary-dark)]"
                      : selected
                        ? "text-[var(--insyt-black)]"
                        : "text-[var(--insyt-muted)]",
                  )}
                >
                  {formatShortMonth(bar.month)}
                </span>
              </Link>
            );
          })}
        </nav>

        <FinanceKpiGrid className="border-t border-[var(--insyt-border)]">
          <FinanceKpi
            label="Na conta hoje"
            value={formatBrl(startingCash)}
            hintTone={settings ? "default" : "warn"}
            hint={
              <>
                {settings
                  ? `conferido em ${formatShortDate(settings.balance_on)} · `
                  : "só o que foi lançado aqui · "}
                <FinanceBalanceDialog
                  balance={settings ? startingCash : 0}
                  balanceOn={today}
                  reserve={settings ? toAmount(settings.reserve_amount) : 0}
                  compact
                  compactLabel={settings ? "atualizar" : "informar saldo"}
                />
              </>
            }
          />
          <FinanceKpi
            label={`Entrou em ${monthName}`}
            value={formatBrl(totals.income)}
            hint={
              toReceive > 0
                ? `+ ${formatBrl(toReceive)} ${isPast ? "ainda em aberto" : "a receber"}`
                : "nada em aberto"
            }
          />
          <FinanceKpi
            label={`Saiu em ${monthName}`}
            value={formatBrl(totals.expense)}
            hint={
              toPay > 0
                ? `+ ${formatBrl(toPay)} ${isPast ? "ainda em aberto" : "a pagar"}`
                : "nada em aberto"
            }
          />
          {closing ? (
            <FinanceKpi
              label={`Na conta no fim de ${monthName}`}
              value={formatBrl(closing.closing)}
              tone={closing.closing < 0 ? "danger" : "default"}
              hint={
                overdueIncome > 0
                  ? `sem contar ${formatBrl(overdueIncome)} em atraso`
                  : "se tudo for pago em dia"
              }
            />
          ) : (
            <FinanceKpi
              label={`Resultado de ${monthName}`}
              value={formatBrl(totals.balance)}
              tone={totals.balance < 0 ? "danger" : "default"}
              hint="entrou menos o que saiu"
            />
          )}
        </FinanceKpiGrid>
      </section>

      {lateElsewhere > 0 ? (
        <Link
          href="/financas"
          className="block rounded-2xl bg-red-50 px-5 py-3 text-sm font-medium text-red-800 hover:underline"
        >
          {formatBrl(lateElsewhere)} em atraso em outros meses. Resolver no mês atual.
        </Link>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <FinanceSection
          title="A receber"
          subtitle={
            lateReceive > 0 ? (
              <span className="font-semibold text-red-700">
                {formatBrl(lateReceive)} em atraso
              </span>
            ) : isPast ? (
              `em aberto de ${monthName}`
            ) : (
              `recorrência e repasses de ${monthName}`
            )
          }
          action={<ListTotal value={toReceive} />}
        >
          {openCharges.length === 0 ? (
            <FinanceEmpty>
              {isPast ? `Tudo recebido em ${monthName}.` : `Nada mais a receber em ${monthName}.`}
            </FinanceEmpty>
          ) : (
            <ul className="divide-y divide-[var(--insyt-border)]">
              {openCharges.map((charge) => (
                <ChargeRow key={charge.id} charge={charge} data={data} />
              ))}
            </ul>
          )}
        </FinanceSection>

        <FinanceSection
          title="A pagar"
          subtitle={
            latePay > 0 ? (
              <span className="font-semibold text-red-700">{formatBrl(latePay)} vencido</span>
            ) : isPast ? (
              `em aberto de ${monthName}`
            ) : (
              `gastos fixos de ${monthName}`
            )
          }
          action={<ListTotal value={toPay} negative />}
        >
          {openBills.length === 0 ? (
            <FinanceEmpty>
              {data.recurringExpenses.length === 0 ? (
                <>
                  Nenhum gasto fixo cadastrado. Cadastre o DAS, repasses e ferramentas na aba{" "}
                  <Link
                    href="/financas/recorrencia"
                    className="font-semibold text-[var(--insyt-primary-dark)] hover:underline"
                  >
                    Recorrência
                  </Link>
                  .
                </>
              ) : (
                `Tudo pago em ${monthName}.`
              )}
            </FinanceEmpty>
          ) : (
            <ul className="divide-y divide-[var(--insyt-border)]">
              {openBills.map((bill) => (
                <BillRow key={bill.id} bill={bill} today={today} />
              ))}
            </ul>
          )}
        </FinanceSection>
      </div>

      <div className={cn("grid items-start gap-4", byCategory.length > 0 && "lg:grid-cols-3")}>
        <FinanceSection
          title="Movimentos"
          subtitle={`${capitalize(monthLabel)} · ${monthLines.length} ${
            monthLines.length === 1 ? "lançamento" : "lançamentos"
          }`}
          className={byCategory.length > 0 ? "lg:col-span-2" : undefined}
        >
          {monthLines.length === 0 ? (
            <FinanceEmpty>
              Nada neste mês. Parcelas de projeto e gastos avulsos entram pelo botão Lançar.
              Mensalidade recebida e gasto fixo pago aparecem aqui sozinhos.
            </FinanceEmpty>
          ) : (
            <ul className="divide-y divide-[var(--insyt-border)]">
              {monthLines.map((line) => (
                <MovementRow key={`${line.source}:${line.id}`} line={line} data={data} />
              ))}
            </ul>
          )}
        </FinanceSection>

        {byCategory.length > 0 ? (
          <FinanceSection title="Para onde foi" subtitle={`saídas de ${monthName} por categoria`}>
            <ul className="space-y-3 px-5 py-4 sm:px-6">
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
          </FinanceSection>
        ) : null}
      </div>
    </div>
  );
}

function ListTotal({ value, negative = false }: { value: number; negative?: boolean }) {
  if (value <= 0) return null;
  return (
    <span className="text-sm font-bold tabular-nums text-[var(--insyt-black)]">
      {negative ? "−" : ""}
      {formatBrl(value)}
    </span>
  );
}

function ChargeRow({ charge, data }: { charge: ForecastCharge; data: FinanceData }) {
  const { today, shareBySubscription, rowBySubscription, partnershipViews, projectOptions } = data;
  const due = dueLabel(charge.dueOn, today);
  const late = charge.timing === "atrasado";
  const canSettle = charge.timing !== "futuro";
  const share = shareBySubscription.get(charge.subscriptionId) ?? 0;
  const row = rowBySubscription.get(charge.subscriptionId);
  const partnership = charge.projectId
    ? partnershipViews.find((view) => view.id === charge.projectId)
    : undefined;

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5 sm:px-6">
      <div className="min-w-0 flex-1 basis-44">
        <p className="truncate text-sm font-semibold text-[var(--insyt-black)]">
          {charge.clientName}
        </p>
        <p className={cn("text-xs", due.late ? "text-red-700" : "text-[var(--insyt-muted)]")}>
          {charge.note ?? due.text}
          {share > 0 ? (
            <span className="text-[var(--insyt-muted)]">
              {" "}
              · líquido {formatBrl(charge.amount - share)}
            </span>
          ) : null}
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
      <span className="ml-auto flex shrink-0 items-center gap-1">
        {partnership ? (
          canSettle ? (
            <FinanceEntrySheet
              projects={projectOptions}
              receiveProject={partnership.option}
              defaultAmount={charge.amount}
              triggerLabel="Recebi"
            />
          ) : (
            <Link
              href={`/financas/projetos#sociedade-${partnership.id}`}
              className="px-2 text-xs font-semibold text-[var(--insyt-primary-dark)] hover:underline"
            >
              Ver
            </Link>
          )
        ) : row ? (
          <>
            {canSettle ? (
              <ChargeSettle
                subscriptionId={row.subscription.id}
                clientName={charge.clientName}
                month={charge.month}
                amount={charge.amount}
                method={row.subscription.payment_method ?? PAYMENT_METHODS[0]}
              />
            ) : null}
            <SubscriptionPaymentSheet
              subscription={row.subscription}
              payments={row.payments}
              payableMonths={[...new Set([...row.payableMonths, charge.month])].sort()}
              initialMonth={charge.month}
            />
          </>
        ) : null}
      </span>
    </li>
  );
}

function BillRow({ bill, today }: { bill: ForecastBill; today: string }) {
  const due = dueLabel(bill.dueOn, today);
  const late = bill.timing === "atrasado";
  const canSettle = bill.timing !== "futuro";

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5 sm:px-6">
      <div className="min-w-0 flex-1 basis-44">
        <p className="truncate text-sm font-semibold text-[var(--insyt-black)]">
          {bill.description}
        </p>
        <p className={cn("text-xs", due.late ? "text-red-700" : "text-[var(--insyt-muted)]")}>
          {due.text}
          <span className="text-[var(--insyt-muted)]"> · {bill.category}</span>
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
      <span className="ml-auto flex shrink-0 items-center gap-1">
        {bill.projectId ? (
          <Link
            href={`/financas/projetos#sociedade-${bill.projectId}`}
            className="px-2 text-xs font-semibold text-[var(--insyt-primary-dark)] hover:underline"
          >
            Ver
          </Link>
        ) : (
          <>
            {canSettle ? (
              <BillSettle
                expenseId={bill.expenseId}
                description={bill.description}
                month={bill.month}
                amount={bill.amount}
              />
            ) : null}
            <BillSettleOptions
              expenseId={bill.expenseId}
              description={bill.description}
              month={bill.month}
              amount={bill.amount}
            />
          </>
        )}
      </span>
    </li>
  );
}

function MovementRow({ line, data }: { line: LedgerLine; data: FinanceData }) {
  const incoming = line.kind === "entrada";
  const entry = line.source === "lancamento" ? data.entryById.get(line.id) : undefined;

  return (
    <li className="flex items-center gap-3 px-5 py-3 sm:px-6">
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
      {/* Largura fixa: os valores ficam alinhados com uma ou duas ações. */}
      <span className="flex w-[4.25rem] shrink-0 items-center justify-end">
        {entry ? (
          <>
            <FinanceEntrySheet entry={entry} projects={data.projectOptions} />
            <FinanceEntryDelete id={entry.id} label={entry.description} />
          </>
        ) : (
          <FinancePaymentDelete
            id={line.id}
            clientName={line.description}
            referenceLabel={line.detail}
          />
        )}
      </span>
    </li>
  );
}

function MonthStep({
  month,
  currentMonth,
  direction,
}: {
  month: string;
  currentMonth: string;
  direction: "prev" | "next";
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <Link
      href={monthHref(month, currentMonth)}
      aria-label={`Ir para ${formatMonthLabel(month)}`}
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--insyt-slate)] transition-colors duration-150 hover:bg-[var(--insyt-canvas)] hover:text-[var(--insyt-black)]"
    >
      <Icon className="size-4" />
    </Link>
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
  const scale = (value: number) => (value > 0 ? Math.max(4, Math.round((value / max) * 48)) : 0);
  const doneHeight = scale(done);
  const expectedHeight = scale(expected);
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

function Legend({ className, children }: { className: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", className)} />
      {children}
    </span>
  );
}

function monthHref(month: string, currentMonth: string) {
  return month === currentMonth ? "/financas" : `/financas?mes=${month.slice(0, 7)}`;
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

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
