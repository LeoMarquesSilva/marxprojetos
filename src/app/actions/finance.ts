"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/supabase/require-authenticated-user";
import { monthStartOf } from "@/lib/subscription-billing";
import {
  FINANCE_EXPENSE_CATEGORIES,
  FINANCE_INCOME_CATEGORIES,
  type FinanceEntry,
  type FinanceKind,
  type FinanceRecurringExpense,
  type FinanceSettings,
} from "@/types/finance";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type FinanceEntryInput = {
  kind: FinanceKind;
  amount: number;
  occurredOn: string;
  category: string;
  projectId: string | null;
  description: string;
  notes: string;
};

export type RecurringExpenseInput = {
  description: string;
  category: string;
  amount: number;
  dueDay: number;
  startedOn: string;
  subscriptionId: string | null;
  notes: string;
};

function categoriesFor(kind: FinanceKind) {
  return kind === "entrada" ? FINANCE_INCOME_CATEGORIES : FINANCE_EXPENSE_CATEGORIES;
}

function buildEntryFields(input: FinanceEntryInput) {
  const description = input.description.trim();
  const category = input.category.trim();
  const notes = input.notes.trim();

  if (input.kind !== "entrada" && input.kind !== "saida") {
    return { error: "Escolha se é entrada ou saída." };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { error: "Informe um valor maior que zero." };
  }
  if (!DATE_PATTERN.test(input.occurredOn)) {
    return { error: "Informe a data." };
  }
  if (!(categoriesFor(input.kind) as readonly string[]).includes(category)) {
    return { error: "Escolha uma categoria." };
  }
  if (!description) return { error: "Descreva o lançamento." };
  if (description.length > 160) {
    return { error: "A descrição passa de 160 caracteres." };
  }

  return {
    fields: {
      kind: input.kind,
      amount: Math.round(input.amount * 100) / 100,
      occurred_on: input.occurredOn,
      category,
      project_id: input.projectId || null,
      description,
      notes: notes || null,
    },
  };
}

function buildRecurringFields(input: RecurringExpenseInput) {
  const description = input.description.trim();
  const category = input.category.trim();
  const notes = input.notes.trim();

  if (!description) return { error: "Descreva o gasto." };
  if (description.length > 160) {
    return { error: "A descrição passa de 160 caracteres." };
  }
  if (!(FINANCE_EXPENSE_CATEGORIES as readonly string[]).includes(category)) {
    return { error: "Escolha uma categoria." };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { error: "Informe um valor maior que zero." };
  }
  if (!Number.isInteger(input.dueDay) || input.dueDay < 1 || input.dueDay > 28) {
    return { error: "O dia de vencimento vai de 1 a 28." };
  }
  if (!DATE_PATTERN.test(input.startedOn)) {
    return { error: "Informe a partir de quando." };
  }

  return {
    fields: {
      description,
      category,
      amount: Math.round(input.amount * 100) / 100,
      due_day: input.dueDay,
      started_on: input.startedOn,
      subscription_id: input.subscriptionId || null,
      notes: notes || null,
    },
  };
}

