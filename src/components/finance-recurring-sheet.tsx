"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Repeat, Square } from "lucide-react";
import { toast } from "sonner";
import {
  createRecurringExpense,
  endRecurringExpense,
  payRecurringExpense,
  updateRecurringExpense,
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
import { financeSelectClassName } from "@/components/finance-entry-sheet";
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
  monthStartOf,
  parseBrlAmount,
  todayInBrasilia,
  toAmount,
} from "@/lib/subscription-billing";
import { FINANCE_EXPENSE_CATEGORIES, type FinanceRecurringExpense } from "@/types/finance";

export type RecurringSubscriptionOption = { id: string; clientName: string };

/** Sem `expense`, cadastra um gasto fixo; com `expense`, edita. */
export function FinanceRecurringSheet({
  expense,
  subscriptions,
}: {
  expense?: FinanceRecurringExpense;
  subscriptions: RecurringSubscriptionOption[];
}) {
  const router = useRouter();
  const editing = Boolean(expense);
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(FINANCE_EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("10");
  const [startedOn, setStartedOn] = useState(monthStartOf(todayInBrasilia()));
  const [subscriptionId, setSubscriptionId] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  function openSheet() {
    setDescription(expense?.description ?? "");
    setCategory(expense?.category ?? FINANCE_EXPENSE_CATEGORIES[0]);
    setAmount(expense ? toAmount(expense.amount).toFixed(2).replace(".", ",") : "");
    setDueDay(String(expense?.due_day ?? 10));
    setStartedOn(expense?.started_on ?? monthStartOf(todayInBrasilia()));
    setSubscriptionId(expense?.subscription_id ?? "");
    setNotes(expense?.notes ?? "");
    setOpen(true);
  }

  function save() {
    const parsed = parseBrlAmount(amount);
    if (parsed === null || parsed <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }

    startTransition(async () => {
      const input = {
        description,
        category,
        amount: parsed,
        dueDay: Number(dueDay),
        startedOn,
        subscriptionId: subscriptionId || null,
        notes,
      };
      const result = expense
        ? await updateRecurringExpense(expense.id, input)
        : await createRecurringExpense(input);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(editing ? "Gasto fixo atualizado." : "Gasto fixo cadastrado.");
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
          title="Editar gasto fixo"
          onClick={openSheet}
        >
          <Pencil className="size-3.5" />
        </Button>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={openSheet}>
          <Repeat className="size-3.5" />
          Novo gasto fixo
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-3xl bg-white p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-[var(--insyt-border)] px-6 py-5 pr-12">
            <DialogTitle className="text-2xl font-bold text-[var(--insyt-black)]">
              {editing ? "Editar gasto fixo" : "Novo gasto fixo"}
            </DialogTitle>
            <DialogDescription>
              O que sai todo mês no mesmo dia: imposto do MEI, repasse de sócio,
              ferramentas. Cada mês aparece em “A pagar” até você marcar como pago.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
            <div className="space-y-2">
              <Label htmlFor="recurring-description">Descrição</Label>
              <Input
                id="recurring-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="DAS do MEI"
                maxLength={160}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="recurring-amount">Valor (R$)</Label>
                <Input
                  id="recurring-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="86,05"
                  className="text-lg font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recurring-day">Vence todo dia</Label>
                <Input
                  id="recurring-day"
                  type="number"
                  min={1}
                  max={28}
                  value={dueDay}
                  onChange={(event) => setDueDay(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recurring-category">Categoria</Label>
              <select
                id="recurring-category"
                className={financeSelectClassName}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {FINANCE_EXPENSE_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recurring-start">A partir de</Label>
              <Input
                id="recurring-start"
                type="date"
                value={startedOn}
                onChange={(event) => setStartedOn(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recurring-subscription">Ligado a uma recorrência</Label>
              <select
                id="recurring-subscription"
                className={financeSelectClassName}
                value={subscriptionId}
                onChange={(event) => setSubscriptionId(event.target.value)}
              >
                <option value="">Nenhuma</option>
                {subscriptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.clientName}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[var(--insyt-muted)]">
                Para repasse: a recorrência passa a mostrar quanto fica líquido.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recurring-notes">Nota</Label>
              <Textarea
                id="recurring-notes"
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

export function FinanceRecurringEnd({ id, description }: { id: string; description: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleEnd() {
    startTransition(async () => {
      const result = await endRecurringExpense(id, todayInBrasilia());
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Gasto fixo encerrado.");
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
            title="Encerrar gasto fixo"
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Square className="size-3.5" />
            )}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Encerrar “{description}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Os meses com vencimento a partir de hoje deixam de aparecer em “A pagar”. O
            que já foi pago continua no caixa.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleEnd}>Encerrar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Marca o mês como pago hoje; o lançamento pode ser editado depois no caixa. */
export function FinanceBillPay({ expenseId, month }: { expenseId: string; month: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await payRecurringExpense({
            expenseId,
            referenceMonth: month,
            paidOn: todayInBrasilia(),
          });
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Marcado como pago hoje.");
          router.refresh();
        })
      }
    >
      {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
      Paguei
    </Button>
  );
}
