"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteSubscriptionPayment,
  registerSubscriptionPayment,
} from "@/app/actions/subscriptions";
import { toastWithUndo } from "@/components/finance-settle";
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
import {
  formatBrl,
  parseBrlAmount,
  todayInBrasilia,
  toAmount,
} from "@/lib/subscription-billing";
import { formatMonthLabel, formatShortDate } from "@/lib/subscription-format";
import {
  PAYMENT_METHODS,
  type Subscription,
  type SubscriptionPayment,
} from "@/types/subscription";

const selectClassName =
  "w-full rounded-xl border border-transparent bg-[var(--insyt-canvas)] px-4 py-3 text-sm font-medium text-[var(--insyt-black)] outline-none transition-all duration-300 hover:border-[var(--insyt-border)] hover:bg-white focus:border-[var(--insyt-primary)]/50 focus:bg-white focus:ring-4 focus:ring-[var(--insyt-primary)]/10";

/**
 * O caso comum (recebi hoje, valor combinado) é o botão "Recebi" da linha. Este
 * diálogo cuida do resto: outro valor, outra data, adiantar um mês e o histórico.
 */
export function SubscriptionPaymentSheet({
  subscription,
  payments,
  payableMonths,
  initialMonth,
}: {
  subscription: Subscription;
  payments: SubscriptionPayment[];
  /** Meses que ainda podem ser pagos, do mais antigo ao mais novo. */
  payableMonths: string[];
  /** Abre neste mês em vez do mais antigo em aberto. */
  initialMonth?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(initialMonth ?? payableMonths[0] ?? "");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(todayInBrasilia());
  const [method, setMethod] = useState<string>(
    subscription.payment_method ?? PAYMENT_METHODS[0],
  );
  const [isPending, startTransition] = useTransition();

  function openDialog() {
    // Sempre reabre no mês em aberto mais antigo: é o que normalmente entrou.
    setMonth(initialMonth ?? payableMonths[0] ?? "");
    setAmount(toAmount(subscription.amount).toFixed(2).replace(".", ","));
    setPaidOn(todayInBrasilia());
    setMethod(subscription.payment_method ?? PAYMENT_METHODS[0]);
    setOpen(true);
  }

  function save() {
    const parsedAmount = parseBrlAmount(amount);
    if (parsedAmount === null) {
      toast.error("Informe um valor válido.");
      return;
    }

    startTransition(async () => {
      const result = await registerSubscriptionPayment({
        subscriptionId: subscription.id,
        referenceMonth: month,
        amount: parsedAmount,
        paidOn,
        method,
      });
      if (result.error || !result.id) {
        toast.error(result.error ?? "Não deu para registrar o pagamento.");
        return;
      }
      const paymentId = result.id;
      setOpen(false);
      toastWithUndo(
        `${subscription.client_name}: pagamento de ${formatMonthLabel(month)} registrado.`,
        () => deleteSubscriptionPayment(paymentId),
        () => router.refresh(),
      );
      router.refresh();
    });
  }

  function remove(payment: SubscriptionPayment) {
    startTransition(async () => {
      const result = await deleteSubscriptionPayment(payment.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Pagamento removido.");
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        title="Outro valor, data ou histórico"
        aria-label={`Outro valor, data ou histórico: ${subscription.client_name}`}
        onClick={openDialog}
      >
        <MoreHorizontal className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-3xl bg-white p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-[var(--insyt-border)] px-6 py-5 pr-12">
            <DialogTitle className="text-2xl font-bold text-[var(--insyt-black)]">
              {subscription.client_name}
            </DialogTitle>
            <DialogDescription>
              {subscription.plan_name} · {formatBrl(subscription.amount)}/mês · vence dia{" "}
              {subscription.billing_day}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-6 py-6">
            {payableMonths.length > 0 ? (
              <section className="space-y-5">
                <h3 className="font-bold text-[var(--insyt-black)]">Registrar pagamento</h3>

                <div className="space-y-2">
                  <Label htmlFor={`payment-month-${subscription.id}`}>Mês de referência</Label>
                  <select
                    id={`payment-month-${subscription.id}`}
                    value={month}
                    onChange={(event) => setMonth(event.target.value)}
                    className={selectClassName}
                  >
                    {payableMonths.map((option) => (
                      <option key={option} value={option}>
                        {formatMonthLabel(option)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`payment-amount-${subscription.id}`}>Valor (R$)</Label>
                    <Input
                      id={`payment-amount-${subscription.id}`}
                      inputMode="decimal"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`payment-date-${subscription.id}`}>Pago em</Label>
                    <Input
                      id={`payment-date-${subscription.id}`}
                      type="date"
                      value={paidOn}
                      onChange={(event) => setPaidOn(event.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`payment-method-${subscription.id}`}>Forma</Label>
                  <select
                    id={`payment-method-${subscription.id}`}
                    value={method}
                    onChange={(event) => setMethod(event.target.value)}
                    className={selectClassName}
                  >
                    {PAYMENT_METHODS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  type="button"
                  className="w-full"
                  onClick={save}
                  disabled={isPending || !month}
                >
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Marcar como pago
                </Button>
              </section>
            ) : null}

            <section className="space-y-3">
              <h3 className="font-bold text-[var(--insyt-black)]">Histórico</h3>
              {payments.length === 0 ? (
                <p className="text-sm text-[var(--insyt-muted)]">
                  Nenhum pagamento registrado ainda.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--insyt-border)] rounded-2xl border border-[var(--insyt-border)]">
                  {payments.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--insyt-black)] first-letter:uppercase">
                          {formatMonthLabel(payment.reference_month)}
                        </p>
                        <p className="text-xs text-[var(--insyt-muted)]">
                          {formatBrl(payment.amount)} · pago em {formatShortDate(payment.paid_on)}
                          {payment.method ? ` · ${payment.method}` : ""}
                        </p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={isPending}
                              title="Remover pagamento"
                              aria-label={`Remover pagamento de ${formatMonthLabel(payment.reference_month)}`}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          }
                        />
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Remover o pagamento de {formatMonthLabel(payment.reference_month)}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Sai do caixa e o mês volta a aparecer como a receber.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(payment)}>
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
