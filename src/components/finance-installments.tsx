import type { InstallmentState } from "@/lib/project-schedule";
import { formatBrl } from "@/lib/subscription-billing";
import { cn } from "@/lib/utils";

const TONES: Record<InstallmentState["status"], string> = {
  pago: "bg-emerald-100 text-emerald-800",
  atrasado: "bg-red-100 text-red-700",
  a_vencer: "bg-[#fff1ec] text-[var(--insyt-primary-dark)]",
  futuro: "bg-[var(--insyt-canvas-alt)] text-[var(--insyt-slate)]",
};

const LABELS: Record<InstallmentState["status"], string> = {
  pago: "recebida",
  atrasado: "atrasada",
  a_vencer: "vence este mês",
  futuro: "prevista",
};

/** As parcelas de um projeto de relance: data, valor e situação pela cor. */
export function FinanceInstallmentChips({ states }: { states: InstallmentState[] }) {
  return (
    <ol className="flex flex-wrap gap-1" aria-label="Parcelas">
      {states.map((state) => {
        const date = `${state.dueOn.slice(8, 10)}/${state.dueOn.slice(5, 7)}`;
        const partial = state.open > 0 && state.paid > 0;
        const label = `${state.name}, ${date}: ${formatBrl(state.amount)}, ${
          partial ? `falta ${formatBrl(state.open)}` : LABELS[state.status]
        }`;
        return (
          <li
            key={`${state.dueOn}:${state.name}`}
            title={label}
            aria-label={label}
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
              TONES[state.status],
            )}
          >
            {date} · {formatBrl(state.open > 0 ? state.open : state.amount)}
          </li>
        );
      })}
    </ol>
  );
}
