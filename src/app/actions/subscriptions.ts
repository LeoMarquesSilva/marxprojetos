"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuthenticatedUser } from "@/lib/supabase/require-authenticated-user";
import { monthStartOf } from "@/lib/subscription-billing";
import {
  PAYMENT_METHODS,
  type Subscription,
  type SubscriptionClientOption,
  type SubscriptionPayment,
  type SubscriptionPlan,
  type SubscriptionPlanKind,
  type SubscriptionSiteOption,
  type SubscriptionStatus,
} from "@/types/subscription";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type SubscriptionInput = {
  crmClientId: string | null;
  clientName: string;
  planId: string;
  addonIds: string[];
  projectIds: string[];
  amount: number;
  billingDay: number;
  paymentMethod: string;
  startedOn: string;
  notes: string;
};

// O plano vem do catálogo, mas o nome é copiado para a assinatura: se o
// plano for renomeado ou arquivado depois, o histórico continua legível.
async function buildSubscriptionFields(
  supabase: SupabaseClient,
  input: SubscriptionInput,
) {
  const clientName = input.clientName.trim();
  if (!clientName) return { error: "Escolha o cliente." };
  if (!input.planId) return { error: "Escolha o plano." };
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    return { error: "Informe um valor mensal válido." };
  }
  if (!Number.isInteger(input.billingDay) || input.billingDay < 1 || input.billingDay > 28) {
    return { error: "O dia de vencimento vai de 1 a 28." };
  }
  if (!DATE_PATTERN.test(input.startedOn)) {
    return { error: "Informe a data de início." };
  }
  if (!(PAYMENT_METHODS as readonly string[]).includes(input.paymentMethod)) {
    return { error: "Escolha a forma de pagamento." };
  }

  const { data: plans, error } = await supabase
    .from("subscription_plans")
    .select("id, name, kind")
    .in("id", [input.planId, ...input.addonIds]);

  if (error) return { error: error.message };
  const plan = plans?.find((item) => item.id === input.planId && item.kind === "plano");
  if (!plan) return { error: "Plano não encontrado." };
  const addonIds = input.addonIds.filter((id) =>
    plans?.some((item) => item.id === id && item.kind === "adicional"),
  );

  return {
    fields: {
      crm_client_id: input.crmClientId || null,
      client_name: clientName,
      plan_id: plan.id as string,
      plan_name: plan.name as string,
      addon_ids: addonIds,
      project_ids: [...new Set(input.projectIds)],
      amount: Math.round(input.amount * 100) / 100,
      billing_day: input.billingDay,
      payment_method: input.paymentMethod,
      started_on: input.startedOn,
      notes: input.notes.trim() || null,
    },
  };
}

type SubscriptionsWithPayments = {
  subscriptions: Subscription[];
  payments: SubscriptionPayment[];
};

export async function getSubscriptionsWithPayments(): Promise<SubscriptionsWithPayments> {
  const { supabase } = await requireAuthenticatedUser();

  const [subscriptionsResult, paymentsResult] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("*")
      .order("status", { ascending: true })
      .order("client_name", { ascending: true }),
    supabase
      .from("subscription_payments")
      .select("*")
      .order("reference_month", { ascending: false }),
  ]);

  if (subscriptionsResult.error) throw new Error(subscriptionsResult.error.message);
  if (paymentsResult.error) throw new Error(paymentsResult.error.message);

  return {
    subscriptions: (subscriptionsResult.data ?? []) as Subscription[],
    payments: (paymentsResult.data ?? []) as SubscriptionPayment[],
  };
}

type SubscriptionFormData = {
  clients: SubscriptionClientOption[];
  sites: SubscriptionSiteOption[];
  plans: SubscriptionPlan[];
};

export async function getSubscriptionFormData(): Promise<SubscriptionFormData> {
  const { supabase } = await requireAuthenticatedUser();

  const [clientsResult, projectsResult, plansResult] = await Promise.all([
    supabase
      .from("crm_clients")
      .select("id, name, company, project_id")
      .order("name", { ascending: true }),
    supabase
      .from("projects")
      .select("id, title, client_name, client_company, portfolio_live_url")
      .order("created_at", { ascending: false }),
    supabase
      .from("subscription_plans")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("price", { ascending: true }),
  ]);

  if (clientsResult.error) throw new Error(clientsResult.error.message);
  if (projectsResult.error) throw new Error(projectsResult.error.message);
  if (plansResult.error) throw new Error(plansResult.error.message);

  return {
    clients: (clientsResult.data ?? []) as SubscriptionClientOption[],
    sites: (projectsResult.data ?? []).map((project) => ({
      id: project.id as string,
      title: project.title as string,
      company: (project.client_company ?? project.client_name ?? null) as string | null,
      url: (project.portfolio_live_url ?? null) as string | null,
    })),
    plans: (plansResult.data ?? []) as SubscriptionPlan[],
  };
}

