"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/supabase/require-authenticated-user";
import {
  FINANCE_EXPENSE_CATEGORIES,
  FINANCE_INCOME_CATEGORIES,
  type FinanceEntry,
  type FinanceKind,
} from "@/types/finance";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type FinanceEntryInput = {
  kind: FinanceKind;
  amount: number;
  occurredOn: string;
  category: string;
  description: string;
  notes: string;
};

function categoriesFor(kind: FinanceKind) {
  return kind === "entrada" ? FINANCE_INCOME_CATEGORIES : FINANCE_EXPENSE_CATEGORIES;
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

export async function createFinanceEntry(input: FinanceEntryInput) {
  const { supabase, user } = await requireAuthenticatedUser();
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

  const { error } = await supabase.from("finance_entries").insert({
    owner_id: user.id,
    kind: input.kind,
    amount: Math.round(input.amount * 100) / 100,
    occurred_on: input.occurredOn,
    category,
    description,
    notes: notes || null,
  });

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
