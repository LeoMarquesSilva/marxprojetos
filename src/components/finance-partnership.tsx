import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Handshake } from "lucide-react";
import { FinanceEntrySheet } from "@/components/finance-entry-sheet";
import {
  PartnershipLaunchDialog,
  PartnershipPaymentToggle,
} from "@/components/finance-partnership-actions";
import type {
  PartnershipMonth,
  PartnershipSettlement,
  ProjectPartnership,
} from "@/lib/project-partnership";
import { addMonths, formatBrl, monthStartOf } from "@/lib/subscription-billing";
import { formatMonthLabel } from "@/lib/subscription-format";
import { cn } from "@/lib/utils";
import type { FinanceProjectOption } from "@/types/finance";

export type PartnershipView = {
  id: string;
  title: string;
  contractAmount: number | null;
  plan: ProjectPartnership;
  settlement: PartnershipSettlement;
  rows: PartnershipMonth[];
  option: FinanceProjectOption;
};

function percent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function shortMonth(month: string) {
  return format(parseISO(month), "MMM/yy", { locale: ptBR });
}

function money(value: number) {
  if (value === 0) return "—";
  return value < 0 ? `−${formatBrl(-value)}` : formatBrl(value);
}

function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "warn" | "ok";
}) {
  return (
    <div className="rounded-2xl bg-[var(--insyt-canvas)] px-4 py-3">
      <p className="text-xs text-[var(--insyt-slate)]">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-bold tabular-nums",
          tone === "warn" && "text-amber-700",
          tone === "ok" && "text-emerald-800",
          tone === "default" && "text-[var(--insyt-black)]",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-[var(--insyt-muted)]">{hint}</p>
    </div>
  );
}

/**
 * Projeto em sociedade: o contrato cheio, quanto o cliente já pagou a quem
 * recebe, a divisão de cada mês (como a planilha dos sócios) e quanto da
 * minha parte ainda não chegou no caixa.
 */
export function FinancePartnershipCard({
  view,
  projects,
  today,
}: {
  view: PartnershipView;
  projects: FinanceProjectOption[];
  today: string;
}) {
  const { plan, settlement, rows } = view;
  const current = monthStartOf(today);
  const me = plan.partners.find((partner) => partner.me);
  const collector = plan.collector;
  const costPayers = [...new Set(plan.costs.map((cost) => cost.paidBy))];
  const lastInstallment = addMonths(plan.installments.firstMonth, plan.installments.count - 1);

  return (
    <section id={`sociedade-${view.id}`} className="insyt-card scroll-mt-24 overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--insyt-border)] px-6 py-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-bold text-[var(--insyt-black)]">
            <Handshake className="size-4 text-[var(--insyt-muted)]" />
            {view.title}
          </h2>
          <p className="mt-1 text-xs text-[var(--insyt-muted)]">
            Sociedade · o cliente paga ao {collector}, que tira os custos e divide o lucro.
            No seu caixa entra só a sua parte, quando ele repassa.
          </p>
        </div>
        <span className="flex items-center gap-1">
          <PartnershipLaunchDialog projectId={view.id} launchMonth={plan.launchMonth} />
          <FinanceEntrySheet projects={projects} receiveProject={view.option} />
        </span>
      </header>

      <div className="grid gap-3 px-6 py-5 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Contrato"
          value={formatBrl(view.contractAmount ?? plan.installments.total)}
          hint={`${plan.installments.count} parcelas${
            plan.monthly ? ` + ${formatBrl(plan.monthly.amount)}/mês` : ""
          }`}
        />
        <Stat
          label="Cliente pagou"
          value={`${settlement.installmentsPaid} de ${plan.installments.count} parcelas`}
          hint={`${formatBrl(settlement.clientPaid)} na conta do ${collector}`}
        />
        <Stat
          label="Sua parte até aqui"
          value={formatBrl(settlement.myEarned)}
          hint={me ? `${percent(me.share)} do lucro dos meses pagos` : "sem parte no lucro"}
        />
        <Stat
          label={`Falta o ${collector} repassar`}
          value={settlement.myPending > 0 ? formatBrl(settlement.myPending) : "Em dia"}
          hint={`já recebido ${formatBrl(settlement.myReceived)}`}
          tone={settlement.myPending > 0 ? "warn" : "ok"}
        />
      </div>

      <div className="space-y-1.5 px-6 pb-5 text-xs text-[var(--insyt-slate)]">
        <p className="flex flex-wrap gap-1.5">
          {plan.partners.map((partner) => (
            <span
              key={partner.name}
              className={cn(
                "rounded-md px-2 py-1 font-semibold",
                partner.me
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-[var(--insyt-canvas-alt)] text-[var(--insyt-slate)]",
              )}
            >
              {partner.me ? "Você" : partner.name} {percent(partner.share)}
              {partner.name === collector ? " · recebe" : ""}
            </span>
          ))}
        </p>
        {plan.costs.length > 0 ? (
          <p>
            Custos estimados:{" "}
            {plan.costs
              .map(
                (cost) =>
                  `${cost.description} ${formatBrl(cost.amount)}/${cost.every === "ano" ? "ano" : "mês"}`,
              )
              .join(" · ")}
            {costPayers.length === 1 ? `, no cartão do ${costPayers[0]}` : ""}. Saem antes da
            divisão e voltam para quem pagou.
          </p>
        ) : null}
        <p>
          {plan.launchMonth
            ? `Lançamento previsto em ${formatMonthLabel(plan.launchMonth)}`
            : "Lançamento ainda sem data"}
          {plan.monthly
            ? `; a mensalidade começa em ${formatMonthLabel(plan.monthly.firstMonth)}.`
            : "."}
          {` Última parcela em ${formatMonthLabel(lastInstallment)}.`}
        </p>
      </div>

      <div className="overflow-x-auto border-t border-[var(--insyt-border)]">
        <table className="w-full min-w-[760px] text-right text-xs tabular-nums">
          <thead className="bg-[var(--insyt-canvas)] text-[var(--insyt-slate)]">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold">Mês</th>
              <th className="px-3 py-2.5 font-semibold">Parcela</th>
              <th className="px-3 py-2.5 font-semibold">Mensalidade</th>
              <th className="px-3 py-2.5 font-semibold">Custos</th>
              <th className="px-3 py-2.5 font-semibold">Lucro</th>
              {plan.partners.map((partner) => (
                <th key={partner.name} className="px-3 py-2.5 font-semibold">
                  {partner.me ? "Você" : partner.name}
                </th>
              ))}
              <th className="px-4 py-2.5 text-left font-semibold">Cliente</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--insyt-border)]">
            {rows.map((row) => {
              const isCurrent = row.month === current;
              const canMark = row.month <= addMonths(current, 1);
              return (
                <tr
                  key={row.month}
                  className={cn(isCurrent && "bg-[var(--accent)]/40", row.profit < 0 && "text-red-700")}
                >
                  <td className="px-4 py-2.5 text-left">
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
                        projectId={view.id}
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

      {plan.notes ? (
        <p className="border-t border-[var(--insyt-border)] px-6 py-4 text-xs leading-relaxed text-[var(--insyt-muted)]">
          {plan.notes}
        </p>
      ) : null}
    </section>
  );
}
