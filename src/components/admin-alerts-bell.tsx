"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import type { ShellAlert } from "@/lib/shell-types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Cada página monta o próprio AdminShell, então o sino nasce de novo a cada troca de
// tela. Guardar o último resultado evita que o ponto suma até a resposta chegar. Só o
// navegador escreve aqui; numa carga completa começa nulo, igual ao servidor.
let lastAlerts: ShellAlert[] | null = null;

/**
 * Sino do topo: o que pede ação agora. Busca de novo ao trocar de tela e quando a
 * página é atualizada depois de gravar algo, o que muda `refreshKey`.
 */
export function AdminAlertsBell({ refreshKey }: { refreshKey?: unknown }) {
  const pathname = usePathname();
  const [alerts, setAlerts] = useState<ShellAlert[] | null>(lastAlerts);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/shell/alerts", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`alertas: ${response.status}`);
        return response.json();
      })
      .then((next: ShellAlert[]) => {
        lastAlerts = next;
        setAlerts(next);
        setFailed(false);
      })
      .catch(() => {
        // Falhar não impede de usar a tela, mas não pode parecer "nada atrasado".
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [pathname, refreshKey]);

  const lateCount = alerts?.filter((alert) => alert.tone === "late").length ?? 0;
  const total = alerts?.length ?? 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={total > 0 ? `Alertas: ${total}` : "Alertas"}
            className="relative shrink-0"
          >
            <Bell className="size-5" />
            {total > 0 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute right-1.5 top-1.5 size-2.5 rounded-full ring-2 ring-[var(--insyt-canvas)]",
                  lateCount > 0 ? "bg-red-600" : "bg-[var(--insyt-primary)]",
                )}
              />
            ) : null}
          </Button>
        }
      />
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[min(22rem,calc(100vw-2rem))] gap-0 rounded-2xl bg-white p-0"
      >
        <div className="border-b border-[var(--insyt-border)] px-4 py-3">
          <p className="text-sm font-bold text-[var(--insyt-black)]">O que pede atenção</p>
        </div>
        {alerts === null || (failed && alerts.length === 0) ? (
          <p className="px-4 py-6 text-sm text-[var(--insyt-muted)]">
            {failed ? "Não consegui carregar os alertas." : "Carregando…"}
          </p>
        ) : alerts.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--insyt-muted)]">
            Nada atrasado nem esperando resposta.
          </p>
        ) : (
          <ul className="max-h-[22rem] divide-y divide-[var(--insyt-border)] overflow-y-auto">
            {alerts.map((alert) => (
              <li key={alert.id}>
                <Link
                  href={alert.href}
                  onClick={() => setOpen(false)}
                  className="flex gap-3 px-4 py-3 transition-colors duration-150 hover:bg-[var(--insyt-canvas)]"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      alert.tone === "late" ? "bg-red-600" : "bg-[var(--insyt-primary)]",
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[var(--insyt-black)]">
                      {alert.title}
                    </span>
                    <span className="block truncate text-xs text-[var(--insyt-muted)]">
                      {alert.detail}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
