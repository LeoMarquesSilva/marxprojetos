import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminPageQuickLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Só fica ativo na própria rota, não nas filhas (a primeira aba de um módulo). */
  exact?: boolean;
};

export function AdminPageHeader({
  icon: Icon,
  title,
  description,
  quickLinks,
  activeHref,
  actions,
  className,
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  quickLinks?: AdminPageQuickLink[];
  activeHref?: string;
  actions?: React.ReactNode;
  className?: string;
  /** Telas de trabalho: título e abas em pouco espaço, o conteúdo sobe. */
  compact?: boolean;
}) {
  const links =
    quickLinks && quickLinks.length > 0 ? (
      <nav className={cn("flex flex-wrap gap-2", compact ? "mt-5" : "mt-8")}>
        {quickLinks.map(({ href, label, icon: LinkIcon, exact }) => {
          const active =
            activeHref === href ||
            (!exact && href !== "/dashboard" && activeHref?.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-200",
                active
                  ? "border-white/15 bg-white/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  : "border-white/10 bg-black/20 text-white/75 hover:border-white/15 hover:bg-white/8 hover:text-white",
              )}
            >
              <LinkIcon className="size-3.5 shrink-0 opacity-80" strokeWidth={2} />
              {label}
            </Link>
          );
        })}
      </nav>
    ) : null;

  return (
    <header
      className={cn(
        "insyt-dark-surface relative overflow-hidden rounded-3xl border border-white/[0.08] text-white shadow-[0_20px_50px_-20px_rgba(0,0,0,0.45)]",
        className,
      )}
    >
      <div className="insyt-dark-surface-glow pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px] opacity-60"
        aria-hidden
      />

      <div className={cn("relative", compact ? "px-6 py-6 sm:px-8" : "p-8 sm:p-10")}>
        <div
          className={cn(
            "flex",
            compact
              ? "items-center justify-between gap-4"
              : "flex-col gap-8 lg:flex-row lg:items-start lg:justify-between",
          )}
        >
          <div className="min-w-0 flex-1">
            {Icon && !compact ? (
              <div
                className="mb-5 flex size-10 items-center justify-center rounded-xl border border-white/10 bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              >
                <Icon className="size-[18px] text-[var(--insyt-primary)]" strokeWidth={2.25} />
              </div>
            ) : null}

            <h1
              className={cn(
                "font-bold tracking-tight text-white",
                compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl",
              )}
            >
              {title}
            </h1>
            {description ? (
              <p className="mt-2 text-sm text-white/45 sm:text-base">
                {description}
              </p>
            ) : null}

            {compact ? null : links}
          </div>

          {actions ? (
            <div className={cn("shrink-0", !compact && "lg:pt-1")}>{actions}</div>
          ) : null}
        </div>

        {compact ? links : null}
      </div>
    </header>
  );
}
