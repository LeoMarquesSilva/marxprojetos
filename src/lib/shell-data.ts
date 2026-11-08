import "server-only";

import { requireAuthenticatedUser } from "@/lib/supabase/require-authenticated-user";
import { getBrasiliaStoredDayStart } from "@/lib/crm-rules";
import { loadFinanceData } from "@/lib/finance-page-data";
import { sumCharges } from "@/lib/finance";
import { isWorkOverdue } from "@/lib/project-work";
import type { SearchResult, ShellAlert } from "@/lib/shell-types";
import { formatBrl } from "@/lib/subscription-billing";

/** Tira o que quebraria o filtro do PostgREST; o termo só serve para ilike. */
function searchTerm(raw: string) {
  return raw.replace(/[%_,()*\\]/g, " ").trim().slice(0, 80);
}

/** Busca do topo: projetos, clientes do CRM e propostas pelo nome. */
export async function searchEverything(raw: string): Promise<SearchResult[]> {
  const { supabase } = await requireAuthenticatedUser();
  const term = searchTerm(raw);
  if (term.length < 2) return [];
  const like = `%${term}%`;

  const [projects, clients, proposals] = await Promise.all([
    supabase
      .from("projects")
      .select("id, title, client_name")
      .or(`title.ilike.${like},client_name.ilike.${like},client_company.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("crm_clients")
      .select("id, name, company")
      .or(`name.ilike.${like},company.ilike.${like}`)
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("proposals")
      .select("id, title, client_name")
      .or(`title.ilike.${like},client_name.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  return [
    ...(projects.data ?? []).map((item) => ({
      id: `projeto:${item.id}`,
      kind: "Projeto" as const,
      title: item.title as string,
      detail: item.client_name as string | null,
      href: `/projects/${item.id}`,
    })),
    ...(clients.data ?? []).map((item) => ({
      id: `cliente:${item.id}`,
      kind: "Cliente" as const,
      title: item.name as string,
      detail: item.company as string | null,
      href: `/crm/${item.id}`,
    })),
    ...(proposals.data ?? []).map((item) => ({
      id: `proposta:${item.id}`,
      kind: "Proposta" as const,
      title: item.title as string,
      detail: item.client_name as string | null,
      href: `/propostas/${item.id}`,
    })),
  ];
}

/**
 * O sino: tudo calculado do que já existe, sem tabela de notificações. Só entra o
 * que pede uma ação agora.
 */
export async function getShellAlerts(): Promise<ShellAlert[]> {
  const { supabase } = await requireAuthenticatedUser();
  const dayStart = getBrasiliaStoredDayStart();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [finance, unread, steps, projects, responses] = await Promise.all([
    loadFinanceData(),
    supabase
      .from("crm_whatsapp_chats")
      .select("remote_jid", { count: "exact", head: true })
      .gt("unread_count", 0),
    supabase
      .from("crm_clients")
      .select("id, name, next_step", { count: "exact" })
      .not("next_step", "is", null)
      .lt("next_step_at", dayStart)
      .neq("stage", "perdido")
      .order("next_step_at", { ascending: true })
      .limit(3),
    supabase
      .from("projects")
      .select("id, title, work_status, due_on, delivered_on")
      .neq("status", "archived"),
    supabase
      .from("projects")
      .select("id, title, client_name")
      .neq("status", "archived")
      .gte("submitted_at", weekAgo)
      .order("submitted_at", { ascending: false })
      .limit(3),
  ]);

  const alerts: ShellAlert[] = [];
  const lateCharges = finance.charges.filter((charge) => charge.timing === "atrasado");
  const lateBills = finance.bills.filter((bill) => bill.timing === "atrasado");

  if (lateCharges.length > 0) {
    alerts.push({
      id: "receber-atrasado",
      tone: "late",
      title: `${formatBrl(sumCharges(lateCharges))} a receber em atraso`,
      detail: [...new Set(lateCharges.map((charge) => charge.clientName))].slice(0, 2).join(", "),
      href: "/financas",
    });
  }
  if (lateBills.length > 0) {
    alerts.push({
      id: "pagar-atrasado",
      tone: "late",
      title: `${formatBrl(sumCharges(lateBills))} vencido a pagar`,
      detail: [...new Set(lateBills.map((bill) => bill.description))].slice(0, 2).join(", "),
      href: "/financas",
    });
  }
  for (const project of (projects.data ?? []).filter((item) =>
    isWorkOverdue(item, finance.today),
  )) {
    alerts.push({
      id: `prazo:${project.id}`,
      tone: "late",
      title: `Prazo vencido: ${project.title}`,
      detail: `era ${String(project.due_on).slice(8, 10)}/${String(project.due_on).slice(5, 7)}`,
      href: `/projects/${project.id}`,
    });
  }
  for (const client of steps.data ?? []) {
    alerts.push({
      id: `passo:${client.id}`,
      tone: "late",
      title: `Próximo passo atrasado: ${client.name}`,
      detail: client.next_step as string,
      href: `/crm/${client.id}`,
    });
  }
  if ((unread.count ?? 0) > 0) {
    alerts.push({
      id: "conversas",
      tone: "info",
      title:
        unread.count === 1 ? "1 conversa não lida" : `${unread.count} conversas não lidas`,
      detail: "WhatsApp",
      href: "/crm?view=conversas&filter=unread",
    });
  }
  for (const project of responses.data ?? []) {
    alerts.push({
      id: `briefing:${project.id}`,
      tone: "info",
      title: `Briefing respondido: ${project.client_name || project.title}`,
      detail: "nos últimos 7 dias",
      href: `/projects/${project.id}`,
    });
  }

  return alerts;
}
