"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createFinanceEntry, deleteFinanceEntry } from "@/app/actions/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { parseBrlAmount, todayInBrasilia } from "@/lib/subscription-billing";
import { cn } from "@/lib/utils";
import {
  FINANCE_EXPENSE_CATEGORIES,
  FINANCE_INCOME_CATEGORIES,
  type FinanceKind,
} from "@/types/finance";

const selectClassName =
  "w-full rounded-xl border border-transparent bg-[var(--insyt-canvas)] px-4 py-3 text-sm font-medium text-[var(--insyt-black)] outline-none transition-all duration-300 hover:border-[var(--insyt-border)] hover:bg-white focus:border-[var(--insyt-primary)]/50 focus:bg-white focus:ring-4 focus:ring-[var(--insyt-primary)]/10";

export function FinanceEntrySheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FinanceKind>("entrada");
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(todayInBrasilia());
  const [category, setCategory] = useState<string>(FINANCE_INCOME_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const categories = kind === "entrada" ? FINANCE_INCOME_CATEGORIES : FINANCE_EXPENSE_CATEGORIES;

  function openSheet() {
    setKind("entrada");
    setAmount("");
    setOccurredOn(todayInBrasilia());
    setCategory(FINANCE_INCOME_CATEGORIES[0]);
    setDescription("");
    setNotes("");
    setOpen(true);
  }

  function changeKind(next: FinanceKind) {
    setKind(next);
    const nextCategories =
      next === "entrada" ? FINANCE_INCOME_CATEGORIES : FINANCE_EXPENSE_CATEGORIES;
    setCategory(nextCategories[0]);
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
      const result = await createFinanceEntry({
        kind,
        amount: parsed,
        occurredOn,
        category,
        description,
        notes,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(kind === "entrada" ? "Entrada lançada." : "Gasto lançado.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        onClick={openSheet}
        className="border-white/15 bg-white/10 text-white hover:bg-white/15"
      >
        <Plus className="size-4" />
        Lançar
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
          <SheetHeader className="border-b border-[var(--insyt-border)] px-6 py-6">
            <SheetTitle className="text-2xl font-bold">Novo lançamento</SheetTitle>
            <SheetDescription>
              Parcela de projeto, gasto ou qualquer valor que não seja a mensalidade.
              Recorrência paga entra sozinha quando você marca o pagamento.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-8">
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
                className={selectClassName}
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
        </SheetContent>
      </Sheet>
    </>
  );
}

export function FinanceEntryDelete({ id }: { id: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      title="Excluir lançamento"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteFinanceEntry(id);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Lançamento excluído.");
          router.refresh();
        })
      }
    >
      {isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Trash2 className="size-3.5" />
      )}
    </Button>
  );
}
