import "server-only";

import { cache } from "react";
import { getBrasiliaStoredDayStart } from "@/lib/crm-rules";
import {
  chargesInMonth,
  linesInMonth,
  monthTotals,
  sumCharges,
  type ForecastTiming,
} from "@/lib/finance";
import { loadFinanceData } from "@/lib/finance-page-data";
import type { FinanceProjectOption } from "@/types/finance";
import {
  countByWorkStatus,
  isDueSoon,
  isTrackedProject,
  onTimeRate,
  parseWorkStatus,
  workRank,
} from "@/lib/project-work";
import { addMonths, daysUntil, formatBrl, monthStartOf } from "@/lib/subscription-billing";
import { requireAuthenticatedUser } from "@/lib/supabase/require-authenticated-user";
import type { ProjectStatus } from "@/types/briefing";
import { PAYMENT_METHODS } from "@/types/subscription";

export type HomeProject = {
  id: string;
  title: string;
  client_name: string | null;
  client_company: string | null;
  status: ProjectStatus;
  created_at: string;
  submitted_at: string | null;
  contract_amount: number | string | null;
  work_status: string | null;
  due_on: string | null;
  delivered_on: string | null;
};

export type HomeTask = {
  id: string;
  kind: "passo" | "entrega";
  title: string;
  detail: string;
  date: string | null;
  href: string;
  /** Só nos próximos passos do CRM, que podem ser concluídos daqui. */
  clientName?: string;
};

/** Como dar baixa no item sem sair da Início. Sociedade sem `option` só leva ao painel do projeto. */
export type HomeMoneySettle =
  | { type: "mensalidade"; subscriptionId: string; month: string; method: string }
  | { type: "parcela"; projectId: string; projectTitle: string; name: string }
  | { type: "gasto"; expenseId: string; month: string }
  | { type: "sociedade"; projectId: string; option?: FinanceProjectOption };

export type HomeMoneyItem = {
  id: string;
  kind: "entrada" | "saida";
  title: string;
  dueOn: string;
  amount: number;
  timing: ForecastTiming;
  settle: HomeMoneySettle;
};

export type HomeActivity = {
  id: string;
  kind: "pagamento" | "briefing" | "entrega" | "comentario";
  title: string;
  date: string;
  href: string;
};

