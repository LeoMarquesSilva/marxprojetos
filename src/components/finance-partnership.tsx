import { ChevronRight, Handshake } from "lucide-react";
import { FinanceEntrySheet } from "@/components/finance-entry-sheet";
import { PartnershipLaunchDialog } from "@/components/finance-partnership-actions";
import { FinancePartnershipTable } from "@/components/finance-partnership-table";
import { FinanceKpi, FinanceKpiGrid, FinanceSection } from "@/components/finance-ui";
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
  const me = plan.partners.find((partner) => partner.me);
  const collector = plan.collector;
  const costPayers = [...new Set(plan.costs.map((cost) => cost.paidBy))];
  const lastInstallment = addMonths(plan.installments.firstMonth, plan.installments.count - 1);

  return (
    <FinanceSection
      id={`sociedade-${view.id}`}
      title={
        <span className="flex items-center gap-2">
          <Handshake className="size-4 text-[var(--insyt-muted)]" />
          {view.title}
        </span>
      }
      subtitle={`O cliente paga ao ${collector}, que tira os custos e divide o lucro. No seu caixa entra só a sua parte.`}
      action={
        <span className="flex items-center gap-1">
          <PartnershipLaunchDialog projectId={view.id} launchMonth={plan.launchMonth} />
          <FinanceEntrySheet projects={projects} receiveProject={view.option} />
        </span>
      }
    >
      <FinanceKpiGrid>
        <FinanceKpi
          label="Contrato"
          value={formatBrl(view.contractAmount ?? plan.installments.total)}
          hint={`${plan.installments.count} parcelas${
            plan.monthly ? ` + ${formatBrl(plan.monthly.amount)}/mês` : ""
          }`}
        />
        <FinanceKpi
          label="Cliente pagou"
          value={`${settlement.installmentsPaid} de ${plan.installments.count}`}
          hint={`${formatBrl(settlement.clientPaid)} na conta do ${collector}`}
        />
        <FinanceKpi
          label="Sua parte até aqui"
          value={formatBrl(settlement.myEarned)}
          hint={me ? `${percent(me.share)} do lucro dos meses pagos` : "sem parte no lucro"}
        />
        <FinanceKpi
          label={`Falta o ${collector} repassar`}
          value={settlement.myPending > 0 ? formatBrl(settlement.myPending) : "Em dia"}
          tone={settlement.myPending > 0 ? "default" : "good"}
          hint={`já recebido ${formatBrl(settlement.myReceived)}`}
        />
      </FinanceKpiGrid>

      <FinancePartnershipTable
        projectId={view.id}
        partners={plan.partners}
        rows={rows}
        current={monthStartOf(today)}
      />

      <details className="group border-t border-[var(--insyt-border)]">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-5 py-3 text-xs font-semibold text-[var(--insyt-slate)] hover:text-[var(--insyt-black)] sm:px-6">
          <ChevronRight className="size-3.5 transition-transform duration-150 group-open:rotate-90" />
          Sócios, custos e contrato
        </summary>
        <div className="space-y-3 px-5 pb-5 text-xs leading-relaxed text-[var(--insyt-slate)] sm:px-6">
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
          {plan.notes ? <p className="text-[var(--insyt-muted)]">{plan.notes}</p> : null}
        </div>
      </details>
    </FinanceSection>
  );
}
