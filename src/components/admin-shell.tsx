"use client";

import { useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  FileText,
  Globe,
  Home,
  LogOut,
  Megaphone,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Radar,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { AdminAlertsBell } from "@/components/admin-alerts-bell";
import { AdminSearch } from "@/components/admin-search";
import { BrandLogo } from "@/components/brand-logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { MENU_STORAGE_KEY } from "@/lib/admin-menu";
import { displayNameFromEmail } from "@/lib/greeting";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Início", icon: Home },
  { href: "/sites", label: "Sites", icon: Globe },
  { href: "/crm", label: "CRM", icon: Users },
  { href: "/prospeccao", label: "Prospecção", icon: Radar },
  { href: "/propostas", label: "Propostas", icon: FileText },
  { href: "/financas", label: "Finanças", icon: Wallet },
  { href: "/marketing", label: "Marketing", icon: Megaphone },
  { href: "/portfolio/gerenciar", label: "Portfólio", icon: BriefcaseBusiness },
];

const bottomNav = [{ href: "/configuracoes", label: "Configurações", icon: Settings }];

function isActive(pathname: string, href: string) {
  return (
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    // O detalhe de um briefing nasce da lista da Início.
    (href === "/dashboard" && pathname.startsWith("/projects/") && pathname !== "/projects/new")
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : ""}`.toUpperCase();
}

const menuListeners = new Set<() => void>();

function subscribeToMenu(listener: () => void) {
  menuListeners.add(listener);
  return () => {
    menuListeners.delete(listener);
  };
}

function isMenuCollapsed() {
  return document.documentElement.dataset.menu === "recolhido";
}

function setMenuCollapsed(collapsed: boolean) {
  if (collapsed) document.documentElement.dataset.menu = "recolhido";
  else delete document.documentElement.dataset.menu;
  try {
    localStorage.setItem(MENU_STORAGE_KEY, collapsed ? "recolhido" : "aberto");
  } catch {
    // Sem armazenamento, o menu ainda recolhe; só não lembra na próxima visita.
  }
  menuListeners.forEach((listener) => listener());
}

/** Recolhe o menu lateral para só os ícones. Só aparece onde o menu é fixo. */
function MenuCollapseButton() {
  const collapsed = useSyncExternalStore(subscribeToMenu, isMenuCollapsed, () => false);
  const label = collapsed ? "Abrir menu lateral" : "Recolher menu lateral";
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-expanded={!collapsed}
      onClick={() => setMenuCollapsed(!collapsed)}
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon-sm" }),
        "hidden shrink-0 lg:inline-flex",
      )}
    >
      <Icon className="size-[18px]" />
    </button>
  );
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  function renderLink({ href, label, icon: Icon }: (typeof nav)[number]) {
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        onClick={onNavigate}
        title={label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 menu-recolhido:justify-center menu-recolhido:px-0",
          active
            ? "bg-[var(--insyt-primary-dark)] text-white shadow-[0_8px_18px_-10px_rgba(247,66,17,0.9)]"
            : "text-white/70 hover:bg-white/[0.07] hover:text-white",
        )}
      >
        <Icon className="size-[18px] shrink-0" strokeWidth={2} />
        <span className="menu-recolhido:sr-only">{label}</span>
      </Link>
    );
  }

  return (
    <>
      <nav aria-label="Principal" className="flex-1 space-y-1 overflow-y-auto px-3 pt-2">
        {nav.map(renderLink)}
        <Link
          href="/projects/new"
          onClick={onNavigate}
          title="Novo briefing"
          aria-current={pathname === "/projects/new" ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 menu-recolhido:justify-center menu-recolhido:px-0",
            pathname === "/projects/new"
              ? "bg-[var(--insyt-primary-dark)] text-white"
              : "text-white/70 hover:bg-white/[0.07] hover:text-white",
          )}
        >
          <Plus className="size-[18px] shrink-0" strokeWidth={2} />
          <span className="menu-recolhido:sr-only">Novo briefing</span>
        </Link>
      </nav>
      <nav aria-label="Conta" className="space-y-1 border-t border-white/10 px-3 py-3">
        {bottomNav.map(renderLink)}
      </nav>
    </>
  );
}

function UserBlock({ email }: { email?: string | null }) {
  const name = displayNameFromEmail(email);
  return (
    <div className="flex items-center gap-2.5 border-t border-white/10 py-4 pl-4 pr-2 menu-recolhido:flex-col menu-recolhido:gap-1.5 menu-recolhido:px-0 menu-recolhido:py-3">
      <span
        title={name}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--insyt-tint-strong)] text-xs font-semibold text-[var(--insyt-primary-dark)]"
      >
        <span aria-hidden>{initials(name)}</span>
      </span>
      <div className="min-w-0 flex-1 menu-recolhido:hidden">
        <p className="truncate text-[13px] font-semibold text-white">{name}</p>
        {email ? <p className="truncate text-[11px] text-white/55">{email}</p> : null}
      </div>
      <form action={signOut}>
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          title="Sair"
          aria-label="Sair"
          className="text-white/60 hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-4" />
        </Button>
      </form>
    </div>
  );
}

export function AdminShell({
  children,
  userEmail,
  wide = false,
}: {
  children: React.ReactNode;
  userEmail?: string | null;
  /** Kanban e boards largos usam toda a largura disponível. */
  wide?: boolean;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      data-admin-shell
      className="relative min-h-screen bg-[var(--insyt-canvas)] selection:bg-[#ffd9c8]"
    >
      <aside className="insyt-dark-surface fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col overflow-hidden text-white transition-[width] duration-150 motion-reduce:transition-none lg:flex menu-recolhido:w-[72px]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-[radial-gradient(90%_70%_at_0%_100%,rgba(247,66,17,0.40)_0%,transparent_75%)]"
        />
        <div className="relative px-5 py-5 menu-recolhido:flex menu-recolhido:justify-center menu-recolhido:px-0">
          <span className="block menu-recolhido:hidden">
            <BrandLogo href="/dashboard" variant="horizontal-light" showProduct={false} />
          </span>
          <Link href="/dashboard" aria-label="Início" className="hidden menu-recolhido:block">
            <Image src="/brand/insyt-icon.svg" alt="" width={28} height={28} />
          </Link>
        </div>
        <div className="relative flex min-h-0 flex-1 flex-col">
          <NavLinks pathname={pathname} />
        </div>
        <div className="relative">
          <UserBlock email={userEmail} />
        </div>
      </aside>

      <div className="flex min-h-screen flex-col transition-[padding] duration-150 motion-reduce:transition-none lg:pl-[232px] menu-recolhido:pl-[72px]">
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--insyt-border)] bg-[var(--insyt-canvas)]/90 px-4 py-3 backdrop-blur-md sm:px-8">
          <MenuCollapseButton />
          <button
            type="button"
            aria-label="Abrir menu"
            onClick={() => setMenuOpen(true)}
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "lg:hidden")}
          >
            <Menu className="size-5" />
          </button>
          <Link href="/dashboard" aria-label="Início" className="shrink-0 lg:hidden">
            <Image src="/brand/insyt-icon.svg" alt="" width={28} height={28} />
          </Link>
          <div className="min-w-0 flex-1">
            <AdminSearch />
          </div>
          {/* children só muda quando o servidor manda a página de novo, como depois de gravar. */}
          <AdminAlertsBell refreshKey={children} />
        </div>

        <main
          className={cn(
            "mx-auto w-full flex-1 px-4 py-6 sm:px-8 sm:py-7",
            wide ? "max-w-[1760px]" : "max-w-[1320px]",
          )}
        >
          {children}
        </main>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="insyt-dark-surface flex w-[260px] flex-col gap-0 border-none p-0 text-white data-[side=left]:w-[260px]"
        >
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="px-5 py-5">
            <BrandLogo href="/dashboard" variant="horizontal-light" showProduct={false} />
          </div>
          <NavLinks pathname={pathname} onNavigate={() => setMenuOpen(false)} />
          <UserBlock email={userEmail} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