/** O que a Início mostra, calculado só do que está no banco. */
export const loadHomeData = cache(async () => {
  const { supabase } = await requireAuthenticatedUser();
  const finance = await loadFinanceData();
  const { today, currentMonth, ledger, charges, bills } = finance;
  const dayStart = getBrasiliaStoredDayStart();

  const [projectsResult, stepsResult, stepCount, crmResult, unreadResult, commentsResult] =
    await Promise.all([
      supabase
        .from("projects")
        .select(
          "id, title, client_name, client_company, status, created_at, submitted_at, contract_amount, work_status, due_on, delivered_on",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("crm_clients")
        .select("id, name, next_step, next_step_at")
        .not("next_step", "is", null)
        .neq("stage", "perdido")
        .order("next_step_at", { ascending: true, nullsFirst: false })
        .limit(6),
      supabase
        .from("crm_clients")
        .select("id", { count: "exact", head: true })
        .not("next_step", "is", null)
        .neq("stage", "perdido"),
      supabase.from("crm_clients").select("stage, value"),
      supabase
        .from("crm_whatsapp_chats")
        .select("remote_jid", { count: "exact", head: true })
        .gt("unread_count", 0),
      supabase
        .from("site_comments")
        .select("project_id, created_at")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  if (projectsResult.error) throw new Error(projectsResult.error.message);
  if (stepsResult.error) throw new Error(stepsResult.error.message);

  const allProjects = (projectsResult.data ?? []) as HomeProject[];
  const projects = allProjects.filter(isTrackedProject);
  const counts = countByWorkStatus(projects);
  const titleById = new Map(allProjects.map((project) => [project.id, project.title]));

  const rankedProjects = [...projects].sort((a, b) => {
    const rank = workRank(a) - workRank(b);
    if (rank !== 0) return rank;
    const due = (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999");
    if (due !== 0) return due;
    return b.created_at.localeCompare(a.created_at);
  });
  const openBriefings = allProjects.filter(
    (project) => project.status === "sent" || project.status === "in_progress",
  );
  const deliveries = projects
    .filter((project) => isDueSoon(project, today, 7))
    .sort((a, b) => (a.due_on ?? "").localeCompare(b.due_on ?? ""));

  const monthLines = linesInMonth(ledger, currentMonth);
  const totals = monthTotals(monthLines);
  const lateCharges = charges.filter((item) => item.timing === "atrasado");
  const lateBills = bills.filter((item) => item.timing === "atrasado");
  const toReceive = sumCharges([...chargesInMonth(charges, currentMonth), ...lateCharges]);
  const dueThisWeek = sumCharges(
    charges.filter((item) => {
      const days = daysUntil(item.dueOn, today);
      return days >= 0 && days <= 7;
    }),
  );

  const moneyMonths = Array.from({ length: 6 }, (_, index) =>
    addMonths(currentMonth, index - 3),
  ).map((month) => {
    const realized = monthTotals(linesInMonth(ledger, month));
    return {
      month,
      income: realized.income,
      expense: realized.expense,
      expectedIncome: sumCharges(chargesInMonth(charges, month)),
      expectedExpense: sumCharges(chargesInMonth(bills, month)),
      href: month === currentMonth ? "/financas" : `/financas?mes=${month.slice(0, 7)}`,
    };
  });

  const tasks: HomeTask[] = [
    ...deliveries.slice(0, 3).map((project) => ({
      id: `entrega:${project.id}`,
      kind: "entrega" as const,
      title: `Entregar ${project.title}`,
      detail: project.client_name ?? "Projeto",
      date: project.due_on,
      href: `/projects/${project.id}`,
    })),
    ...(stepsResult.data ?? []).map((client) => ({
      id: client.id as string,
      kind: "passo" as const,
      title: client.next_step as string,
      detail: client.name as string,
      date: client.next_step_at ? String(client.next_step_at).slice(0, 10) : null,
      href: `/crm/${client.id}`,
      clientName: client.name as string,
    })),
  ].sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));

  const activities: HomeActivity[] = [
    ...ledger
      .filter((line) => line.kind === "entrada" && line.occurredOn <= today)
      .slice(0, 5)
      .map((line) => ({
        id: `pagamento:${line.source}:${line.id}`,
        kind: "pagamento" as const,
        title: `Pagamento recebido: ${formatBrl(line.amount)} · ${line.description}`,
        date: line.occurredOn,
        href: `/financas?mes=${line.occurredOn.slice(0, 7)}`,
      })),
    ...allProjects
      .filter((project) => project.submitted_at)
      .sort((a, b) => b.submitted_at!.localeCompare(a.submitted_at!))
      .slice(0, 3)
      .map((project) => ({
        id: `briefing:${project.id}`,
        kind: "briefing" as const,
        title: `Briefing respondido: ${project.client_name || project.title}`,
        date: project.submitted_at!.slice(0, 10),
        href: `/projects/${project.id}`,
      })),
    ...projects
      .filter((project) => parseWorkStatus(project.work_status) === "concluido" && project.delivered_on)
      .slice(0, 3)
      .map((project) => ({
        id: `entrega:${project.id}`,
        kind: "entrega" as const,
        title: `Projeto concluído: ${project.title}`,
        date: project.delivered_on!,
        href: `/projects/${project.id}`,
      })),
    // Uma rodada de revisão gera vários comentários: vira uma linha por site e dia.
    ...[
      ...(commentsResult.data ?? [])
        .reduce((groups, comment) => {
          const date = String(comment.created_at).slice(0, 10);
          const key = `${comment.project_id}:${date}`;
          const group = groups.get(key) ?? { projectId: comment.project_id as string, date, count: 0 };
          group.count += 1;
          return groups.set(key, group);
        }, new Map<string, { projectId: string; date: string; count: number }>())
        .values(),
    ].map((group) => ({
      id: `comentario:${group.projectId}:${group.date}`,
      kind: "comentario" as const,
      title: `${group.count === 1 ? "1 comentário" : `${group.count} comentários`} em ${
        titleById.get(group.projectId) ?? "um site"
      }`,
      date: group.date,
      href: `/sites/${group.projectId}`,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const crmClients = crmResult.data ?? [];
  const openLeads = crmClients.filter(
    (client) => client.stage !== "fechado" && client.stage !== "perdido",
  );

  return {
    today,
    currentMonth,
    dayStart,
    counts,
    trackedCount: projects.length,
    deliveredThisMonth: projects.filter(
      (project) =>
        parseWorkStatus(project.work_status) === "concluido" &&
        project.delivered_on &&
        monthStartOf(project.delivered_on) === currentMonth,
    ).length,
    onTime: onTimeRate(projects),
    rankedProjects,
    openBriefings,
    deliveries,
    income: totals.income,
    toReceive,
    dueThisWeek,
    lateReceive: sumCharges(lateCharges),
    latePay: sumCharges(lateBills),
    moneyMonths,
    openItems: [
      ...charges
        .filter((item) => item.timing !== "futuro" || daysUntil(item.dueOn, today) <= 30)
        .map((item): HomeMoneyItem => ({
          id: `entra:${item.id}`,
          kind: "entrada",
          title: item.clientName,
          dueOn: item.dueOn,
          amount: item.amount,
          timing: item.timing,
          settle: item.parcela
            ? {
                type: "parcela",
                projectId: item.projectId!,
                projectTitle: item.parcela.projectTitle,
                name: item.parcela.name,
              }
            : item.projectId
              ? {
                  type: "sociedade",
                  projectId: item.projectId,
                  option: finance.partnershipViews.find((view) => view.id === item.projectId)?.option,
                }
              : {
                  type: "mensalidade",
                  subscriptionId: item.subscriptionId,
                  month: item.month,
                  method:
                    finance.rowBySubscription.get(item.subscriptionId)?.subscription
                      .payment_method ?? PAYMENT_METHODS[0],
                },
        })),
      ...bills
        .filter((item) => item.timing !== "futuro" || daysUntil(item.dueOn, today) <= 30)
        .map((item): HomeMoneyItem => ({
          id: `sai:${item.id}`,
          kind: "saida",
          title: item.description,
          dueOn: item.dueOn,
          amount: item.amount,
          timing: item.timing,
          settle: item.projectId
            ? { type: "sociedade", projectId: item.projectId }
            : { type: "gasto", expenseId: item.expenseId, month: item.month },
        })),
    ].sort((a, b) => a.dueOn.localeCompare(b.dueOn)),
    projectOptions: finance.projectOptions,
    tasks,
    taskTotal: (stepCount.count ?? tasks.length) + Math.min(deliveries.length, 3),
    activities,
    unread: unreadResult.count ?? 0,
    activeLeads: openLeads.length,
    pipeline: openLeads.reduce((total, client) => total + Number(client.value ?? 0), 0),
    closedClients: crmClients.filter((client) => client.stage === "fechado").length,
  };
});
