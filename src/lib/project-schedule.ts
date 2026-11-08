// Parcelas com data de um projeto: o que foi combinado com o cliente, como
// "entrada de R$ 1.500 em 10/11 e 4x de R$ 750". Sem banco nem React, para
// testar no node:test.
//
// O plano vive em projects.payment_schedule (jsonb). Não há ligação direta
// entre lançamento e parcela: o que já entrou no projeto abate da parcela mais
// antiga para a mais nova, igual aos repasses da sociedade. Assim, se o cliente
// paga um valor diferente, o resto da parcela continua em aberto.

import {
  addMonths,
  monthStartOf,
  toAmount,
  type ForecastCharge,
} from "@/lib/subscription-billing";

export type ScheduledInstallment = {
  dueOn: string;
  amount: number;
  /** Nome próprio, como "entrada"; sem nome, vira "parcela 2 de 4". */
  label: string | null;
};

export type InstallmentState = ScheduledInstallment & {
  name: string;
  /** Quanto dessa parcela já foi coberto pelo que entrou. */
  paid: number;
  /** Quanto ainda falta dessa parcela. */
  open: number;
  status: "pago" | "atrasado" | "a_vencer" | "futuro";
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** Diferença de centavos entre o combinado e o recebido não vira cobrança. */
const CENT_TOLERANCE = 0.1;

function round(value: number) {
  return Math.round(value * 100) / 100;
}

/** Lê o jsonb do banco: item inválido fica de fora, sem derrubar a tela. */
export function parsePaymentSchedule(raw: unknown): ScheduledInstallment[] {
  if (!Array.isArray(raw)) return [];
  const items: ScheduledInstallment[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const { dueOn, amount, label } = item as Record<string, unknown>;
    if (typeof dueOn !== "string" || !DATE_PATTERN.test(dueOn)) continue;
    const value = toAmount(amount as number | string);
    if (value <= 0) continue;
    items.push({
      dueOn,
      amount: round(value),
      label: typeof label === "string" && label.trim() ? label.trim() : null,
    });
  }
  return items.sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

/** Situação de cada parcela, com o recebido abatendo da mais antiga em diante. */
export function installmentStates(
  schedule: ScheduledInstallment[],
  received: number | string,
  today: string,
): InstallmentState[] {
  const current = monthStartOf(today);
  const numbered = schedule.filter((item) => !item.label).length;
  let left = Math.max(0, toAmount(received));
  let position = 0;

  return schedule.map((item) => {
    if (!item.label) position += 1;
    const covered = Math.min(item.amount, left);
    left = round(left - covered);
    const rest = round(item.amount - covered);
    const open = rest < CENT_TOLERANCE ? 0 : rest;

    return {
      ...item,
      name: item.label ?? (numbered === 1 ? "parcela" : `parcela ${position} de ${numbered}`),
      paid: round(item.amount - open),
      open,
      status:
        open === 0
          ? "pago"
          : item.dueOn < today
            ? "atrasado"
            : monthStartOf(item.dueOn) === current
              ? "a_vencer"
              : "futuro",
    };
  });
}

/** Parcelas em aberto no formato da previsão de Finanças. */
export function scheduleForecast(
  project: { id: string; title: string },
  states: InstallmentState[],
): ForecastCharge[] {
  return states.flatMap((state, index) =>
    state.status === "pago"
      ? []
      : [
          {
            id: `parcela:${project.id}:${index}`,
            subscriptionId: "",
            projectId: project.id,
            parcela: { projectTitle: project.title, name: state.name },
            clientName: `${project.title} · ${state.name}`,
            amount: state.open,
            dueOn: state.dueOn,
            month: monthStartOf(state.dueOn),
            timing: state.status,
          },
        ],
  );
}

/** Mesmo dia no mês seguinte, ou o último dia se o mês for mais curto. */
export function nextInstallmentDate(dueOn: string): string {
  const next = addMonths(dueOn, 1);
  const lastDay = new Date(
    Date.UTC(Number(next.slice(0, 4)), Number(next.slice(5, 7)), 0),
  ).getUTCDate();
  const day = Math.min(Number(dueOn.slice(8, 10)), lastDay);
  return `${next.slice(0, 7)}-${String(day).padStart(2, "0")}`;
}
