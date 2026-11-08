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

/**
 * Título da tela sobre o fundo claro, ações à direita e abas com sublinhado.
 * `icon` segue aceito para não mexer nas chamadas: o menu lateral já identifica a tela.
 */
export function AdminPageHeader({
  title,
  description,
  quickLinks,
  activeHref,
  actions,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  quickLinks?: AdminPageQuickLink[];
  activeHref?: string;
  actions?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  // Só a aba de endereço mais específico fica ativa: em /marketing/posts é "Posts",
  // mesmo /marketing também sendo início do caminho.
  const activeLink = quickLinks
    ?.filter(
      ({ href, exact }) =>
        activeHref === href || (!exact && activeHref?.startsWith(`${href}/`)),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <header className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-72">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--insyt-black)] sm:text-[1.75rem] sm:leading-9">
            {title}
          </h1>
          {description ? (
            <p className="mt-0.5 max-w-3xl text-sm text-[var(--insyt-slate)]">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      {quickLinks && quickLinks.length > 0 ? (
        <nav className="flex gap-1 overflow-x-auto border-b border-[var(--insyt-border)] [scrollbar-width:none]">
          {quickLinks.map(({ href, label, icon: LinkIcon }) => {
            const active = activeLink?.href === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                  active
                    ? "border-[var(--insyt-primary)] text-[var(--insyt-primary-dark)]"
                    : "border-transparent text-[var(--insyt-slate)] hover:border-[var(--insyt-border)] hover:text-[var(--insyt-black)]",
                )}
              >
                <LinkIcon className="size-4 shrink-0" strokeWidth={2} />
                {label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </header>
  );
}
