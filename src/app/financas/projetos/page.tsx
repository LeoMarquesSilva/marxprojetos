import { FinanceEntrySheet } from "@/components/finance-entry-sheet";
import { FinanceInstallmentChips } from "@/components/finance-installments";
import { FinancePartnershipCard } from "@/components/finance-partnership";
import { FinanceProjectValueDialog } from "@/components/finance-project-value";
import { InstallmentSettle } from "@/components/finance-settle";
import { FinanceEmpty, FinanceSection } from "@/components/finance-ui";
import { loadFinanceData } from "@/lib/finance-page-data";
import { dueLabel, formatBrl } from "@/lib/subscription-billing";
import { cn } from "@/lib/utils";

export default async function FinanceProjetosPage() {
  const {
    today,
    balances,
    ownOptions,
    projectOptions,
    projectReceivable,
    partnershipViews,
    scheduleByProject,
  } = await loadFinanceData();

  return (
    <div className="space-y-6">
      <FinanceSection
        title="Projetos"
        subtitle={
          projectReceivable > 0
            ? `${formatBrl(projectReceivable)} ainda a receber de desenvolvimento`
            : "Valor fechado de cada site e quanto já entrou."
        }
        action={<FinanceProjectValueDialog projects={ownOptions} />}
      >
        {balances.length === 0 ? (
          <FinanceEmpty>
            Nenhum projeto com valor fechado. Informe o valor combinado e as parcelas para elas
            aparecerem em A receber e na Projeção.
          </FinanceEmpty>
        ) : (
          <ul className="divide-y divide-[var(--insyt-border)]">
            {balances.map((balance) => {
              const option = projectOptions.find((item) => item.id === balance.id);
              const paidShare =
                balance.contractAmount && balance.contractAmount > 0
                  ? Math.min(100, Math.round((balance.received / balance.contractAmount) * 100))
                  : 0;
              const settled = balance.remaining === 0;
              const states = scheduleByProject.get(balance.id) ?? [];
              const next = states.find((state) => state.open > 0);
              const nextDue = next ? dueLabel(next.dueOn, today) : null;
              return (
                <li
                  key={balance.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6"
                >
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="truncate text-sm font-semibold text-[var(--insyt-black)]">
                      {balance.title}
                    </p>
                    <p className="text-xs text-[var(--insyt-muted)]">
                      {balance.contractAmount !== null
                        ? `fechado ${formatBrl(balance.contractAmount)} · recebido ${formatBrl(balance.received)}${
                            option && option.receivedBefore > 0
                              ? ` (${formatBrl(option.receivedBefore)} antes do sistema)`
                              : ""
                          }`
                        : `recebido ${formatBrl(balance.received)} · sem valor fechado`}
                      {balance.spent > 0 ? ` · custos ${formatBrl(balance.spent)}` : ""}
                    </p>
                    {balance.contractAmount !== null ? (
                      <div className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-[var(--insyt-canvas)]">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${paidShare}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        "text-sm font-bold tabular-nums",
                        settled ? "text-emerald-800" : "text-[var(--insyt-black)]",
                      )}
                    >
                      {balance.remaining === null
                        ? "—"
                        : settled
                          ? "Quitado"
                          : `falta ${formatBrl(balance.remaining)}`}
                    </p>
                    {balance.spent > 0 ? (
                      <p className="text-xs text-[var(--insyt-muted)]">
                        margem {formatBrl(Math.round((balance.received - balance.spent) * 100) / 100)}
                      </p>
                    ) : null}
                  </div>
                  <span className="ml-auto flex items-center gap-1">
                    {next && option ? (
                      <>
                        {/* Parcela de um mês à frente só pelo "⋯", como nas mensalidades. */}
                        {next.status !== "futuro" ? (
                          <InstallmentSettle
                            projectId={balance.id}
                            projectTitle={balance.title}
                            name={next.name}
                            amount={next.open}
                          />
                        ) : null}
                        <FinanceEntrySheet
                          projects={projectOptions}
                          receiveProject={option}
                          defaultAmount={next.open}
                          defaultDescription={`${balance.title} — ${next.name}`}
                          iconOnly
                        />
                      </>
                    ) : option && !settled ? (
                      <FinanceEntrySheet projects={projectOptions} receiveProject={option} />
                    ) : null}
                    {option ? (
                      <FinanceProjectValueDialog projects={ownOptions} project={option} />
                    ) : null}
                  </span>

                  {states.length > 0 ? (
                    <div className="w-full space-y-1.5 pt-1">
                      {next && nextDue ? (
                        <p className="text-xs text-[var(--insyt-slate)]">
                          Próxima:{" "}
                          <span className="font-semibold text-[var(--insyt-black)]">
                            {formatBrl(next.open)}
                          </span>{" "}
                          ({next.name}),{" "}
                          <span className={cn(nextDue.late && "font-semibold text-red-700")}>
                            {nextDue.text}
                          </span>
                        </p>
                      ) : null}
                      <FinanceInstallmentChips states={states} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </FinanceSection>

      {partnershipViews.map((view) => (
        <FinancePartnershipCard
          key={view.id}
          view={view}
          projects={projectOptions}
          today={today}
        />
      ))}
    </div>
  );
}
