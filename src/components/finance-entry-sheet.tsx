"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createFinanceEntry,
  deleteFinanceEntry,
  updateFinanceEntry,
} from "@/app/actions/finance";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  formatBrl,
  parseBrlAmount,
  todayInBrasilia,
  toAmount,
} from "@/lib/subscription-billing";
import { cn } from "@/lib/utils";
import {
  FINANCE_EXPENSE_CATEGORIES,
  FINANCE_INCOME_CATEGORIES,
  type FinanceEntry,
  type FinanceKind,
  type FinanceProjectOption,
} from "@/types/finance";

export const financeSelectClassName =
  "w-full rounded-xl border border-transparent bg-[var(--insyt-canvas)] px-4 py-3 text-sm font-medium text-[var(--insyt-black)] outline-none transition-all duration-300 hover:border-[var(--insyt-border)] hover:bg-white focus:border-[var(--insyt-primary)]/50 focus:bg-white focus:ring-4 focus:ring-[var(--insyt-primary)]/10";

function categoriesFor(kind: FinanceKind): readonly string[] {
  return kind === "entrada" ? FINANCE_INCOME_CATEGORIES : FINANCE_EXPENSE_CATEGORIES;
}

function formatInput(value: number) {
  return value.toFixed(2).replace(".", ",");
}

/**
 * Sem `entry`, abre um lançamento novo; com `entry`, edita o existente.
 * `receiveProject` abre já como recebimento do restante daquele projeto.
 */
