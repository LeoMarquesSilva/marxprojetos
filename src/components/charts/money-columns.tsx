import Link from "next/link";
import { formatBrl } from "@/lib/subscription-billing";
import { formatMonthLabel, formatShortMonth } from "@/lib/subscription-format";
import { cn } from "@/lib/utils";

export type MoneyColumn = {
  month: string;
  income: number;
  expectedIncome: number;
  expense: number;
  expectedExpense: number;
  href: string;
};

const COLORS = {
  income: "#f74211",
  expectedIncome: "#fdc7b3",
  expense: "#b09a88",
  expectedExpense: "#dccdbf",
};

/** Passo redondo do eixo (1, 2 ou 5 vezes uma potência de 10) para umas 4 divisões. */
function niceStep(peak: number) {
  if (peak <= 0) return 250;
  const raw = peak / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  return ([1, 2, 5, 10].find((candidate) => candidate * power >= raw) ?? 10) * power;
}

function axisLabel(value: number) {
  if (value === 0) return "0";
  if (value >= 1000) {
    return `${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  }
  return value.toLocaleString("pt-BR");
}

/**
 * Colunas de dinheiro por mês: o que já entrou ou saiu é sólido e o previsto fica
 * claro em cima, para realizado e previsto nunca se confundirem. Cada mês é um link.
 */
export function MoneyColumns({
  columns,
  currentMonth,
  selectedMonth,
  plotHeight = 168,
}: {
  columns: MoneyColumn[];
  currentMonth: string;
  selectedMonth?: string;
  plotHeight?: number;
}) {
  const peak = Math.max(
    0,
    ...columns.map((column) =>
      Math.max(column.income + column.expectedIncome, column.expense + column.expectedExpense),
    ),
  );
  const step = niceStep(peak);
  const ceiling = Math.max(step, Math.ceil(peak / step) * step);
  const ticks = Array.from(
    { length: Math.round(ceiling / step) + 1 },
    (_, index) => ceiling - index * step,
  );
  const scale = (value: number) => (value / ceiling) * plotHeight;

  return (
    <div>
      <div className="flex gap-2">
        <div
          aria-hidden
          className="relative w-11 shrink-0 text-right text-[11px] tabular-nums text-[var(--insyt-muted)]"
          style={{ height: plotHeight }}
        >
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2 leading-none"
              style={{ top: plotHeight - scale(tick) }}
            >
              {axisLabel(tick)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <div aria-hidden className="absolute inset-x-0 top-0" style={{ height: plotHeight }}>
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute inset-x-0 h-px bg-[var(--insyt-border)]"
                style={{ top: plotHeight - scale(tick) }}
              />
            ))}
          </div>

          <div className="relative flex">
            {columns.map((column, index) => {
              const selected = column.month === selectedMonth;
              const current = column.month === currentMonth;
              const label = formatMonthLabel(column.month);
              return (
                <Link
                  key={column.month}
                  href={column.href}
                  aria-current={selected ? "page" : undefined}
                  aria-label={`${label}: entrou ${formatBrl(column.income)}, a receber ${formatBrl(column.expectedIncome)}, saiu ${formatBrl(column.expense)}, a pagar ${formatBrl(column.expectedExpense)}`}
                  className="group relative flex min-w-0 flex-1 flex-col items-center rounded-lg outline-none"
                >
                  <span
                    className={cn(
                      "flex w-full items-end justify-center gap-[3px] rounded-t-lg transition-colors duration-150",
                      selected
                        ? "bg-[var(--insyt-tint)]"
                        : "group-hover:bg-[var(--insyt-canvas)] group-focus-visible:bg-[var(--insyt-canvas)]",
                    )}
                    style={{ height: plotHeight }}
                  >
                    <Stack
                      done={scale(column.income)}
                      expected={scale(column.expectedIncome)}
                      doneColor={COLORS.income}
                      expectedColor={COLORS.expectedIncome}
                    />
                    <Stack
                      done={scale(column.expense)}
                      expected={scale(column.expectedExpense)}
                      doneColor={COLORS.expense}
                      expectedColor={COLORS.expectedExpense}
                    />
                  </span>
                  <span
                    className={cn(
                      "w-full rounded-b-lg pb-1 pt-1.5 text-center text-xs capitalize",
                      selected && "bg-[var(--insyt-tint)]",
                      current
                        ? "font-semibold text-[var(--insyt-primary-dark)]"
                        : "text-[var(--insyt-slate)]",
                    )}
                  >
                    {formatShortMonth(column.month)}
                  </span>

                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute bottom-full z-20 mb-1 w-44 rounded-xl bg-[var(--insyt-black)] px-3 py-2 text-left text-white opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100",
                      index < columns.length / 2 ? "left-0" : "right-0",
                    )}
                  >
                    <span className="mb-1 block text-[11px] first-letter:uppercase text-white/70">
                      {label}
                    </span>
                    <TipRow color={COLORS.income} label="Entrou" value={column.income} />
                    <TipRow
                      color={COLORS.expectedIncome}
                      label="A receber"
                      value={column.expectedIncome}
                    />
                    <TipRow color={COLORS.expense} label="Saiu" value={column.expense} />
                    <TipRow
                      color={COLORS.expectedExpense}
                      label="A pagar"
                      value={column.expectedExpense}
                    />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-[var(--insyt-slate)]">
        <LegendItem color={COLORS.income}>Entrou</LegendItem>
        <LegendItem color={COLORS.expectedIncome}>A receber</LegendItem>
        <LegendItem color={COLORS.expense}>Saiu</LegendItem>
        <LegendItem color={COLORS.expectedExpense}>A pagar</LegendItem>
      </div>
    </div>
  );
}

function Stack({
  done,
  expected,
  doneColor,
  expectedColor,
}: {
  done: number;
  expected: number;
  doneColor: string;
  expectedColor: string;
}) {
  const visible = (height: number) => (height > 0 ? Math.max(3, height) : 0);
  const doneHeight = visible(done);
  const expectedHeight = visible(expected);
  return (
    <span className="flex w-full max-w-4 flex-col justify-end gap-[2px]">
      {expectedHeight > 0 ? (
        <span
          className={cn("block", "rounded-t-[4px]")}
          style={{ height: expectedHeight, background: expectedColor }}
        />
      ) : null}
      {doneHeight > 0 ? (
        <span
          className={cn("block", expectedHeight === 0 && "rounded-t-[4px]")}
          style={{ height: doneHeight, background: doneColor }}
        />
      ) : null}
    </span>
  );
}

function TipRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="flex items-center gap-1.5 py-px text-xs">
      <span className="h-0.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="flex-1 text-white/70">{label}</span>
      <span className="font-semibold tabular-nums">{formatBrl(value)}</span>
    </span>
  );
}

function LegendItem({ color, children }: { color: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-[3px]" style={{ background: color }} />
      {children}
    </span>
  );
}