export async function getFinanceEntries(): Promise<FinanceEntry[]> {
  const { supabase } = await requireAuthenticatedUser();
  const { data, error } = await supabase
    .from("finance_entries")
    .select("*")
    .order("occurred_on", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as FinanceEntry[];
}

export async function getRecurringExpenses(): Promise<FinanceRecurringExpense[]> {
  const { supabase } = await requireAuthenticatedUser();
  const { data, error } = await supabase
    .from("finance_recurring_expenses")
    .select("*")
    .order("due_day", { ascending: true })
    .order("description", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as FinanceRecurringExpense[];
}

export type FinanceProjectRow = {
  id: string;
  title: string;
  contract_amount: number | string | null;
  received_before: number | string;
};

export async function getFinanceProjects(): Promise<FinanceProjectRow[]> {
  const { supabase } = await requireAuthenticatedUser();
  const { data, error } = await supabase
    .from("projects")
    .select("id, title, contract_amount, received_before")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as FinanceProjectRow[];
}

/**
 * Valor fechado do desenvolvimento (null apaga) e quanto dele já tinha sido
 * recebido antes de Finanças — esse abate o que falta, sem entrar no caixa.
 */
export async function setProjectContractAmount(
  projectId: string,
  amount: number | null,
  receivedBefore = 0,
) {
  const { supabase } = await requireAuthenticatedUser();
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
    return { error: "Informe um valor válido." };
  }
  if (!Number.isFinite(receivedBefore) || receivedBefore < 0) {
    return { error: "Informe um valor recebido válido." };
  }
  if (amount !== null && receivedBefore > amount) {
    return { error: "O já recebido passa do valor fechado." };
  }

  const { error } = await supabase
    .from("projects")
    .update({
      contract_amount: amount === null ? null : Math.round(amount * 100) / 100,
      received_before: amount === null ? 0 : Math.round(receivedBefore * 100) / 100,
    })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath("/financas");
  return { success: true };
}

export async function getFinanceSettings(): Promise<FinanceSettings | null> {
  const { supabase } = await requireAuthenticatedUser();
  const { data, error } = await supabase
    .from("finance_settings")
    .select("balance_amount, balance_on, reserve_amount")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as FinanceSettings | null;
}

export async function saveFinanceSettings(input: {
  balanceAmount: number;
  balanceOn: string;
  reserveAmount: number;
}) {
  const { supabase } = await requireAuthenticatedUser();
  if (!Number.isFinite(input.balanceAmount)) return { error: "Informe o saldo." };
  if (!DATE_PATTERN.test(input.balanceOn)) return { error: "Informe a data do saldo." };
  if (!Number.isFinite(input.reserveAmount) || input.reserveAmount < 0) {
    return { error: "A reserva não pode ser negativa." };
  }

  const { error } = await supabase.from("finance_settings").upsert({
    id: true,
    balance_amount: Math.round(input.balanceAmount * 100) / 100,
    balance_on: input.balanceOn,
    reserve_amount: Math.round(input.reserveAmount * 100) / 100,
    updated_at: new Date().toISOString(),
  });

  if (error) return { error: error.message };

  revalidatePath("/financas");
  return { success: true };
}

export async function createFinanceEntry(input: FinanceEntryInput) {
  const { supabase, user } = await requireAuthenticatedUser();
  const built = buildEntryFields(input);
  if ("error" in built) return { error: built.error };

  const { error } = await supabase
    .from("finance_entries")
    .insert({ owner_id: user.id, ...built.fields });

  if (error) return { error: error.message };

  revalidatePath("/financas");
  return { success: true };
}

export async function updateFinanceEntry(id: string, input: FinanceEntryInput) {
  const { supabase } = await requireAuthenticatedUser();
  const built = buildEntryFields(input);
  if ("error" in built) return { error: built.error };

  const { error } = await supabase
    .from("finance_entries")
    .update({ ...built.fields, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/financas");
  return { success: true };
}

export async function deleteFinanceEntry(id: string) {
  const { supabase } = await requireAuthenticatedUser();
  const { error } = await supabase.from("finance_entries").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/financas");
  return { success: true };
}

export async function createRecurringExpense(input: RecurringExpenseInput) {
  const { supabase, user } = await requireAuthenticatedUser();
  const built = buildRecurringFields(input);
  if ("error" in built) return { error: built.error };

  const { error } = await supabase
    .from("finance_recurring_expenses")
    .insert({ owner_id: user.id, ...built.fields });

  if (error) return { error: error.message };

  revalidatePath("/financas");
  return { success: true };
}

export async function updateRecurringExpense(id: string, input: RecurringExpenseInput) {
  const { supabase } = await requireAuthenticatedUser();
  const built = buildRecurringFields(input);
  if ("error" in built) return { error: built.error };

  const { error } = await supabase
    .from("finance_recurring_expenses")
    .update({ ...built.fields, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/financas");
  return { success: true };
}

/**
 * Encerrar em vez de excluir: os meses já pagos continuam no caixa com o
 * nome do gasto, e a previsão para de contar a partir da data.
 */
export async function endRecurringExpense(id: string, endedOn: string) {
  const { supabase } = await requireAuthenticatedUser();
  if (!DATE_PATTERN.test(endedOn)) return { error: "Informe a data de encerramento." };

  const { error } = await supabase
    .from("finance_recurring_expenses")
    .update({ ended_on: endedOn, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/financas");
  return { success: true };
}

export async function payRecurringExpense(input: {
  expenseId: string;
  referenceMonth: string;
  paidOn: string;
}) {
  const { supabase, user } = await requireAuthenticatedUser();
  if (!DATE_PATTERN.test(input.referenceMonth) || !DATE_PATTERN.test(input.paidOn)) {
    return { error: "Data inválida." };
  }

  const { data: expense, error: expenseError } = await supabase
    .from("finance_recurring_expenses")
    .select("description, category, amount")
    .eq("id", input.expenseId)
    .single();

  if (expenseError || !expense) return { error: "Gasto fixo não encontrado." };

  const { error } = await supabase.from("finance_entries").insert({
    owner_id: user.id,
    kind: "saida",
    amount: expense.amount,
    occurred_on: input.paidOn,
    category: expense.category,
    description: expense.description,
    recurring_expense_id: input.expenseId,
    reference_month: monthStartOf(input.referenceMonth),
  });

  if (error) {
    if (error.code === "23505") return { error: "Esse mês já está pago." };
    return { error: error.message };
  }

  revalidatePath("/financas");
  return { success: true };
}
