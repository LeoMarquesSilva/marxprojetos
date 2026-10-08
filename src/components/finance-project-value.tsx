"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus } from "lucide-react";
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
import { parseBrlAmount } from "@/lib/subscription-billing";
import type { FinanceProjectOption } from "@/types/finance";

function formatInput(value: number | null | undefined) {
  return value ? value.toFixed(2).replace(".", ",") : "";
}

/** Define o valor fechado de um projeto. Com `project`, já abre nele. */
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
  const [isPending, startTransition] = useTransition();

  function fill(item: FinanceProjectOption | undefined) {
    setProjectId(item?.id ?? "");
    setAmount(formatInput(item?.contractAmount));
    setReceivedBefore(formatInput(item?.receivedBefore));
  }

  function openDialog() {
    fill(project ?? projects.find((item) => item.contractAmount === null) ?? projects[0]);
    setOpen(true);
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

    startTransition(async () => {
      const result = await setProjectContractAmount(projectId, parsed, parsedBefore);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(parsed === null ? "Valor removido." : "Valor do projeto salvo.");
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
          title="Editar valor fechado"
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
              Valor fechado
            </DialogTitle>
            <DialogDescription>
              Quanto foi combinado pelo desenvolvimento. As parcelas lançadas com o
              projeto vão abatendo até zerar.
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
              “Já recebido antes” é o que entrou antes de você usar Finanças: abate o
              que falta, mas não aparece no caixa. Deixe o valor fechado vazio para
              tirar o projeto da lista.
            </p>
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
