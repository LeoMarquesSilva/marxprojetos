export type FinanceKind = "entrada" | "saida";

export const FINANCE_INCOME_CATEGORIES = ["Projeto", "Avulso", "Outros"] as const;

export const FINANCE_EXPENSE_CATEGORIES = [
  "Imposto",
  "Repasse a sócio",
  "Retirada (pró-labore)",
  "Ferramentas",
  "Hospedagem",
  "Domínio",
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
  /** Preenchido quando o lançamento é o pagamento de um gasto fixo. */
  recurring_expense_id: string | null;
  /** Dia 1 do mês a que o pagamento do gasto fixo se refere. */
  reference_month: string | null;
  /** Projeto a que a parcela (ou o custo) pertence. */
  project_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Projeto que pode receber lançamentos, com o que já entrou dele. */
export type FinanceProjectOption = {
  id: string;
  title: string;
  /** Valor fechado do desenvolvimento; null se ainda não informado. */
  contractAmount: number | null;
  /** Lançamentos ligados + o que já tinha sido recebido antes de Finanças. */
  received: number;
  /** Recebido antes de Finanças: abate o que falta, não entra no caixa. */
  receivedBefore: number;
};

/** Saldo conferido no banco numa data: a base da projeção de caixa. */
export type FinanceSettings = {
  balance_amount: number | string;
  balance_on: string;
  reserve_amount: number | string;
};

export type FinanceRecurringExpense = {
  id: string;
  owner_id: string;
  description: string;
  category: string;
  amount: number | string;
  due_day: number;
  started_on: string;
  ended_on: string | null;
  subscription_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
