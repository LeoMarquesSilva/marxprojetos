"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { setProjectContractAmount } from "@/app/actions/finance";
import { financeSelectClassName } from "@/components/finance-entry-sheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { nextInstallmentDate, type ScheduledInstallment } from "@/lib/project-schedule";
import { formatBrl, parseBrlAmount, todayInBrasilia } from "@/lib/subscription-billing";
import type { FinanceProjectOption } from "@/types/finance";

type ScheduleRow = { key: number; dueOn: string; amount: string; label: string | null };

function formatInput(value: number | null | undefined) {
  return value ? value.toFixed(2).replace(".", ",") : "";
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

/** Define o valor fechado e as parcelas de um projeto. Com `project`, já abre nele. */
export function FinanceProjectValueDialog({
  projects,
  project,
}: {
  projects: FinanceProjectOption[];
  project?: FinanceProjectOption;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [amount, setAmount] = useState("");
  const [receivedBefore, setReceivedBefore] = useState("");
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const nextKey = useRef(0);
  const [isPending, startTransition] = useTransition();

  const contract = parseBrlAmount(amount);
  const scheduledTotal = round(
    rows.reduce((sum, row) => sum + (parseBrlAmount(row.amount) ?? 0), 0),
  );
  const difference = contract === null ? 0 : round(contract - scheduledTotal);

  function fill(item: FinanceProjectOption | undefined) {
    setProjectId(item?.id ?? "");
    setAmount(formatInput(item?.contractAmount));
    setReceivedBefore(formatInput(item?.receivedBefore));
    setRows(
      (item?.schedule ?? []).map((installment) => ({
        key: nextKey.current++,
        dueOn: installment.dueOn,
        amount: formatInput(installment.amount),
        label: installment.label,
      })),
    );
  }

  function openDialog() {
    fill(project ?? projects.find((item) => item.contractAmount === null) ?? projects[0]);
    setOpen(true);
  }

  function addRow() {
    const last = rows.at(-1);
    setRows([
      ...rows,
      {
        key: nextKey.current++,
        dueOn: last ? nextInstallmentDate(last.dueOn) : todayInBrasilia(),
        amount: difference > 0 ? formatInput(difference) : (last?.amount ?? ""),
        label: null,
      },
    ]);
  }

  function updateRow(key: number, patch: Partial<ScheduleRow>) {
    setRows(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function save() {
    if (!projectId) {
      toast.error("Escolha o projeto.");
      return;
    }
    const parsed = amount.trim() ? parseBrlAmount(amount) : null;
    if (amount.trim() && parsed === null) {
      toast.error("Informe um valor válido.");
      return;
    }
    const parsedBefore = receivedBefore.trim() ? parseBrlAmount(receivedBefore) : 0;
    if (parsedBefore === null) {
      toast.error("Informe um valor recebido válido.");
      return;
    }
    const schedule: ScheduledInstallment[] = [];
    for (const row of rows) {
      const value = parseBrlAmount(row.amount);
      if (!row.dueOn || value === null || value <= 0) {
        toast.error("Confira as parcelas: cada uma precisa de data e valor maior que zero.");
        return;
      }
      schedule.push({ dueOn: row.dueOn, amount: value, label: row.label });
    }

    startTransition(async () => {
      const result = await setProjectContractAmount(projectId, parsed, parsedBefore, schedule);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(parsed === null ? "Valor removido." : "Valor e parcelas salvos.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {project ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Editar valor e parcelas"
          aria-label={`Editar valor e parcelas: ${project.title}`}
          onClick={openDialog}
        >
          <Pencil className="size-3.5" />
        </Button>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={openDialog}>
          <Plus className="size-3.5" />
          Valor de projeto
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-3xl bg-white p-0 sm:max-w-md">
          <DialogHeader className="border-b border-[var(--insyt-border)] px-6 py-5 pr-12">
            <DialogTitle className="text-2xl font-bold text-[var(--insyt-black)]">
              Valor e parcelas
            </DialogTitle>
            <DialogDescription>
              Quanto foi combinado pelo desenvolvimento e quando cada parcela entra.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
            <div className="space-y-2">
              <Label htmlFor="project-value-project">Projeto</Label>
              <select
                id="project-value-project"
                className={financeSelectClassName}
                value={projectId}
                onChange={(event) =>
                  fill(projects.find((item) => item.id === event.target.value))
                }
                disabled={Boolean(project)}
              >
                {projects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="project-value-amount">Valor fechado (R$)</Label>
                <Input
                  id="project-value-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="1.297,00"
                  className="text-lg font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-value-before">Já recebido antes (R$)</Label>
                <Input
                  id="project-value-before"
                  inputMode="decimal"
                  value={receivedBefore}
                  onChange={(event) => setReceivedBefore(event.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>
            <p className="text-xs text-[var(--insyt-muted)]">
              “Já recebido antes” é o que entrou antes de você usar Finanças: abate o que falta,
              mas não aparece no caixa. Deixe o valor fechado vazio para tirar o projeto da lista.
            </p>

            <section className="space-y-3 border-t border-[var(--insyt-border)] pt-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-bold text-[var(--insyt-black)]">Parcelas</h3>
                <Button type="button" variant="outline" size="sm" onClick={addRow}>
                  <Plus className="size-3.5" />
                  Adicionar
                </Button>
              </div>

              {rows.length === 0 ? (
                <p className="text-xs text-[var(--insyt-muted)]">
                  Sem parcelas, o que falta fica sem data e não entra em A receber nem na
                  Projeção.
                </p>
              ) : (
                <>
                  <ul className="space-y-2">
                    {rows.map((row, index) => (
                      <li key={row.key} className="flex items-center gap-2">
                        <Input
                          type="date"
                          aria-label={`Vencimento da parcela ${index + 1}`}
                          value={row.dueOn}
                          onChange={(event) => updateRow(row.key, { dueOn: event.target.value })}
                          className="min-w-0 flex-1"
                        />
                        <Input
                          inputMode="decimal"
                          aria-label={`Valor da parcela ${index + 1}`}
                          value={row.amount}
                          onChange={(event) => updateRow(row.key, { amount: event.target.value })}
                          placeholder="750,00"
                          className="w-28 shrink-0"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title="Tirar esta parcela"
                          aria-label={`Tirar a parcela ${index + 1}`}
                          onClick={() => setRows(rows.filter((item) => item.key !== row.key))}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-[var(--insyt-muted)]">
                    Soma {formatBrl(scheduledTotal)}
                    {contract === null || contract === 0 ? (
                      ""
                    ) : difference === 0 ? (
                      " · bate com o valor fechado"
                    ) : difference > 0 ? (
                      <span className="font-semibold text-amber-800">
                        {" "}
                        · faltam {formatBrl(difference)} para o valor fechado
                      </span>
                    ) : (
                      <span className="font-semibold text-amber-800">
                        {" "}
                        · passa {formatBrl(-difference)} do valor fechado
                      </span>
                    )}
                    . O que entrar no projeto abate da parcela mais antiga para a mais nova.
                  </p>
                </>
              )}
            </section>
          </div>

          <div className="border-t border-[var(--insyt-border)] px-6 py-4">
            <Button type="button" className="w-full" disabled={isPending} onClick={save}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
