"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  deleteSubscriptionPayment,
  registerSubscriptionPayment,
} from "@/app/actions/subscriptions";
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

export function SubscriptionPaymentSheet({
  subscription,
  payments,
  payableMonths,
}: {
  subscription: Subscription;
  payments: SubscriptionPayment[];
  /** Meses que ainda podem ser pagos, do mais antigo ao mais novo. */
  payableMonths: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(payableMonths[0] ?? "");
  const [amount, setAmount] = useState(
    toAmount(subscription.amount).toFixed(2).replace(".", ","),
  );
  const [paidOn, setPaidOn] = useState(todayInBrasilia());
  const [method, setMethod] = useState<string>(
    subscription.payment_method ?? PAYMENT_METHODS[0],
  );
  const [isPending, startTransition] = useTransition();

  function openSheet() {
    // Sempre reabre no mês em aberto mais antigo: é o que normalmente entrou.
    setMonth(payableMonths[0] ?? "");
    setPaidOn(todayInBrasilia());
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
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Pagamento de ${formatMonthLabel(month)} registrado.`);
      setOpen(false);
      router.refresh();
    });
  }

  function remove(payment: SubscriptionPayment) {
    if (!window.confirm(`Remover o pagamento de ${formatMonthLabel(payment.reference_month)}?`)) {
      return;
    }
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
      <Button type="button" size="sm" variant="outline" onClick={openSheet}>
        <Wallet className="size-3.5" />
        Pagamentos
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader className="border-b border-[var(--insyt-border)] px-6 py-6">
            <SheetTitle className="text-2xl font-bold">{subscription.client_name}</SheetTitle>
            <SheetDescription>
              {subscription.plan_name} · {formatBrl(subscription.amount)}/mês · vence dia{" "}
              {subscription.billing_day}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-8 px-6 py-4">
            {payableMonths.length > 0 ? (
              <section className="space-y-5">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--insyt-muted)]">
                  Registrar pagamento
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="payment-month">Mês de referência</Label>
                  <select
                    id="payment-month"
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
                    <Label htmlFor="payment-amount">Valor (R$)</Label>
                    <Input
                      id="payment-amount"
                      inputMode="decimal"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment-date">Pago em</Label>
                    <Input
                      id="payment-date"
                      type="date"
                      value={paidOn}
                      onChange={(event) => setPaidOn(event.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment-method">Forma</Label>
                  <select
                    id="payment-method"
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
                  size="lg"
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
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--insyt-muted)]">
                Histórico
              </h3>
              {payments.length === 0 ? (
                <p className="text-sm text-[var(--insyt-muted)]">Nenhum pagamento registrado.</p>
              ) : (
                <ul className="divide-y divide-[var(--insyt-border)] rounded-2xl border border-[var(--insyt-border)]">
                  {payments.map((payment) => (
                    <li key={payment.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold capitalize text-[var(--insyt-black)]">
                          {formatMonthLabel(payment.reference_month)}
                        </p>
                        <p className="text-xs text-[var(--insyt-muted)]">
                          {formatBrl(payment.amount)} · pago em{" "}
                          {formatShortDate(payment.paid_on)}
                          {payment.method ? ` · ${payment.method}` : ""}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={isPending}
                        onClick={() => remove(payment)}
                        title="Remover pagamento"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