export async function createSubscription(input: SubscriptionInput) {
  const { supabase, user } = await requireAuthenticatedUser();
  const built = await buildSubscriptionFields(supabase, input);
  if ("error" in built) return { error: built.error };

  const { error } = await supabase
    .from("subscriptions")
    .insert({ ...built.fields, owner_id: user.id });

  if (error) return { error: error.message };

  revalidatePath("/recorrencia");
  return { success: true };
}

export async function updateSubscription(id: string, input: SubscriptionInput) {
  const { supabase } = await requireAuthenticatedUser();
  const built = await buildSubscriptionFields(supabase, input);
  if ("error" in built) return { error: built.error };

  const { error } = await supabase
    .from("subscriptions")
    .update({ ...built.fields, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/recorrencia");
  return { success: true };
}

export type SubscriptionPlanInput = {
  name: string;
  kind: SubscriptionPlanKind;
  price: number;
  includedHours: number | null;
  features: string[];
};

function buildPlanFields(input: SubscriptionPlanInput) {
  const name = input.name.trim();
  if (!name) return { error: "Informe o nome do plano." };
  if (input.kind !== "plano" && input.kind !== "adicional") {
    return { error: "Tipo de plano inválido." };
  }
  if (!Number.isFinite(input.price) || input.price < 0) {
    return { error: "Informe um preço válido." };
  }
  if (
    input.includedHours !== null &&
    (!Number.isFinite(input.includedHours) || input.includedHours < 0)
  ) {
    return { error: "Horas incluídas inválidas." };
  }

  return {
    fields: {
      name,
      kind: input.kind,
      price: Math.round(input.price * 100) / 100,
      included_hours: input.includedHours,
      features: input.features.map((feature) => feature.trim()).filter(Boolean),
    },
  };
}

export async function createSubscriptionPlan(input: SubscriptionPlanInput) {
  const { supabase, user } = await requireAuthenticatedUser();
  const built = buildPlanFields(input);
  if ("error" in built) return { error: built.error };

  const { error } = await supabase
    .from("subscription_plans")
    .insert({ ...built.fields, owner_id: user.id });

  if (error) return { error: error.message };

  revalidatePath("/recorrencia");
  return { success: true };
}

export async function updateSubscriptionPlan(id: string, input: SubscriptionPlanInput) {
  const { supabase } = await requireAuthenticatedUser();
  const built = buildPlanFields(input);
  if ("error" in built) return { error: built.error };

  const { error } = await supabase
    .from("subscription_plans")
    .update({ ...built.fields, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/recorrencia");
  return { success: true };
}

// Não existe excluir: assinaturas antigas apontam para o plano. Arquivar só
// tira ele das opções de novas assinaturas.
export async function setSubscriptionPlanActive(id: string, active: boolean) {
  const { supabase } = await requireAuthenticatedUser();
  const { error } = await supabase
    .from("subscription_plans")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/recorrencia");
  return { success: true };
}

// Cancelar guarda a data em vez de apagar: os meses pagos continuam no
// histórico e os devidos até ali continuam aparecendo se não foram pagos.
export async function setSubscriptionStatus(
  id: string,
  status: SubscriptionStatus,
  endedOn: string | null,
) {
  const { supabase } = await requireAuthenticatedUser();
  if (status === "cancelada" && (!endedOn || !DATE_PATTERN.test(endedOn))) {
    return { error: "Informe a data de cancelamento." };
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status,
      ended_on: status === "cancelada" ? endedOn : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/recorrencia");
  return { success: true };
}

export async function deleteSubscription(id: string) {
  const { supabase } = await requireAuthenticatedUser();
  const { error } = await supabase.from("subscriptions").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/recorrencia");
  return { success: true };
}

export async function registerSubscriptionPayment(input: {
  subscriptionId: string;
  referenceMonth: string;
  amount: number;
  paidOn: string;
  method: string;
}) {
  const { supabase } = await requireAuthenticatedUser();
  if (!DATE_PATTERN.test(input.referenceMonth)) {
    return { error: "Escolha o mês do pagamento." };
  }
  if (!DATE_PATTERN.test(input.paidOn)) {
    return { error: "Informe a data do pagamento." };
  }
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    return { error: "Informe um valor válido." };
  }

  const { error } = await supabase.from("subscription_payments").insert({
    subscription_id: input.subscriptionId,
    reference_month: monthStartOf(input.referenceMonth),
    amount: input.amount,
    paid_on: input.paidOn,
    method: input.method.trim() || null,
  });

  if (error) {
    if (error.code === "23505") return { error: "Esse mês já está pago." };
    return { error: error.message };
  }

  revalidatePath("/recorrencia");
  revalidatePath("/financas");
  return { success: true };
}

export async function deleteSubscriptionPayment(id: string) {
  const { supabase } = await requireAuthenticatedUser();
  const { error } = await supabase
    .from("subscription_payments")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/recorrencia");
  revalidatePath("/financas");
  return { success: true };
}
