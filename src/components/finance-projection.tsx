"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Landmark, Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { saveFinanceSettings } from "@/app/actions/finance";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { projectCash, type ForecastBill, type ForecastCharge } from "@/lib/finance";
import { formatBrl, parseBrlAmount, todayInBrasilia } from "@/lib/subscription-billing";
import { formatShortDate } from "@/lib/subscription-format";
import { cn } from "@/lib/utils";

const HORIZONS = [3, 6, 12] as const;

export function FinanceProjection({
  today,
  startingCash,
  reserve,
  balanceOn,
  hasBalance,
  charges,
  bills,
  overdueIncome,
  projectReceivable,
}: {
  today: string;
  startingCash: number;
  reserve: number;
  balanceOn: string | null;
  hasBalance: boolean;
  charges: ForecastCharge[];
  bills: ForecastBill[];
  overdueIncome: number;
  /** Restante de projetos com valor fechado: sem data, fica fora das contas. */
  projectReceivable: number;
}) {
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(6);
  const [drawInput, setDrawInput] = useState("");
  const [includeOverdue, setIncludeOverdue] = useState(false);

  const draw = parseBrlAmount(drawInput) ?? 0;

  const { withoutDraw, withDraw, safeDraw } = useMemo(() => {
    const base = { startingCash, today, charges, bills, months: horizon, includeOverdue };
    const withoutDraw = projectCash(base);
    const withDraw = projectCash({ ...base, monthlyDraw: draw });
    // Maior retirada mensal que não deixa nenhum mês abaixo da reserva.
    const safeDraw = Math.max(
      0,
      Math.min(...withoutDraw.map((row, index) => (row.closing - reserve) / (index + 1))),
    );
    return { withoutDraw, withDraw, safeDraw: Math.floor(safeDraw * 100) / 100 };
  }, [startingCash, today, charges, bills, horizon, includeOverdue, draw, reserve]);

  const rows = draw > 0 ? withDraw : withoutDraw;
  const finalWithout = withoutDraw.at(-1)?.closing ?? startingCash;
  const finalWith = withDraw.at(-1)?.closing ?? startingCash;
  const firstBelow = rows.find((row) => row.closing < reserve);
  const maxValue = Math.max(1, reserve, ...rows.map((row) => Math.abs(row.closing)));

  return (
    <section className="insyt-card overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--insyt-border)] px-6 py-4">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-[var(--insyt-black)]">
            <TrendingUp className="size-4 text-[var(--insyt-primary)]" />
            Projeção de caixa
          </h2>
          <p className="mt-1 text-xs text-[var(--insyt-muted)]">
            Saldo em conta hoje + recorrência − gastos fixos, mês a mês.
            {projectReceivable > 0
              ? ` Os ${formatBrl(projectReceivable)} que faltam receber de projetos não entram: não têm data.`
              : " Parcelas de projeto entram quando forem lançadas."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-[var(--insyt-canvas)] p-1">
            {HORIZONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setHorizon(value)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  horizon === value
                    ? "bg-white text-[var(--insyt-black)] shadow-sm"
                    : "text-[var(--insyt-muted)]",
                )}
              >
                {value} meses
              </button>
            ))}
          </div>
        </div>
      </header>

      {!hasBalance ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100 bg-amber-50 px-6 py-3 text-sm text-amber-900">
          <span>
            Informe quanto tem na conta hoje. Sem isso a projeção parte de{" "}
            {formatBrl(startingCash)}, só com o que foi lançado aqui.
          </span>
          <FinanceBalanceDialog balance={0} balanceOn={today} reserve={reserve} />
        </div>
      ) : null}

      <div className="grid gap-6 px-6 py-5 md:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--insyt-muted)]">
            Na conta hoje
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-[var(--insyt-black)]">
            {formatBrl(startingCash)}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--insyt-muted)]">
            {hasBalance && balanceOn
              ? `conferido em ${formatShortDate(balanceOn)} + movimentos depois`
              : "só lançamentos do sistema"}
            {hasBalance ? (
              <FinanceBalanceDialog
                balance={startingCash}
                balanceOn={today}
                reserve={reserve}
                compact
              />
            ) : null}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--insyt-muted)]">
            Em {horizon} meses, sem tirar nada
          </p>
          <p
            className={cn(
              "mt-1 text-2xl font-bold tabular-nums tracking-tight",
              finalWithout < 0 ? "text-red-700" : "text-emerald-800",
            )}
          >
            {formatBrl(finalWithout)}
          </p>
          <p className="mt-0.5 text-xs text-[var(--insyt-muted)]">
            {formatBrl(finalWithout - startingCash)} a mais que hoje, no fim de{" "}
            {monthName(withoutDraw.at(-1)?.month)}
          </p>
        </div>

        <div>
          <Label
            htmlFor="projection-draw"
            className="text-xs font-semibold uppercase tracking-wider text-[var(--insyt-muted)]"
          >
            Se eu tirar por mês
          </Label>
          <Input
            id="projection-draw"
            inputMode="decimal"
            value={drawInput}
            onChange={(event) => setDrawInput(event.target.value)}
            placeholder="0,00"
            className="mt-1 h-10 font-bold"
          />
          <p className="mt-1 text-xs text-[var(--insyt-muted)]">
            {draw > 0 ? (
              <>
                fica com{" "}
                <span
                  className={cn(
                    "font-semibold",
                    finalWith < 0 ? "text-red-700" : "text-[var(--insyt-black)]",
                  )}
                >
                  {formatBrl(finalWith)}
                </span>{" "}
                em {horizon} meses ·{" "}
              </>
            ) : null}
            dá para tirar até {formatBrl(safeDraw)}/mês
            {reserve > 0 ? ` sem ficar abaixo da reserva de ${formatBrl(reserve)}` : " sem ficar negativo"}
          </p>
        </div>
      </div>

      <div className="border-t border-[var(--insyt-border)] px-4 py-5 sm:px-6">
        <div className="flex h-32 items-end gap-2">
          {rows.map((row) => {
            const height = Math.max(4, Math.round((Math.abs(row.closing) / maxValue) * 112));
            const below = row.closing < reserve;
            return (
              <div
                key={row.month}
                className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
                title={`${monthName(row.month)}: ${formatBrl(row.closing)}`}
              >
                <span
                  className={cn(
                    "hidden text-[10px] font-semibold tabular-nums sm:block",
                    below ? "text-red-700" : "text-[var(--insyt-slate)]",
                  )}
                >
                  {compactBrl(row.closing)}
                </span>
                <span
                  className={cn(
                    "w-full max-w-10 rounded-t-lg",
                    below ? "bg-red-300" : "bg-[var(--insyt-primary)]/70",
                  )}
                  style={{ height }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex gap-2">
          {rows.map((row) => (
            <span
              key={row.month}
              className="min-w-0 flex-1 truncate text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--insyt-muted)]"
            >
              {shortMonth(row.month)}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto border-t border-[var(--insyt-border)]">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--insyt-muted)]">
              <th className="px-6 py-3">Mês</th>
              <th className="px-3 py-3 text-right">Começa com</th>
              <th className="px-3 py-3 text-right">Entra</th>
              <th className="px-3 py-3 text-right">Sai</th>
              {draw > 0 ? <th className="px-3 py-3 text-right">Retirada</th> : null}
              <th className="px-6 py-3 text-right">Termina com</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--insyt-border)]">
            {rows.map((row) => (
              <tr key={row.month} className="tabular-nums">
                <td className="px-6 py-2.5 font-semibold text-[var(--insyt-black)]">
                  {monthName(row.month)}
                  {row.month === rows[0]?.month ? (
                    <span className="font-normal text-[var(--insyt-muted)]"> · resto do mês</span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 text-right text-[var(--insyt-slate)]">
                  {formatBrl(row.opening)}
                </td>
                <td className="px-3 py-2.5 text-right text-emerald-800">
                  {row.income > 0 ? `+${formatBrl(row.income)}` : "—"}
                </td>
                <td className="px-3 py-2.5 text-right text-[var(--insyt-slate)]">
                  {row.expense > 0 ? `−${formatBrl(row.expense)}` : "—"}
                </td>
                {draw > 0 ? (
                  <td className="px-3 py-2.5 text-right text-[var(--insyt-slate)]">
                    −{formatBrl(row.draw)}
                  </td>
                ) : null}
                <td
                  className={cn(
                    "px-6 py-2.5 text-right font-bold",
                    row.closing < reserve ? "text-red-700" : "text-[var(--insyt-black)]",
                  )}
                >
                  {formatBrl(row.closing)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--insyt-border)] px-6 py-3 text-xs text-[var(--insyt-muted)]">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeOverdue}
            onChange={(event) => setIncludeOverdue(event.target.checked)}
            className="size-3.5 accent-[var(--insyt-primary)]"
          />
          Contar mensalidades atrasadas como recebidas este mês
          {overdueIncome > 0 ? ` (${formatBrl(overdueIncome)})` : ""}
        </label>
        <span>
          {firstBelow
            ? `Atenção: ${monthName(firstBelow.month)} termina abaixo ${reserve > 0 ? "da reserva" : "de zero"}.`
            : reserve > 0
              ? `Nenhum mês abaixo da reserva de ${formatBrl(reserve)}.`
              : "Defina uma reserva mínima no saldo em conta para receber alertas."}
        </span>
      </footer>
    </section>
  );
}

export function FinanceBalanceDialog({
  balance,
  balanceOn,
  reserve,
  compact = false,
}: {
  balance: number;
  balanceOn: string;
  reserve: number;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(balanceOn);
  const [reserveInput, setReserveInput] = useState("");
  const [isPending, startTransition] = useTransition();

  function openDialog() {
    setAmount(balance ? balance.toFixed(2).replace(".", ",") : "");
    setDate(todayInBrasilia());
    setReserveInput(reserve ? reserve.toFixed(2).replace(".", ",") : "");
    setOpen(true);
  }

  function save() {
    const parsed = parseSignedBrl(amount);
    if (parsed === null) {
      toast.error("Informe o saldo da conta.");
      return;
    }
    const parsedReserve = reserveInput.trim() ? parseBrlAmount(reserveInput) : 0;
    if (parsedReserve === null) {
      toast.error("Informe uma reserva válida.");
      return;
    }

    startTransition(async () => {
      const result = await saveFinanceSettings({
        balanceAmount: parsed,
        balanceOn: date,
        reserveAmount: parsedReserve,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Saldo atualizado.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={openDialog}
          className="font-semibold text-[var(--insyt-primary)] hover:underline"
        >
          atualizar
        </button>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={openDialog}>
          <Landmark className="size-3.5" />
          Informar saldo
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-3xl bg-white p-0 sm:max-w-md">
          <DialogHeader className="border-b border-[var(--insyt-border)] px-6 py-5 pr-12">
            <DialogTitle className="text-2xl font-bold text-[var(--insyt-black)]">
              Saldo em conta
            </DialogTitle>
            <DialogDescription>
              Olhe o extrato e informe quanto tinha no fim do dia. Daqui para frente o
              sistema soma o que entrar e tira o que sair.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="balance-amount">Saldo (R$)</Label>
                <Input
                  id="balance-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="1.250,00"
                  className="text-lg font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="balance-date">No fim do dia</Label>
                <Input
                  id="balance-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="balance-reserve">Reserva mínima (R$)</Label>
              <Input
                id="balance-reserve"
                inputMode="decimal"
                value={reserveInput}
                onChange={(event) => setReserveInput(event.target.value)}
                placeholder="Opcional — ex.: 3 meses de gastos fixos"
              />
              <p className="text-xs text-[var(--insyt-muted)]">
                A projeção avisa o primeiro mês que terminar abaixo dela.
              </p>
            </div>
          </div>

          <div className="border-t border-[var(--insyt-border)] px-6 py-4">
            <Button type="button" className="w-full" disabled={isPending} onClick={save}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Saldo pode ser negativo (cheque especial): aceita "-120,00". */
function parseSignedBrl(input: string) {
  const trimmed = input.trim();
  const negative = trimmed.startsWith("-") || trimmed.startsWith("−");
  const parsed = parseBrlAmount(trimmed.replace(/^[-−]/, ""));
  if (parsed === null) return null;
  return negative ? -parsed : parsed;
}

function monthName(month: string | undefined) {
  if (!month) return "";
  const label = format(parseISO(month), "MMMM 'de' yyyy", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function shortMonth(month: string) {
  return format(parseISO(month), "MMM", { locale: ptBR }).replace(".", "");
}

function compactBrl(value: number) {
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return `${sign}${(abs / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  }
  return `${sign}${Math.round(abs).toLocaleString("pt-BR")}`;
}
