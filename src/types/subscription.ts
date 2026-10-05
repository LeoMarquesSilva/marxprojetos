export type SubscriptionStatus = "ativa" | "cancelada";

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  ativa: "Ativa",
  cancelada: "Cancelada",
};

export const PAYMENT_METHODS = ["Pix", "Boleto", "Cartão", "Transferência"] as const;

export type Subscription = {
  id: string;
  owner_id: string;
  crm_client_id: string | null;
  proposal_id: string | null;
  client_name: string;
  /** Nome do plano no momento em que foi escolhido (o catálogo pode mudar). */
  plan_name: string;
  /** Legado: texto livre de antes do catálogo de planos. */
  description: string | null;
  plan_id: string | null;
  addon_ids: string[];
  project_ids: string[];
  payment_method: string | null;
  /** numeric do Postgres chega como string ou number dependendo do driver. */
  amount: number | string;
  billing_day: number;
  status: SubscriptionStatus;
  started_on: string;
  ended_on: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionPayment = {
  id: string;
  subscription_id: string;
  reference_month: string;
  amount: number | string;
  paid_on: string;
  method: string | null;
  notes: string | null;
  created_at: string;
};

export type SubscriptionPlanKind = "plano" | "adicional";

export type SubscriptionPlan = {
  id: string;
  owner_id: string;
  name: string;
  kind: SubscriptionPlanKind;
  price: number | string;
  included_hours: number | string | null;
  features: string[];
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/** Site do sistema que pode entrar numa assinatura. */
export type SubscriptionSiteOption = {
  id: string;
  title: string;
  company: string | null;
  url: string | null;
};

export type SubscriptionClientOption = {
  id: string;
  name: string;
  company: string | null;
  project_id: string | null;
};
