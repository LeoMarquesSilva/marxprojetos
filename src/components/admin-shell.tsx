"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogOut, Plus, Sparkles, Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/actions/auth";

const nav = [
  { href: "/dashboard", label: "Briefings", icon: LayoutDashboard },
  { href: "/projects/new", label: "Novo briefing", icon: Plus },
];

export function AdminShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail?: string | null;
}) {
  const pathname = usePathname();
  const [isPinned, setIsPinned] = useState(false);

  return (
    <div className="relative min-h-screen bg-white selection:bg-[var(--insyt-primary)] selection:text-white">
      {/* Desktop Sidebar (Floating & Expandable) */}
      <aside 
        className={cn(
          "group/sidebar insyt-dark-surface fixed inset-y-4 left-4 z-40 hidden flex-col overflow-hidden rounded-[2rem] border border-white/[0.08] text-white shadow-[0_20px_50px_-20px_rgba(0,0,0,0.45)] transition-all duration-500 ease-fluid lg:flex",
          isPinned ? "w-[280px]" : "w-[88px] hover:w-[280px]"
        )}
      >
        <div
          className={cn(
            "insyt-dark-surface-glow pointer-events-none absolute inset-0 transition-opacity duration-500 ease-fluid",
            isPinned ? "opacity-100" : "opacity-0 group-hover/sidebar:opacity-100",
          )}
        />

        <div className={cn(
          "relative border-b border-white/10 py-8 flex items-center transition-all duration-500 ease-fluid",
          isPinned ? "px-8 justify-between" : "justify-center group-hover/sidebar:px-8 group-hover/sidebar:justify-between"
        )}>
          <div className={cn(isPinned ? "hidden" : "group-hover/sidebar:hidden")}>
            <BrandLogo href="/dashboard" variant="mark" />
          </div>
          <div className={cn("hidden", isPinned ? "block" : "group-hover/sidebar:block")}>
            <BrandLogo href="/dashboard" variant="light" />
          </div>
          
          <button 
            onClick={() => setIsPinned(!isPinned)}
            className={cn(
              "hidden text-white/40 hover:text-white transition-colors",
              isPinned ? "block" : "group-hover/sidebar:block"
            )}
            title={isPinned ? "Desafixar menu" : "Fixar menu"}
          >
            {isPinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
          </button>
        </div>

        <nav className="relative space-y-2 px-4 py-8 flex-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href ||
              (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium transition-all duration-500 ease-fluid overflow-hidden",
                  active
                    ? "bg-white/10 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                    : "text-white/60 hover:bg-white/5 hover:text-white",
                  isPinned ? "justify-start" : "justify-center group-hover/sidebar:justify-start"
                )}
              >
                <Icon className={cn("size-5 shrink-0 transition-transform duration-500 ease-fluid", active ? "text-[var(--insyt-primary)]" : "group-hover:scale-110")} />
                <span className={cn(
                  "whitespace-nowrap transition-all duration-500 ease-fluid",
                  isPinned 
                    ? "opacity-100 w-auto translate-x-0" 
                    : "opacity-0 w-0 translate-x-[-10px] group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto group-hover/sidebar:translate-x-0"
                )}>
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className={cn(
          "relative mt-auto border-t border-white/10 transition-all duration-500 ease-fluid",
          isPinned ? "p-5" : "p-4 group-hover/sidebar:p-5"
        )}>
          <div className={cn(
            "rounded-[1.5rem] transition-all duration-500 ease-fluid overflow-hidden flex",
            isPinned 
              ? "bg-white/5 p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] block" 
              : "bg-transparent group-hover/sidebar:bg-white/5 p-0 group-hover/sidebar:p-5 group-hover/sidebar:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] justify-center group-hover/sidebar:block"
          )}>
            <div className={cn(
              "mb-3 items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--insyt-primary)]",
              isPinned ? "flex" : "hidden group-hover/sidebar:flex"
            )}>
              <Sparkles className="size-3.5 shrink-0" />
              INSYT
            </div>
            <Sparkles className={cn(
              "size-5 text-[var(--insyt-primary)] my-2",
              isPinned ? "hidden" : "block group-hover/sidebar:hidden"
            )} />
            <p className={cn(
              "text-sm leading-relaxed text-white/70 whitespace-nowrap transition-opacity duration-500 delay-100",
              isPinned ? "block opacity-100" : "hidden group-hover/sidebar:block opacity-0 group-hover/sidebar:opacity-100"
            )}>
              Briefings organizados para acelerar<br/>seus projetos web.
            </p>
          </div>

          <div className={cn(
            "mt-4 flex items-center gap-3 px-2",
            isPinned ? "justify-between" : "justify-center group-hover/sidebar:justify-between"
          )}>
            {userEmail ? (
              <p className={cn(
                "truncate text-xs font-medium text-white/40 transition-opacity duration-500 delay-100",
                isPinned ? "block opacity-100" : "hidden group-hover/sidebar:block opacity-0 group-hover/sidebar:opacity-100"
              )}>{userEmail}</p>
            ) : (
              <span className={cn(isPinned ? "block" : "hidden group-hover/sidebar:block")} />
            )}
            <form action={signOut}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-all duration-500 ease-fluid"
              >
                <LogOut className="size-5 shrink-0" />
              </Button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div 
        className={cn(
          "relative flex min-h-screen flex-col bg-white transition-all duration-500 ease-fluid",
          isPinned ? "lg:pl-[312px]" : "lg:pl-[120px]"
        )}
      >
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 border-b border-[var(--insyt-border)] bg-white/90 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between px-6 py-5">
            <BrandLogo href="/dashboard" showProduct={false} />
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm" className="rounded-full">
                <LogOut className="size-4" />
              </Button>
            </form>
          </div>
          <div className="flex gap-2 overflow-x-auto px-6 pb-5 scrollbar-hide">
            {nav.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-500 ease-fluid",
                  pathname === href ||
                    (href !== "/dashboard" && pathname.startsWith(href))
                    ? "bg-[var(--insyt-black)] text-white shadow-md"
                    : "bg-white text-[var(--insyt-slate)] border border-[var(--insyt-border)]",
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-6 py-12 sm:px-10 sm:py-24 lg:py-32">
          {children}
        </main>
      </div>
    </div>
  );
}