export function FinanceEntrySheet({
  entry,
  projects,
  receiveProject,
}: {
  entry?: FinanceEntry;
  projects: FinanceProjectOption[];
  receiveProject?: FinanceProjectOption;
}) {
  const router = useRouter();
  const editing = Boolean(entry);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FinanceKind>("entrada");
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(todayInBrasilia());
  const [category, setCategory] = useState<string>(FINANCE_INCOME_CATEGORIES[0]);
  const [projectId, setProjectId] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const categories = categoriesFor(kind);
  const project = projects.find((item) => item.id === projectId) ?? null;
  // Ao editar, o próprio lançamento já está em "received": não conta duas vezes.
  const alreadyReceived = project
    ? project.received -
      (entry && entry.kind === "entrada" && entry.project_id === project.id
        ? toAmount(entry.amount)
        : 0)
    : 0;
  const remaining =
    project?.contractAmount != null
      ? Math.max(0, Math.round((project.contractAmount - alreadyReceived) * 100) / 100)
      : null;

  function openSheet() {
    if (entry) {
      setKind(entry.kind);
      setAmount(formatInput(toAmount(entry.amount)));
      setOccurredOn(entry.occurred_on);
      setCategory(entry.category);
      setProjectId(entry.project_id ?? "");
      setDescription(entry.description);
      setNotes(entry.notes ?? "");
    } else if (receiveProject) {
      const rest =
        receiveProject.contractAmount != null
          ? Math.max(0, receiveProject.contractAmount - receiveProject.received)
          : 0;
      setKind("entrada");
      setAmount(rest > 0 ? formatInput(rest) : "");
      setOccurredOn(todayInBrasilia());
      setCategory("Projeto");
      setProjectId(receiveProject.id);
      setDescription(
        `${receiveProject.title} — ${receiveProject.received > 0 ? "restante" : "parcela"}`,
      );
      setNotes("");
    } else {
      setKind("entrada");
      setAmount("");
      setOccurredOn(todayInBrasilia());
      setCategory(FINANCE_INCOME_CATEGORIES[0]);
      setProjectId("");
      setDescription("");
      setNotes("");
    }
    setOpen(true);
  }

  function changeKind(next: FinanceKind) {
    setKind(next);
    setCategory(categoriesFor(next)[0]);
  }

  function changeProject(next: string) {
    setProjectId(next);
    const chosen = projects.find((item) => item.id === next);
    if (chosen && !description.trim()) {
      setDescription(`${chosen.title} — ${kind === "entrada" ? "parcela" : "custo"}`);
    }
  }

  function save() {
    const parsed = parseBrlAmount(amount);
    if (parsed === null || parsed <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    if (!description.trim()) {
      toast.error("Descreva o lançamento.");
      return;
    }

    startTransition(async () => {
      const input = {
        kind,
        amount: parsed,
        occurredOn,
        category,
        projectId: projectId || null,
        description,
        notes,
      };
      const result = entry
        ? await updateFinanceEntry(entry.id, input)
        : await createFinanceEntry(input);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        editing
          ? "Lançamento atualizado."
          : kind === "entrada"
            ? "Entrada lançada."
            : "Gasto lançado.",
      );
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {editing ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Editar lançamento"
          onClick={openSheet}
        >
          <Pencil className="size-3.5" />
        </Button>
      ) : receiveProject ? (
        <Button type="button" variant="outline" size="sm" onClick={openSheet}>
          <ArrowDownLeft className="size-3.5" />
          Receber
        </Button>
      ) : (
        <Button
          type="button"
          onClick={openSheet}
          className="border-white/15 bg-white/10 text-white hover:bg-white/15"
        >
          <Plus className="size-4" />
          Lançar
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-3xl bg-white p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-[var(--insyt-border)] px-6 py-5 pr-12">
            <DialogTitle className="text-2xl font-bold text-[var(--insyt-black)]">
              {editing ? "Editar lançamento" : "Novo lançamento"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Corrija valor, data ou categoria. O mês do caixa segue a data."
                : "Parcela de projeto, gasto avulso ou qualquer valor fora das regras fixas. Mensalidade paga e gasto fixo marcado como pago entram sozinhos."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[var(--insyt-canvas)] p-1">
              {(
                [
                  ["entrada", "Entrada"],
                  ["saida", "Saída"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => changeKind(value)}
                  className={cn(
                    "rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                    kind === value
                      ? "bg-white text-[var(--insyt-black)] shadow-sm"
                      : "text-[var(--insyt-muted)]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="finance-amount">Valor (R$)</Label>
              <Input
                id="finance-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="648,50"
                className="text-lg font-bold"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="finance-date">Data</Label>
              <Input
                id="finance-date"
                type="date"
                value={occurredOn}
                onChange={(event) => setOccurredOn(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="finance-category">Categoria</Label>
              <select
                id="finance-category"
                className={financeSelectClassName}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="finance-project">Projeto</Label>
              <select
                id="finance-project"
                className={financeSelectClassName}
                value={projectId}
                onChange={(event) => changeProject(event.target.value)}
              >
                <option value="">Nenhum</option>
                {projects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
              {project && kind === "entrada" ? (
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-[var(--insyt-muted)]">
                  {project.contractAmount != null ? (
                    <>
                      <span>
                        Fechado {formatBrl(project.contractAmount)} · recebido{" "}
                        {formatBrl(alreadyReceived)} ·{" "}
                        <span className="font-semibold text-[var(--insyt-black)]">
                          falta {formatBrl(remaining ?? 0)}
                        </span>
                      </span>
                      {remaining && remaining > 0 ? (
                        <button
                          type="button"
                          onClick={() => setAmount(formatInput(remaining))}
                          className="font-semibold text-[var(--insyt-primary)] hover:underline"
                        >
                          usar o restante
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <span>
                      Sem valor fechado. Informe em Finanças → Projetos para ver quanto
                      falta.
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-xs text-[var(--insyt-muted)]">
                  Opcional. Ligue parcelas e custos ao site para ver quanto falta receber.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="finance-description">Descrição</Label>
              <Input
                id="finance-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Outeiral Advocacia — 50% do desenvolvimento"
                maxLength={160}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="finance-notes">Nota</Label>
              <Textarea
                id="finance-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Opcional"
                rows={3}
              />
            </div>
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

export function FinanceEntryDelete({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteFinanceEntry(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Lançamento excluído.");
      router.refresh();
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Excluir lançamento"
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir este lançamento?</AlertDialogTitle>
          <AlertDialogDescription>
            “{label}” sai do caixa. Se for o pagamento de um gasto fixo, o mês volta a
            aparecer como a pagar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
