"use client";

import { usePathname } from "next/navigation";
import { FolderKanban, Repeat, TrendingUp, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { AdminPageHeader } from "@/components/admin-page-header";

const TABS = [
  { href: "/financas", label: "Mês", icon: Wallet, exact: true },
  { href: "/financas/recorrencia", label: "Recorrência", icon: Repeat },
  { href: "/financas/projetos", label: "Projetos", icon: FolderKanban },
  { href: "/financas/projecao", label: "Projeção", icon: TrendingUp },
];

/** Cabeçalho único do módulo: as abas ficam paradas enquanto o conteúdo troca. */
export function FinanceHeader({ actions }: { actions: ReactNode }) {
  const pathname = usePathname();
  return (
    <AdminPageHeader
      compact
      title="Finanças"
      activeHref={pathname}
      quickLinks={TABS}
      actions={actions}
    />
  );
}
