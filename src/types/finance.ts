export type FinanceKind = "entrada" | "saida";

export const FINANCE_INCOME_CATEGORIES = ["Projeto", "Avulso", "Outros"] as const;

export const FINANCE_EXPENSE_CATEGORIES = [
  "Ferramentas",
  "Domínio",
  "Imposto",
  "Anúncio",
  "Freelancer",
  "Outros",
] as const;

export type FinanceEntry = {
  id: string;
  owner_id: string;
  kind: FinanceKind;
  /** numeric do Postgres chega como string ou number dependendo do driver. */
  amount: number | string;
  occurred_on: string;
  category: string;
  description: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
