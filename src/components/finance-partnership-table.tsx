"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown } from "lucide-react";
import { PartnershipPaymentToggle } from "@/components/finance-partnership-actions";
import type { PartnershipMonth, PartnershipPartner } from "@/lib/project-partnership";
import { addMonths, formatBrl } from "@/lib/subscription-billing";
import { cn } from "@/lib/utils";

function shortMonth(month: string) {
  return format(parseISO(month), "MMM/yy", { locale: ptBR });
}

function money(value: number) {
  if (value === 0) return "—";
  return value < 0 ? `−${formatBrl(-value)}` : formatBrl(value);
}

/**
 * A planilha dos sócios mês a mês. Fechada, mostra só em volta do mês atual,
 * onde estão as marcações do dia a dia; aberta, o contrato inteiro.
 */
export function FinancePartnershipTable({
  projectId,
  partners,
  rows,
  current,
}: {
  projectId: string;
  partners: PartnershipPartner[];
  rows: PartnershipMonth[];
  current: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const nearby = rows.filter(
    (row) => row.month >= addMonths(current, -1) && row.month <= addMonths(current, 1),
  );
  const visible = expanded || nearby.length === 0 ? rows : nearby;

  return (
    <div className="border-t border-[var(--insyt-border)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-right text-xs tabular-nums">
          <thead className="bg-[var(--insyt-canvas)] text-[var(--insyt-slate)]">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold sm:pl-6">Mês</th>
              <th className="px-3 py-2.5 font-semibold">Parcela</th>
              <th className="px-3 py-2.5 font-semibold">Mensalidade</th>
              <th className="px-3 py-2.5 font-semibold">Custos</th>
              <th className="px-3 py-2.5 font-semibold">Lucro</th>
              {partners.map((partner) => (
                <th key={partner.name} className="px-3 py-2.5 font-semibold">
                  {partner.me ? "Você" : partner.name}
                </th>
              ))}
              <th className="px-4 py-2.5 text-left font-semibold">Cliente</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--insyt-border)]">
            {visible.map((row) => {
              const isCurrent = row.month === current;
              const canMark = row.month <= addMonths(current, 1);
              return (
                <tr
                  key={row.month}
                  className={cn(
                    isCurrent && "bg-[var(--accent)]/40",
                    row.profit < 0 && "text-red-700",
                  )}
                >
                  <td className="px-4 py-2.5 text-left sm:pl-6">
                    <p className="font-semibold capitalize text-[var(--insyt-black)]">
                      {shortMonth(row.month)}
                    </p>
                    {row.events.length > 0 ? (
                      <p className="max-w-[12rem] text-[11px] leading-snug text-[var(--insyt-muted)]">
                        {row.events.join(" · ")}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5">{money(row.installment)}</td>
                  <td className="px-3 py-2.5">{money(row.monthly)}</td>
                  <td className="px-3 py-2.5">{money(-row.costs)}</td>
                  <td className="px-3 py-2.5 font-semibold">{money(row.profit)}</td>
                  {row.shares.map((share) => (
                    <td
                      key={share.name}
                      className={cn(
                        "px-3 py-2.5",
                        share.me && "font-bold",
                        share.me && share.amount > 0 && "text-emerald-800",
                      )}
                    >
                      {money(share.amount)}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-left">
                    {canMark || row.paidOn ? (
                      <PartnershipPaymentToggle
                        projectId={projectId}
                        month={row.month}
                        paidOn={row.paidOn}
                      />
                    ) : (
                      <span className="text-[var(--insyt-muted)]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {nearby.length > 0 && nearby.length < rows.length ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-[var(--insyt-border)] px-6 py-3 text-xs font-semibold text-[var(--insyt-slate)] transition-colors duration-150 hover:bg-[var(--insyt-canvas)] hover:text-[var(--insyt-black)]"
        >
          <ChevronDown
            className={cn("size-3.5 transition-transform duration-150", expanded && "rotate-180")}
          />
          {expanded ? "Mostrar só os meses em volta de hoje" : `Ver os ${rows.length} meses`}
        </button>
      ) : null}
    </div>
  );
}
