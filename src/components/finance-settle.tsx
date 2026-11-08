"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createFinanceEntry,
  deleteFinanceEntry,
  payRecurringExpense,
} from "@/app/actions/finance";
import {
  deleteSubscriptionPayment,
  registerSubscriptionPayment,
} from "@/app/actions/subscriptions";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBrl, parseBrlAmount, todayInBrasilia } from "@/lib/subscription-billing";
import { formatMonthLabel } from "@/lib/subscription-format";

/**
 * A baixa é um clique, sem confirmação: quem marca sabe o que recebeu. Em troca,
 * o aviso oferece desfazer por alguns segundos, para o clique errado não custar nada.
 */
export function toastWithUndo(
  message: string,
  undo: () => Promise<{ error?: string }>,
  refresh: () => void,
) {
  toast.success(message, {
    duration: 8000,
    action: {
      label: "Desfazer",
      onClick: async () => {
        const result = await undo();
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Desfeito.");
        refresh();
      },
    },
  });
}

/** Registra a mensalidade do mês com o valor combinado e a data de hoje. */
export function ChargeSettle({
  subscriptionId,
  clientName,
  month,
  amount,
  method,
  label = "Recebi",
}: {
  subscriptionId: string;
  clientName: string;
  month: string;
  amount: number;
  method: string;
  label?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function settle() {
    startTransition(async () => {
      const result = await registerSubscriptionPayment({
        subscriptionId,
        referenceMonth: month,
        amount,
        paidOn: todayInBrasilia(),
        method,
      });
      if (result.error || !result.id) {
        toast.error(result.error ?? "Não deu para registrar o pagamento.");
        return;
      }
      const paymentId = result.id;
      toastWithUndo(
        `${clientName}: ${formatBrl(amount)} de ${formatMonthLabel(month)}, recebido hoje.`,
        () => deleteSubscriptionPayment(paymentId),
        () => router.refresh(),
      );
      router.refresh();
    });
  }

  return <SettleButton label={label} isPending={isPending} onClick={settle} />;
}

/** Marca o gasto fixo do mês como pago hoje, com o valor cadastrado. */
export function BillSettle({
  expenseId,
  description,
  month,
  amount,
  label = "Paguei",
}: {
  expenseId: string;
  description: string;
  month: string;
  amount: number;
  label?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function settle() {
    startTransition(async () => {
      const result = await payRecurringExpense({
        expenseId,
        referenceMonth: month,
        paidOn: todayInBrasilia(),
      });
      if (result.error || !result.id) {
        toast.error(result.error ?? "Não deu para marcar como pago.");
        return;
      }
      const entryId = result.id;
      toastWithUndo(
        `${description}: ${formatBrl(amount)} de ${formatMonthLabel(month)}, pago hoje.`,
        () => deleteFinanceEntry(entryId),
        () => router.refresh(),
      );
      router.refresh();
    });
  }

  return <SettleButton label={label} isPending={isPending} onClick={settle} />;
}

/** Lança a parcela do projeto como entrada de hoje, no valor que falta dela. */
export function InstallmentSettle({
  projectId,
  projectTitle,
  name,
  amount,
  label = "Recebi",
}: {
  projectId: string;
  projectTitle: string;
  name: string;
  amount: number;
  label?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function settle() {
    startTransition(async () => {
      const result = await createFinanceEntry({
        kind: "entrada",
        amount,
        occurredOn: todayInBrasilia(),
        category: "Projeto",
        projectId,
        description: `${projectTitle} — ${name}`,
        notes: "",
      });
      if (result.error || !result.id) {
        toast.error(result.error ?? "Não deu para registrar o recebimento.");
        return;
      }
      const entryId = result.id;
      toastWithUndo(
        `${projectTitle}: ${formatBrl(amount)} (${name}), recebido hoje.`,
        () => deleteFinanceEntry(entryId),
        () => router.refresh(),
      );
      router.refresh();
    });
  }

  return <SettleButton label={label} isPending={isPending} onClick={settle} />;
}

function SettleButton({
  label,
  isPending,
  onClick,
}: {
  label: string;
  isPending: boolean;
  onClick: () => void;
}) {
  return (
    <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={onClick}>
      {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
      {label}
    </Button>
  );
}

/** Quando o gasto saiu por outro valor ou em outra data. */
export function BillSettleOptions({
  expenseId,
  description,
  month,
  amount,
}: {
  expenseId: string;
  description: string;
  month: string;
  amount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [paidOn, setPaidOn] = useState("");
  const [isPending, startTransition] = useTransition();

  function openDialog() {
    setValue(amount.toFixed(2).replace(".", ","));
    setPaidOn(todayInBrasilia());
    setOpen(true);
  }

  function save() {
    const parsed = parseBrlAmount(value);
    if (parsed === null || parsed <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    startTransition(async () => {
      const result = await payRecurringExpense({
        expenseId,
        referenceMonth: month,
        paidOn,
        amount: parsed,
      });
      if (result.error || !result.id) {
        toast.error(result.error ?? "Não deu para marcar como pago.");
        return;
      }
      const entryId = result.id;
      setOpen(false);
      toastWithUndo(
        `${description}: ${formatBrl(parsed)} de ${formatMonthLabel(month)}, pago.`,
        () => deleteFinanceEntry(entryId),
        () => router.refresh(),
      );
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Outro valor ou data"
        aria-label={`Outro valor ou data: ${description}`}
        onClick={openDialog}
      >
        <MoreHorizontal className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-3xl bg-white p-0 sm:max-w-md">
          <DialogHeader className="border-b border-[var(--insyt-border)] px-6 py-5 pr-12">
            <DialogTitle className="text-2xl font-bold text-[var(--insyt-black)]">
              {description}
            </DialogTitle>
            <DialogDescription>Referente a {formatMonthLabel(month)}.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 px-6 py-6">
            <div className="space-y-2">
              <Label htmlFor="bill-amount">Valor (R$)</Label>
              <Input
                id="bill-amount"
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="text-lg font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bill-date">Pago em</Label>
              <Input
                id="bill-date"
                type="date"
                value={paidOn}
                onChange={(event) => setPaidOn(event.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--insyt-border)] px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={save} disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Marcar como pago
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Tira do caixa um pagamento de mensalidade; o mês volta a ficar a receber. */
export function FinancePaymentDelete({
  id,
  clientName,
  referenceLabel,
}: {
  id: string;
  clientName: string;
  referenceLabel: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteSubscriptionPayment(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Pagamento removido.");
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
            title="Remover pagamento"
            aria-label={`Remover pagamento de ${clientName}`}
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
          <AlertDialogTitle>Remover este pagamento?</AlertDialogTitle>
          <AlertDialogDescription>
            {clientName}
            {referenceLabel ? `, ${referenceLabel}` : ""}: sai do caixa e o mês volta a aparecer
            como a receber.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>Remover</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
