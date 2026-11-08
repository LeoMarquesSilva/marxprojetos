import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Bloco padrão das abas de Finanças: título, ação à direita e conteúdo. */
export function FinanceSection({
  id,
  title,
  subtitle,
  action,
  className,
  children,
}: {
  id?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("insyt-card scroll-mt-6 overflow-hidden", className)}>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[var(--insyt-border)] px-5 py-4 sm:px-6">
        <div className="min-w-0 flex-1 basis-40">
          <h2 className="font-bold text-[var(--insyt-black)]">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-[var(--insyt-muted)]">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Faixa de números: uma linha só, em vez de um cartão para cada valor. */
export function FinanceKpiGrid({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-px bg-[var(--insyt-border)] lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FinanceKpi({
  label,
  value,
  hint,
  tone = "default",
  hintTone = "default",
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  tone?: "default" | "danger" | "good";
  hintTone?: "default" | "danger" | "warn";
}) {
  return (
    <div className="min-w-0 bg-white px-5 py-4 sm:px-6">
      <p className="text-xs font-semibold text-[var(--insyt-muted)]">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-bold tabular-nums tracking-tight sm:text-2xl",
          tone === "danger" && "text-red-700",
          tone === "good" && "text-emerald-800",
          tone === "default" && "text-[var(--insyt-black)]",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p
          className={cn(
            "mt-0.5 text-xs",
            hintTone === "danger" && "text-red-700",
            hintTone === "warn" && "text-amber-800",
            hintTone === "default" && "text-[var(--insyt-muted)]",
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FinanceEmpty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-8 text-sm text-[var(--insyt-muted)] sm:px-6">{children}</p>;
}

const CHIP_TONES = {
  good: "bg-emerald-50 text-emerald-800",
  open: "bg-[#fff1ec] text-[var(--insyt-primary-dark)]",
  late: "bg-red-50 text-red-700",
  neutral: "bg-[var(--insyt-canvas-alt)] text-[var(--insyt-slate)]",
} as const;

export function FinanceChip({
  tone,
  children,
}: {
  tone: keyof typeof CHIP_TONES;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        CHIP_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
