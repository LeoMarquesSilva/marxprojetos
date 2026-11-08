// Andamento de produção de um projeto: status, prazo e entrega. Sem banco nem
// React, para testar no node:test. É independente de projects.status, que só diz
// em que pé está o briefing respondido pelo cliente.

export const WORK_STATUSES = ["em_andamento", "em_revisao", "concluido", "pausado"] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  em_andamento: "Em andamento",
  em_revisao: "Em revisão",
  concluido: "Concluído",
  pausado: "Pausado",
};

export function parseWorkStatus(value: unknown): WorkStatus | null {
  return WORK_STATUSES.includes(value as WorkStatus) ? (value as WorkStatus) : null;
}

export type WorkProject = {
  work_status: string | null;
  due_on: string | null;
  delivered_on: string | null;
};

/** Quantos projetos em cada status; `sem_status` são os ainda não classificados. */
export function countByWorkStatus(projects: WorkProject[]) {
  const counts: Record<WorkStatus | "sem_status", number> = {
    em_andamento: 0,
    em_revisao: 0,
    concluido: 0,
    pausado: 0,
    sem_status: 0,
  };
  for (const project of projects) {
    counts[parseWorkStatus(project.work_status) ?? "sem_status"] += 1;
  }
  return counts;
}

/**
 * Parte das entregas feitas até o prazo, em %. Só conta quem foi concluído e tinha
 * prazo; sem nenhuma entrega assim, volta null em vez de um 0% que não aconteceu.
 */
export function onTimeRate(projects: WorkProject[]): { rate: number; total: number } | null {
  const delivered = projects.filter(
    (project) =>
      parseWorkStatus(project.work_status) === "concluido" &&
      project.due_on &&
      project.delivered_on,
  );
  if (delivered.length === 0) return null;
  const onTime = delivered.filter((project) => project.delivered_on! <= project.due_on!).length;
  return { rate: Math.round((onTime / delivered.length) * 100), total: delivered.length };
}

/** Prazo em aberto e já vencido. Concluído e pausado não cobram prazo. */
export function isWorkOverdue(project: WorkProject, today: string) {
  const status = parseWorkStatus(project.work_status);
  if (status === "concluido" || status === "pausado") return false;
  return Boolean(project.due_on && project.due_on < today);
}

/** Entrega pendente dentro dos próximos `days` dias, ou já atrasada. */
export function isDueSoon(project: WorkProject, today: string, days = 7) {
  const status = parseWorkStatus(project.work_status);
  if (!project.due_on || status === "concluido" || status === "pausado") return false;
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + days);
  return project.due_on <= limit.toISOString().slice(0, 10);
}

/**
 * Rascunho de proposta para prospecção também é uma linha em `projects`, mas não é
 * trabalho em andamento: fica na tela de Propostas, fora das contas da Início. Projeto
 * arquivado também sai; continua na busca do topo, de onde dá para desarquivar.
 */
export function isTrackedProject(project: { title: string; status: string }) {
  if (project.status === "archived") return false;
  return !(project.title.startsWith("Proposta — ") && project.status === "draft");
}

/** Ordem da lista: o que está em produção, depois o resto, concluídos por último. */
export function workRank(project: WorkProject & { contract_amount?: number | string | null }) {
  const status = parseWorkStatus(project.work_status);
  if (status === "em_andamento" || status === "em_revisao") return 0;
  if (status === "pausado") return 1;
  if (status === "concluido") return 3;
  return project.contract_amount != null ? 1 : 2;
}

/** "hoje", "ontem", "há 5 dias"; depois de um mês, a data. */
export function relativeDay(date: string, today: string) {
  const toUtc = (value: string) =>
    Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)));
  const days = Math.round((toUtc(today) - toUtc(date)) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days <= 30) return `há ${days} dias`;
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

/**
 * Data de entrega ao mudar o status: concluir registra o dia (sem apagar uma data
 * já informada) e sair de concluído limpa, porque o projeto voltou a andar.
 */
export function nextDeliveredOn(
  status: WorkStatus | null,
  current: string | null,
  today: string,
): string | null {
  if (status === "concluido") return current ?? today;
  return null;
}
