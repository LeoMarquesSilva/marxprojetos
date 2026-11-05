"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { setPartnershipLaunch, setPartnershipPayment } from "@/app/actions/finance";
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
import { todayInBrasilia } from "@/lib/subscription-billing";

/** Marca o mês como pago pelo cliente (com a data de hoje) ou desmarca. */
export function PartnershipPaymentToggle({
  projectId,
  month,
  paidOn,
}: {
  projectId: string;
  month: string;
  paidOn: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function save(next: string | null) {
    startTransition(async () => {
      const result = await setPartnershipPayment(projectId, month, next);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(next ? "Mês marcado como pago pelo cliente." : "Pagamento desmarcado.");
      router.refresh();
    });
  }

  if (paidOn) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-emerald-800">
        <Check className="size-3.5" />
        {paidOn.slice(8, 10)}/{paidOn.slice(5, 7)}
        <button
          type="button"
          title="Desmarcar pagamento"
          disabled={isPending}
          onClick={() => save(null)}
          className="ml-0.5 rounded-full p-0.5 text-[var(--insyt-muted)] hover:bg-[var(--insyt-canvas)] hover:text-red-700"
        >
          {isPending ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
        </button>
      </span>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      disabled={isPending}
      onClick={() => save(todayInBrasilia())}
    >
      {isPending ? <Loader2 className="animate-spin" /> : null}
      Cliente pagou
    </Button>
  );
}

/** Ajusta o mês do lançamento; a mensalidade começa no mês seguinte. */
export function PartnershipLaunchDialog({
  projectId,
  launchMonth,
}: {
  projectId: string;
  launchMonth: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(launchMonth?.slice(0, 7) ?? "");
  const [isPending, startTransition] = useTransition();

  function save() {
    if (!/^\d{4}-\d{2}$/.test(value)) {
      toast.error("Informe o mês do lançamento.");
      return;
    }
    startTransition(async () => {
      const result = await setPartnershipLaunch(projectId, `${value}-01`);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Lançamento ajustado.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          setValue(launchMonth?.slice(0, 7) ?? "");
          setOpen(true);
        }}
      >
        <CalendarClock className="size-3.5" />
        Lançamento
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-3xl bg-white p-0 sm:max-w-md">
          <DialogHeader className="border-b border-[var(--insyt-border)] px-6 py-5 pr-12">
            <DialogTitle className="text-2xl font-bold text-[var(--insyt-black)]">
              Mês do lançamento
            </DialogTitle>
            <DialogDescription>
              Quando o site fica no ar. A mensalidade começa 30 dias depois, no mês
              seguinte, e a divisão de cada mês se refaz sozinha.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 px-6 py-6">
            <Label htmlFor="partnership-launch">Mês</Label>
            <Input
              id="partnership-launch"
              type="month"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--insyt-border)] px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={save} disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
