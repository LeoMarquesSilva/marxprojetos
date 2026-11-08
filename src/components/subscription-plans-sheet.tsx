"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Layers, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  createSubscriptionPlan,
  setSubscriptionPlanActive,
  updateSubscriptionPlan,
} from "@/app/actions/subscriptions";
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
import { Textarea } from "@/components/ui/textarea";
import { formatBrl, parseBrlAmount, toAmount } from "@/lib/subscription-billing";
import { cn } from "@/lib/utils";
import type { SubscriptionPlan, SubscriptionPlanKind } from "@/types/subscription";

type Draft = {
  id: string | null;
  kind: SubscriptionPlanKind;
  name: string;
  price: string;
  hours: string;
  features: string;
};

function draftFrom(plan: SubscriptionPlan): Draft {
  return {
    id: plan.id,
    kind: plan.kind,
    name: plan.name,
    price: toAmount(plan.price).toFixed(2).replace(".", ","),
    hours: plan.included_hours === null ? "" : String(toAmount(plan.included_hours)).replace(".", ","),
    features: plan.features.join("\n"),
  };
}

function emptyDraft(kind: SubscriptionPlanKind): Draft {
  return { id: null, kind, name: "", price: "", hours: "", features: "" };
}

export function SubscriptionPlansSheet({
  plans,
  usage,
}: {
  plans: SubscriptionPlan[];
  /** Quantas assinaturas ativas usam cada plano/adicional. */
  usage: Record<string, number>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isPending, startTransition] = useTransition();

  const basePlans = plans.filter((plan) => plan.kind === "plano");
  const addons = plans.filter((plan) => plan.kind === "adicional");

  function save() {
    if (!draft) return;
    const price = parseBrlAmount(draft.price);
    if (price === null) {
      toast.error("Informe o preço, ex: 119,00.");
      return;
    }
    const hours = draft.hours.trim() ? parseBrlAmount(draft.hours) : null;
    if (draft.hours.trim() && hours === null) {
      toast.error("Horas incluídas inválidas.");
      return;
    }

    const input = {
      name: draft.name,
      kind: draft.kind,
      price,
      includedHours: hours,
      features: draft.features.split("\n"),
    };

    startTransition(async () => {
      const result = draft.id
        ? await updateSubscriptionPlan(draft.id, input)
        : await createSubscriptionPlan(input);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(draft.id ? "Plano atualizado." : "Plano criado.");
      setDraft(null);
      router.refresh();
    });
  }

  function toggleActive(plan: SubscriptionPlan) {
    startTransition(async () => {
      const result = await setSubscriptionPlanActive(plan.id, !plan.active);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(plan.active ? "Plano arquivado." : "Plano reativado.");
      router.refresh();
    });
  }

  function renderGroup(title: string, kind: SubscriptionPlanKind, items: SubscriptionPlan[]) {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--insyt-muted)]">
            {title}
          </h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setDraft(emptyDraft(kind))}
          >
            <Plus className="size-3.5" />
            {kind === "plano" ? "Novo plano" : "Novo adicional"}
          </Button>
        </div>

        {draft && !draft.id && draft.kind === kind ? renderForm() : null}

        {items.length === 0 && !(draft && !draft.id && draft.kind === kind) ? (
          <p className="text-sm text-[var(--insyt-muted)]">Nada cadastrado.</p>
        ) : null}

        {items.map((plan) =>
          draft?.id === plan.id ? (
            <div key={plan.id}>{renderForm()}</div>
          ) : (
            <div
              key={plan.id}
              className={cn(
                "flex items-center gap-4 rounded-2xl border border-[var(--insyt-border)] px-4 py-3",
                !plan.active && "opacity-50",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-[var(--insyt-black)]">
                  {plan.name}
                  {!plan.active ? (
                    <span className="ml-2 text-xs font-medium text-[var(--insyt-muted)]">arquivado</span>
                  ) : null}
                </p>
                <p className="text-xs text-[var(--insyt-muted)]">
                  {kind === "adicional" ? "+ " : ""}
                  {formatBrl(plan.price)}/mês
                  {plan.included_hours !== null
                    ? ` · ${String(toAmount(plan.included_hours)).replace(".", ",")}h de alterações`
                    : ""}
                  {" · "}
                  {usage[plan.id] ?? 0} {(usage[plan.id] ?? 0) === 1 ? "cliente" : "clientes"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="Editar"
                onClick={() => setDraft(draftFrom(plan))}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title={plan.active ? "Arquivar" : "Reativar"}
                disabled={isPending}
                onClick={() => toggleActive(plan)}
              >
                {plan.active ? <Archive className="size-3.5" /> : <ArchiveRestore className="size-3.5" />}
              </Button>
            </div>
          ),
        )}
      </section>
    );
  }

  function renderForm() {
    if (!draft) return null;
    return (
      <div className="space-y-4 rounded-2xl border border-[var(--insyt-primary)]/40 bg-[var(--insyt-canvas)]/60 p-4">
        <div className="space-y-2">
          <Label htmlFor="plan-name">Nome</Label>
          <Input
            id="plan-name"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder={draft.kind === "plano" ? "Ex: Essencial" : "Ex: Landing pages ilimitadas"}
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="plan-price">Preço mensal (R$)</Label>
            <Input
              id="plan-price"
              inputMode="decimal"
              value={draft.price}
              onChange={(event) => setDraft({ ...draft, price: event.target.value })}
              placeholder="119,00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan-hours">Horas de alteração</Label>
            <Input
              id="plan-hours"
              inputMode="decimal"
              value={draft.hours}
              onChange={(event) => setDraft({ ...draft, hours: event.target.value })}
              placeholder="Ex: 1"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan-features">O que inclui (um por linha)</Label>
          <Textarea
            id="plan-features"
            value={draft.features}
            onChange={(event) => setDraft({ ...draft, features: event.target.value })}
            rows={4}
            placeholder={"Hospedagem, SSL e backup diário\nAtendimento em até 5 dias úteis"}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
            Cancelar
          </Button>
          <Button type="button" onClick={save} disabled={isPending || !draft.name.trim()}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Salvar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Layers className="size-3.5" />
        Planos
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setDraft(null);
        }}
      >
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-3xl bg-white p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-[var(--insyt-border)] px-6 py-5 pr-12">
            <DialogTitle className="text-2xl font-bold text-[var(--insyt-black)]">
              Planos
            </DialogTitle>
            <DialogDescription>
              O catálogo que aparece ao criar uma assinatura. Mudar o preço aqui
              não altera o valor de quem já assina.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-6 py-6">
            {renderGroup("Planos", "plano", basePlans)}
            {renderGroup("Adicionais", "adicional", addons)}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
