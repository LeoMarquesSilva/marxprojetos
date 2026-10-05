"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Globe, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  createSubscription,
  deleteSubscription,
  setSubscriptionStatus,
  updateSubscription,
} from "@/app/actions/subscriptions";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
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
import {
  firstDueDate,
  formatBrl,
  parseBrlAmount,
  planListPrice,
  splitSitesForClient,
  todayInBrasilia,
  toAmount,
} from "@/lib/subscription-billing";
import { formatShortDate } from "@/lib/subscription-format";
import { cn } from "@/lib/utils";
import {
  PAYMENT_METHODS,
  type Subscription,
  type SubscriptionClientOption,
  type SubscriptionPlan,
  type SubscriptionSiteOption,
} from "@/types/subscription";

const BILLING_DAYS = [5, 10, 15, 20, 25];

function formatAmountInput(value: number | string) {
  return toAmount(value).toFixed(2).replace(".", ",");
}

function clientLabel(client: SubscriptionClientOption) {
  return client.company && client.company !== client.name
    ? `${client.company} (${client.name})`
    : client.name;
}

function siteHost(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function formatHours(hours: number | string | null) {
  if (hours === null) return null;
  const value = toAmount(hours);
  return `${String(value).replace(".", ",")}h de alterações/mês`;
}

export function SubscriptionFormSheet({
  subscription,
  clients,
  sites,
  plans,
}: {
  subscription?: Subscription;
  clients: SubscriptionClientOption[];
  sites: SubscriptionSiteOption[];
  plans: SubscriptionPlan[];
}) {
  const router = useRouter();
  const editing = Boolean(subscription);
  const [open, setOpen] = useState(false);

  const [crmClientId, setCrmClientId] = useState(subscription?.crm_client_id ?? null);
  const [manualClient, setManualClient] = useState(
    Boolean(subscription && !subscription.crm_client_id),
  );
  const [manualName, setManualName] = useState(
    subscription && !subscription.crm_client_id ? subscription.client_name : "",
  );
  const [planId, setPlanId] = useState(subscription?.plan_id ?? "");
  const [addonIds, setAddonIds] = useState<string[]>(subscription?.addon_ids ?? []);
  const [projectIds, setProjectIds] = useState<string[]>(subscription?.project_ids ?? []);
  const [amount, setAmount] = useState(
    subscription ? formatAmountInput(subscription.amount) : "",
  );
  // Enquanto o valor não for mexido à mão, ele acompanha o preço de tabela.
  const [amountTouched, setAmountTouched] = useState(editing);
  const [billingDay, setBillingDay] = useState(subscription?.billing_day ?? 10);
  const [customDay, setCustomDay] = useState(
    subscription && !BILLING_DAYS.includes(subscription.billing_day),
  );
  const [paymentMethod, setPaymentMethod] = useState<string>(
    subscription?.payment_method ?? PAYMENT_METHODS[0],
  );
  const [startedOn, setStartedOn] = useState(subscription?.started_on ?? todayInBrasilia());
  const [notes, setNotes] = useState(subscription?.notes ?? "");
  const [endedOn, setEndedOn] = useState(subscription?.ended_on ?? todayInBrasilia());
  const [showOtherSites, setShowOtherSites] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selectedClient = clients.find((client) => client.id === crmClientId) ?? null;
  const clientName = manualClient
    ? manualName.trim()
    : selectedClient
      ? selectedClient.company || selectedClient.name
      : "";

  // Planos arquivados somem das opções, menos o que esta assinatura já usa.
  const basePlans = plans.filter(
    (plan) => plan.kind === "plano" && (plan.active || plan.id === subscription?.plan_id),
  );
  const addonPlans = plans.filter(
    (plan) =>
      plan.kind === "adicional" && (plan.active || subscription?.addon_ids.includes(plan.id)),
  );
  const selectedPlan = plans.find((plan) => plan.id === planId) ?? null;
  const selectedAddons = addonPlans.filter((addon) => addonIds.includes(addon.id));
  const listPrice = planListPrice(selectedPlan, selectedAddons);
  const parsedAmount = parseBrlAmount(amount);
  const customPrice = parsedAmount !== null && selectedPlan !== null && parsedAmount !== listPrice;

  const { suggested: clientSites, others: otherSites } = splitSitesForClient(
    sites,
    manualClient ? null : selectedClient,
  );
  // Site já marcado que não é do cliente continua visível sem abrir "outros".
  const visibleOtherSites = showOtherSites
    ? otherSites
    : otherSites.filter((site) => projectIds.includes(site.id));
  const hiddenOtherCount = otherSites.length - visibleOtherSites.length;

  const firstDue = firstDueDate(startedOn || todayInBrasilia(), billingDay);

  function syncAmount(nextPlanId: string, nextAddonIds: string[]) {
    if (amountTouched) return;
    const plan = plans.find((item) => item.id === nextPlanId) ?? null;
    const addons = addonPlans.filter((addon) => nextAddonIds.includes(addon.id));
    setAmount(plan ? formatAmountInput(planListPrice(plan, addons)) : "");
  }

  function pickClient(client: SubscriptionClientOption | null) {
    setCrmClientId(client?.id ?? null);
    if (!client || editing) return;
    // Numa assinatura nova, já marca os sites que são desse cliente.
    const { suggested } = splitSitesForClient(sites, client);
    setProjectIds(suggested.map((site) => site.id));
  }

  function pickPlan(id: string) {
    setPlanId(id);
    syncAmount(id, addonIds);
  }

  function toggleAddon(id: string) {
    const next = addonIds.includes(id)
      ? addonIds.filter((item) => item !== id)
      : [...addonIds, id];
    setAddonIds(next);
    syncAmount(planId, next);
  }

  function toggleSite(id: string) {
    setProjectIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function useListPrice() {
    setAmount(formatAmountInput(listPrice));
    setAmountTouched(false);
  }

  function resetForNext() {
    setCrmClientId(null);
    setManualClient(false);
    setManualName("");
    setPlanId("");
    setAddonIds([]);
    setProjectIds([]);
    setAmount("");
    setAmountTouched(false);
    setNotes("");
  }

  function save() {
    if (!clientName) {
      toast.error("Escolha o cliente.");
      return;
    }
    if (!selectedPlan) {
      toast.error("Escolha o plano.");
      return;
    }
    if (parsedAmount === null) {
      toast.error("Informe o valor mensal, ex: 79,50.");
      return;
    }

    const input = {
      crmClientId: manualClient ? null : crmClientId,
      clientName,
      planId,
      addonIds,
      projectIds,
      amount: parsedAmount,
      billingDay,
      paymentMethod,
      startedOn,
      notes,
    };

    startTransition(async () => {
      const result = subscription
        ? await updateSubscription(subscription.id, input)
        : await createSubscription(input);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(editing ? "Assinatura atualizada." : "Assinatura criada.");
      setOpen(false);
      if (!editing) resetForNext();
      router.refresh();
    });
  }

  function changeStatus(status: "ativa" | "cancelada") {
    if (!subscription) return;
    startTransition(async () => {
      const result = await setSubscriptionStatus(
        subscription.id,
        status,
        status === "cancelada" ? endedOn : null,
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(status === "cancelada" ? "Assinatura cancelada." : "Assinatura reativada.");
      setOpen(false);
      router.refresh();
    });
  }

  function remove() {
    if (!subscription) return;
    if (!window.confirm("Excluir a assinatura e todo o histórico de pagamentos dela?")) return;
    startTransition(async () => {
      const result = await deleteSubscription(subscription.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Assinatura excluída.");
      setOpen(false);
      router.refresh();
    });
  }

  const canSave = Boolean(clientName && selectedPlan && parsedAmount !== null);

  return (
    <>
      {editing ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setOpen(true)}
          title="Editar assinatura"
        >
          <Pencil className="size-3.5" />
        </Button>
      ) : (
        <Button
          type="button"
          onClick={() => setOpen(true)}
          className="border-white/15 bg-white/10 text-white hover:bg-white/15"
        >
          <Plus className="size-4" />
          Nova assinatura
        </Button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
          <SheetHeader className="border-b border-[var(--insyt-border)] px-6 py-6">
            <SheetTitle className="text-2xl font-bold">
              {editing ? "Editar assinatura" : "Nova assinatura"}
            </SheetTitle>
            <SheetDescription>
              Plano mensal de hospedagem e manutenção de um cliente.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-10 overflow-x-hidden overflow-y-auto px-6 py-8">
            {/* 1. Cliente */}
            <FormSection step={1} title="Cliente">
              {manualClient ? (
                <div className="space-y-2">
                  <Input
                    value={manualName}
                    onChange={(event) => setManualName(event.target.value)}
                    placeholder="Nome de quem paga"
                    aria-label="Nome do cliente"
                  />
                  <button
                    type="button"
                    onClick={() => setManualClient(false)}
                    className="text-xs font-semibold text-[var(--insyt-primary)] hover:underline"
                  >
                    Escolher do CRM
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Combobox
                    items={clients}
                    value={selectedClient}
                    onValueChange={(client) => pickClient(client as SubscriptionClientOption | null)}
                    itemToStringLabel={(client: SubscriptionClientOption) => clientLabel(client)}
                    isItemEqualToValue={(a: SubscriptionClientOption, b: SubscriptionClientOption) =>
                      a.id === b.id
                    }
                  >
                    <ComboboxInput placeholder="Buscar cliente do CRM" aria-label="Cliente" />
                    <ComboboxContent emptyMessage="Nenhum cliente encontrado.">
                      <ComboboxList>
                        {(client: SubscriptionClientOption) => (
                          <ComboboxItem key={client.id} value={client}>
                            {clientLabel(client)}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  <button
                    type="button"
                    onClick={() => setManualClient(true)}
                    className="text-xs font-semibold text-[var(--insyt-muted)] hover:text-[var(--insyt-primary)]"
                  >
                    Cliente não está no CRM? Digitar o nome
                  </button>
                </div>
              )}
            </FormSection>

            {/* 2. Sites */}
            <FormSection
              step={2}
              title="Sites cobertos"
              hint={
                projectIds.length > 0
                  ? `${projectIds.length} ${projectIds.length === 1 ? "site marcado" : "sites marcados"}`
                  : "Marque os sites que esta mensalidade cobre"
              }
            >
              {sites.length === 0 ? (
                <p className="text-sm text-[var(--insyt-muted)]">Nenhum site cadastrado no sistema.</p>
              ) : (
                <div className="space-y-3">
                  {clientSites.length === 0 && !manualClient && selectedClient ? (
                    <p className="text-sm text-[var(--insyt-muted)]">
                      Nenhum site vinculado a este cliente.
                    </p>
                  ) : null}
                  {clientSites.length > 0 || visibleOtherSites.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[...clientSites, ...visibleOtherSites].map((site) => (
                        <SiteOption
                          key={site.id}
                          site={site}
                          checked={projectIds.includes(site.id)}
                          onToggle={() => toggleSite(site.id)}
                        />
                      ))}
                    </div>
                  ) : null}
                  {hiddenOtherCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setShowOtherSites(true)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--insyt-muted)] hover:text-[var(--insyt-primary)]"
                    >
                      <ChevronDown className="size-3.5" />
                      {selectedClient && !manualClient
                        ? `Mostrar outros sites (${hiddenOtherCount})`
                        : `Mostrar todos os sites (${hiddenOtherCount})`}
                    </button>
                  ) : null}
                </div>
              )}
            </FormSection>

            {/* 3. Plano */}
            <FormSection step={3} title="Plano">
              {basePlans.length === 0 ? (
                <p className="rounded-2xl bg-[var(--insyt-canvas)] px-4 py-5 text-sm text-[var(--insyt-slate)]">
                  Nenhum plano cadastrado. Crie os planos no botão <strong>Planos</strong>{" "}
                  da página de Recorrência.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {basePlans.map((plan) => (
                    <PlanOption
                      key={plan.id}
                      plan={plan}
                      selected={plan.id === planId}
                      onSelect={() => pickPlan(plan.id)}
                    />
                  ))}
                </div>
              )}

              {addonPlans.length > 0 ? (
                <div className="mt-5 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--insyt-muted)]">
                    Adicionais
                  </p>
                  <div className="grid gap-2">
                    {addonPlans.map((addon) => {
                      const checked = addonIds.includes(addon.id);
                      return (
                        <button
                          key={addon.id}
                          type="button"
                          aria-pressed={checked}
                          onClick={() => toggleAddon(addon.id)}
                          className={cn(
                            "flex w-full min-w-0 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-300 ease-fluid",
                            checked
                              ? "border-[var(--insyt-primary)] bg-[var(--insyt-primary)]/5"
                              : "border-[var(--insyt-border)] hover:border-[var(--insyt-slate)]/40",
                          )}
                        >
                          <CheckMark checked={checked} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-[var(--insyt-black)]">
                              {addon.name}
                            </span>
                            {addon.features.length > 0 ? (
                              <span className="block truncate text-xs text-[var(--insyt-muted)]">
                                {addon.features.join(" · ")}
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-sm font-semibold text-[var(--insyt-black)]">
                            + {formatBrl(addon.price)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </FormSection>

            {/* 4. Cobrança */}
            <FormSection step={4} title="Cobrança">
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <Label htmlFor="subscription-amount">Valor mensal (R$)</Label>
                    {selectedPlan ? (
                      <span className="text-xs text-[var(--insyt-muted)]">
                        Tabela: {formatBrl(listPrice)}
                      </span>
                    ) : null}
                  </div>
                  <Input
                    id="subscription-amount"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => {
                      setAmount(event.target.value);
                      setAmountTouched(true);
                    }}
                    placeholder={selectedPlan ? formatAmountInput(listPrice) : "Escolha o plano"}
                    className="text-lg font-bold"
                  />
                  {customPrice ? (
                    <p className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-[#fff1ec] px-2.5 py-0.5 font-semibold text-[var(--insyt-primary-dark)]">
                        Valor combinado
                      </span>
                      <span className="text-[var(--insyt-muted)]">
                        {parsedAmount < listPrice
                          ? `${formatBrl(listPrice - parsedAmount)} abaixo da tabela`
                          : `${formatBrl(parsedAmount - listPrice)} acima da tabela`}
                      </span>
                      <button
                        type="button"
                        onClick={useListPrice}
                        className="font-semibold text-[var(--insyt-primary)] hover:underline"
                      >
                        Usar valor de tabela
                      </button>
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>Vencimento</Label>
                  <div className="flex flex-wrap gap-2">
                    {BILLING_DAYS.map((day) => (
                      <Chip
                        key={day}
                        selected={!customDay && billingDay === day}
                        onClick={() => {
                          setCustomDay(false);
                          setBillingDay(day);
                        }}
                      >
                        Dia {day}
                      </Chip>
                    ))}
                    {customDay ? (
                      <Input
                        type="number"
                        min={1}
                        max={28}
                        value={billingDay}
                        onChange={(event) =>
                          setBillingDay(Math.min(28, Math.max(1, Number(event.target.value) || 1)))
                        }
                        className="h-9 w-24 py-1"
                        aria-label="Dia de vencimento"
                        autoFocus
                      />
                    ) : (
                      <Chip selected={false} onClick={() => setCustomDay(true)}>
                        Outro dia
                      </Chip>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Forma de pagamento</Label>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_METHODS.map((method) => (
                      <Chip
                        key={method}
                        selected={paymentMethod === method}
                        onClick={() => setPaymentMethod(method)}
                      >
                        {method}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subscription-start">Início da cobrança</Label>
                  <Input
                    id="subscription-start"
                    type="date"
                    value={startedOn}
                    onChange={(event) => setStartedOn(event.target.value)}
                  />
                  <p className="text-xs text-[var(--insyt-muted)]">
                    Primeiro vencimento: <strong>{formatShortDate(firstDue)}</strong>
                  </p>
                </div>
              </div>
            </FormSection>

            {/* 5. Observações */}
            <FormSection step={5} title="Observações" optional>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                placeholder="Ex: valor dividido com a LZ, que paga o próprio site."
                aria-label="Observações"
              />
            </FormSection>

            {subscription ? (
              <section className="space-y-4 rounded-2xl border border-[var(--insyt-border)] p-5">
                {subscription.status === "ativa" ? (
                  <div className="space-y-2">
                    <Label htmlFor="subscription-end">Cancelar a partir de</Label>
                    <div className="flex gap-2">
                      <Input
                        id="subscription-end"
                        type="date"
                        value={endedOn}
                        onChange={(event) => setEndedOn(event.target.value)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-auto"
                        disabled={isPending}
                        onClick={() => changeStatus("cancelada")}
                      >
                        Cancelar plano
                      </Button>
                    </div>
                    <p className="text-xs leading-relaxed text-[var(--insyt-muted)]">
                      Vencimentos a partir desta data deixam de ser cobrados. O
                      histórico continua salvo.
                    </p>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={isPending}
                    onClick={() => changeStatus("ativa")}
                  >
                    Reativar assinatura
                  </Button>
                )}

                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  disabled={isPending}
                  onClick={remove}
                >
                  Excluir assinatura
                </Button>
              </section>
            ) : null}
          </div>

          {/* Resumo fixo: o que vai ser cobrado, antes de salvar. */}
          <footer className="border-t border-[var(--insyt-border)] bg-white px-6 py-5">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--insyt-black)]">
                  {clientName || "Cliente não escolhido"}
                </p>
                <p className="truncate text-xs text-[var(--insyt-muted)]">
                  {selectedPlan
                    ? [selectedPlan.name, ...selectedAddons.map((addon) => addon.name)].join(" + ")
                    : "Plano não escolhido"}
                  {" · "}
                  {projectIds.length} {projectIds.length === 1 ? "site" : "sites"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-2xl font-bold tracking-tight text-[var(--insyt-black)]">
                  {parsedAmount !== null ? formatBrl(parsedAmount) : "R$ —"}
                  <span className="text-sm font-medium text-[var(--insyt-muted)]">/mês</span>
                </p>
                <p className="text-xs text-[var(--insyt-muted)]">
                  dia {billingDay} · {paymentMethod}
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={save}
              disabled={isPending || !canSave}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {editing ? "Salvar alterações" : "Criar assinatura"}
            </Button>
          </footer>
        </SheetContent>
      </Sheet>
    </>
  );
}

function FormSection({
  step,
  title,
  hint,
  optional = false,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--insyt-black)] text-[11px] font-bold text-white">
          {step}
        </span>
        <h3 className="font-bold text-[var(--insyt-black)]">
          {title}
          {optional ? (
            <span className="ml-2 text-xs font-medium text-[var(--insyt-muted)]">opcional</span>
          ) : null}
        </h3>
        {hint ? <span className="ml-auto text-xs text-[var(--insyt-muted)]">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
        checked
          ? "border-[var(--insyt-primary)] bg-[var(--insyt-primary)] text-white"
          : "border-[var(--insyt-border)] bg-white",
      )}
    >
      {checked ? <Check className="size-3.5" strokeWidth={3} /> : null}
    </span>
  );
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "h-9 rounded-full border px-4 text-sm font-medium transition-all duration-300 ease-fluid",
        selected
          ? "border-[var(--insyt-black)] bg-[var(--insyt-black)] text-white"
          : "border-[var(--insyt-border)] text-[var(--insyt-slate)] hover:border-[var(--insyt-slate)]/50 hover:text-[var(--insyt-black)]",
      )}
    >
      {children}
    </button>
  );
}

function SiteOption({
  site,
  checked,
  onToggle,
}: {
  site: SubscriptionSiteOption;
  checked: boolean;
  onToggle: () => void;
}) {
  const host = siteHost(site.url);
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onToggle}
      className={cn(
        "flex w-full min-w-0 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-300 ease-fluid",
        checked
          ? "border-[var(--insyt-primary)] bg-[var(--insyt-primary)]/5"
          : "border-[var(--insyt-border)] hover:border-[var(--insyt-slate)]/40",
      )}
    >
      <CheckMark checked={checked} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[var(--insyt-black)]">
          {site.title}
        </span>
        <span className="flex items-center gap-1 truncate text-xs text-[var(--insyt-muted)]">
          {host ? (
            <>
              <Globe className="size-3 shrink-0" />
              {host}
            </>
          ) : (
            (site.company ?? "Ainda sem domínio")
          )}
        </span>
      </span>
    </button>
  );
}

function PlanOption({
  plan,
  selected,
  onSelect,
}: {
  plan: SubscriptionPlan;
  selected: boolean;
  onSelect: () => void;
}) {
  const hours = formatHours(plan.included_hours);
  const features = plan.features.slice(0, 3);
  const extra = plan.features.length - features.length;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex min-w-0 flex-col rounded-2xl border p-5 text-left transition-all duration-300 ease-fluid",
        selected
          ? "border-[var(--insyt-primary)] bg-[var(--insyt-primary)]/5 shadow-[0_0_0_3px_rgba(247,66,17,0.08)]"
          : "border-[var(--insyt-border)] hover:border-[var(--insyt-slate)]/40",
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="font-bold text-[var(--insyt-black)]">{plan.name}</span>
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border",
            selected
              ? "border-[var(--insyt-primary)] bg-[var(--insyt-primary)] text-white"
              : "border-[var(--insyt-border)]",
          )}
        >
          {selected ? <Check className="size-3" strokeWidth={3} /> : null}
        </span>
      </span>
      <span className="mt-2 text-xl font-bold tracking-tight text-[var(--insyt-black)]">
        {formatBrl(plan.price)}
        <span className="text-xs font-medium text-[var(--insyt-muted)]">/mês</span>
      </span>
      {hours ? (
        <span className="mt-1 text-xs font-semibold text-[var(--insyt-primary-dark)]">{hours}</span>
      ) : null}
      {features.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-[var(--insyt-slate)]">
          {features.map((feature) => (
            <li key={feature} className="flex gap-1.5">
              <Check className="mt-0.5 size-3 shrink-0 text-emerald-600" />
              {feature}
            </li>
          ))}
          {extra > 0 ? <li className="text-[var(--insyt-muted)]">+ {extra} itens</li> : null}
        </ul>
      ) : null}
    </button>
  );
}
