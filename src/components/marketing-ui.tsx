import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3, Megaphone, PlugZap, Send } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import type { AdminPageQuickLink } from "@/components/admin-page-header";
import { cn } from "@/lib/utils";
import type { DailyPoint } from "@/types/marketing";

export const marketingQuickLinks: AdminPageQuickLink[] = [
  { href: "/marketing", label: "Instagram", icon: BarChart3 },
  { href: "/marketing/posts", label: "Posts", icon: Send },
  { href: "/marketing/trafego", label: "Tráfego pago", icon: Megaphone },
  { href: "/marketing/conexao", label: "Conexão", icon: PlugZap },
];

export function MarketingStat({
  icon: Icon,
  label,
  value,
  hint,
  accent = false,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
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
            accent ? "text-[var(--insyt-primary)]" : "text-[var(--insyt-slate)]",
          )}
        />
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-[var(--insyt-black)]">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-[var(--insyt-muted)]">{hint}</p> : null}
    </div>
  );
}

/**
 * Barras diárias de uma série só (sem legenda: o título nomeia a série).
 * Passar o mouse mostra dia e valor; a tabela escondida serve leitor de tela.
 */
export function DailyBars({
  title,
  subtitle,
  points,
  formatValue,
}: {
  title: string;
  subtitle?: string;
  points: DailyPoint[];
  formatValue: (value: number) => string;
}) {
  const max = Math.max(...points.map((point) => point.value), 0);
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const peak = points.reduce<DailyPoint | null>(
    (best, point) => (!best || point.value > best.value ? point : best),
    null,
  );

  return (
    <section className="insyt-card overflow-hidden">
      <header className="flex items-baseline justify-between gap-3 border-b border-[var(--insyt-border)] px-6 py-4">
        <div>
          <h2 className="font-bold text-[var(--insyt-black)]">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-xs text-[var(--insyt-muted)]">{subtitle}</p>
          ) : null}
        </div>
        <p className="text-sm font-semibold tabular-nums text-[var(--insyt-black)]">
          {formatValue(total)}
        </p>
      </header>
      {points.length === 0 || max === 0 ? (
        <p className="px-6 py-10 text-sm text-[var(--insyt-muted)]">Sem dados no período.</p>
      ) : (
        <div className="px-6 pb-4 pt-8">
          <div className="flex h-36 items-end gap-[2px]" aria-hidden>
            {points.map((point) => (
              <div key={point.date} className="group relative flex h-full flex-1 items-end">
                <div
                  className="w-full rounded-t-[4px] bg-[var(--insyt-primary)] transition-opacity group-hover:opacity-80"
                  style={{
                    height: point.value > 0 ? `${Math.max(2, (point.value / max) * 100)}%` : "0",
                  }}
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-[var(--insyt-black)] px-2.5 py-1.5 text-[11px] text-white shadow-lg group-hover:block">
                  <span className="text-white/60">{dayLabel(point.date)}</span>{" "}
                  <span className="font-semibold tabular-nums">{formatValue(point.value)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between border-t border-[var(--insyt-border)] pt-2 text-[11px] text-[var(--insyt-muted)]">
            <span>{dayLabel(points[0].date)}</span>
            {peak ? (
              <span>
                pico em {dayLabel(peak.date)}: {formatValue(peak.value)}
              </span>
            ) : null}
            <span>{dayLabel(points[points.length - 1].date)}</span>
          </div>
          <table className="sr-only">
            <caption>{title}</caption>
            <tbody>
              {points.map((point) => (
                <tr key={point.date}>
                  <th scope="row">{dayLabel(point.date)}</th>
                  <td>{formatValue(point.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function dayLabel(date: string) {
  return format(parseISO(date), "dd MMM", { locale: ptBR });
}

export function RangeTabs({
  basePath,
  options,
  current,
}: {
  basePath: string;
  options: readonly number[];
  current: number;
}) {
  return (
    <div className="inline-flex rounded-full border border-[var(--insyt-border)] bg-white p-1">
      {options.map((days) => (
        <Link
          key={days}
          href={`${basePath}?dias=${days}`}
          aria-current={days === current ? "page" : undefined}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            days === current
              ? "bg-[var(--insyt-black)] text-white"
              : "text-[var(--insyt-slate)] hover:text-[var(--insyt-black)]",
          )}
        >
          {days} dias
        </Link>
      ))}
    </div>
  );
}

/** Estado vazio/erro: diz o que falta e leva para onde resolve. */
export function MarketingNotice({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="insyt-card flex flex-col items-start gap-4 p-8">
      <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--insyt-canvas)]">
        <PlugZap className="size-5 text-[var(--insyt-primary)]" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-[var(--insyt-black)]">{title}</h2>
        <div className="mt-1 max-w-xl text-sm text-[var(--insyt-slate)]">{children}</div>
      </div>
      {action ? (
        <Link
          href={action.href}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--insyt-black)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--insyt-primary)]"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
