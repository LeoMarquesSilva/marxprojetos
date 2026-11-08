import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Eye,
  FolderKanban,
  Globe,
  KeyRound,
  MessageSquareText,
  PackageCheck,
  PanelTop,
  PenLine,
  Plus,
  ShoppingBag,
  Target,
  Wallet,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";
import { MoneyColumns } from "@/components/charts/money-columns";
import { StatusDonut } from "@/components/charts/status-donut";
import { FinanceEntrySheet } from "@/components/finance-entry-sheet";
import { BillSettle, ChargeSettle, InstallmentSettle } from "@/components/finance-settle";
import { HomeTaskCheck } from "@/components/home-task-check";
import { ProjectWorkControls } from "@/components/project-work-controls";
import { buttonVariants } from "@/components/ui/button";
import { displayNameFromEmail, getTimeGreeting } from "@/lib/greeting";
import {
  loadHomeData,
  type HomeActivity,
  type HomeMoneyItem,
  type HomeProject,
} from "@/lib/home-data";
import { parseWorkStatus, relativeDay, WORK_STATUS_LABELS, type WorkStatus } from "@/lib/project-work";
import { dueLabel, formatBrl } from "@/lib/subscription-billing";
import { requireAuthenticatedUser } from "@/lib/supabase/require-authenticated-user";
import { cn } from "@/lib/utils";
import type { FinanceProjectOption } from "@/types/finance";
import { STATUS_LABELS } from "@/types/briefing";

const PAGE_SIZE = 5;

const TABS = [
  { key: "projetos", label: "Projetos", icon: FolderKanban },
  { key: "briefings", label: "Briefings em aberto", icon: ClipboardCheck },
  { key: "entregas", label: "Entregas da semana", icon: CalendarDays },
  { key: "financeiro", label: "Financeiro", icon: Wallet },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/** Cores validadas para daltonismo; "sem status" é o neutro, fora da sequência. */
const STATUS_COLORS: Record<WorkStatus | "sem_status", string> = {
  em_andamento: "#f74211",
  em_revisao: "#f59e0b",
  concluido: "#17876b",
  pausado: "#6a63b8",
  sem_status: "#e3d9cf",
};

const ACTIVITY_ICONS: Record<HomeActivity["kind"], ComponentType<{ className?: string }>> = {
  pagamento: CircleDollarSign,
  briefing: ClipboardCheck,
  entrega: CheckCircle2,
  comentario: MessageSquareText,
};

/** O tipo de trabalho sai do título: é como os projetos já são nomeados. */
function projectIcon(title: string): ComponentType<{ className?: string }> {
  const name = title.toLowerCase();
  if (name.includes("loja")) return ShoppingBag;
  if (name.includes("landing")) return PanelTop;
  if (name.includes("conteúdo") || name.includes("post")) return PenLine;
  if (name.includes("acesso")) return KeyRound;
  if (name.includes("site")) return Globe;
  return FolderKanban;
}

function dayMonth(date: string) {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; pagina?: string; status?: string }>;
}) {
  const params = await searchParams;
  const { user } = await requireAuthenticatedUser();
  const data = await loadHomeData();

  const tab: TabKey = TABS.some((item) => item.key === params.aba)
    ? (params.aba as TabKey)
    : "projetos";
  const statusFilter =
    params.status === "sem_status" ? "sem_status" : parseWorkStatus(params.status);

  const firstName = displayNameFromEmail(user.email).split(" ")[0];
  const todayLabel = capitalize(
    format(new Date(`${data.today}T12:00:00`), "EEEE, d 'de' MMMM", { locale: ptBR }),
  );

  // A frase do dia: só o que existe agora, com o que está atrasado na frente.
  const statusLine = [
    data.lateReceive > 0
      ? { text: `${formatBrl(data.lateReceive)} a receber em atraso`, late: true, href: "/financas" }
      : null,
    data.latePay > 0
      ? { text: `${formatBrl(data.latePay)} vencido a pagar`, late: true, href: "/financas" }
      : null,
    data.dueThisWeek > 0
      ? { text: `${formatBrl(data.dueThisWeek)} a receber em 7 dias`, late: false, href: "/financas" }
      : null,
    data.unread > 0
      ? {
          text: `${data.unread} ${data.unread === 1 ? "conversa não lida" : "conversas não lidas"}`,
          late: false,
          href: "/crm?view=conversas&filter=unread",
        }
      : null,
  ].filter((item) => item !== null);

  const listed =
    tab === "briefings"
      ? data.openBriefings
      : tab === "entregas"
        ? data.deliveries
        : statusFilter
          ? data.rankedProjects.filter(
              (project) =>
                (parseWorkStatus(project.work_status) ?? "sem_status") === statusFilter,
            )
          : data.rankedProjects;
  const totalItems = tab === "financeiro" ? data.openItems.length : listed.length;
  const pageCount = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const page = Math.min(pageCount, Math.max(1, Number(params.pagina) || 1));
  const pageStart = (page - 1) * PAGE_SIZE;

  function hrefFor(next: { aba?: TabKey; pagina?: number; status?: string | null }) {
    const search = new URLSearchParams();
    const nextTab = next.aba ?? tab;
    if (nextTab !== "projetos") search.set("aba", nextTab);
    const nextStatus = next.status === undefined ? statusFilter : next.status;
    if (nextTab === "projetos" && nextStatus) search.set("status", nextStatus);
    if (next.pagina && next.pagina > 1) search.set("pagina", String(next.pagina));
    const query = search.toString();
    return `/dashboard${query ? `?${query}` : ""}#lista`;
  }

  return (
    <AdminShell userEmail={user.email}>
      <div className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1 basis-96">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--insyt-black)] sm:text-[1.75rem] sm:leading-9">
              {getTimeGreeting()}, {firstName}
            </h1>
            <p className="mt-0.5 text-sm text-[var(--insyt-slate)]">{todayLabel}</p>
            {statusLine.length > 0 ? (
              <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {statusLine.map((item) => (
                  <li key={item.text}>
                    <Link
                      href={item.href}
                      className={cn(
                        "hover:underline",
                        item.late
                          ? "font-semibold text-red-700"
                          : "font-medium text-[var(--insyt-black)]",
                      )}
                    >
                      {item.text}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <Link href="/projects/new" className={buttonVariants()}>
            <Plus className="size-4" />
            Novo briefing
          </Link>
        </header>

        <section
          aria-label="Números principais"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
              <KpiCard
                highlight
                icon={FolderKanban}
                value={String(data.counts.em_andamento)}
                label="Projetos em andamento"
                hint={
                  data.counts.em_revisao > 0
                    ? `+ ${data.counts.em_revisao} em revisão`
                    : `${data.counts.sem_status} ainda sem status`
                }
                href={hrefFor({ aba: "projetos", status: "em_andamento" })}
              />
              <KpiCard
                icon={PackageCheck}
                value={String(data.counts.concluido)}
                label="Projetos concluídos"
                hint={
                  data.deliveredThisMonth > 0
                    ? `${data.deliveredThisMonth} este mês`
                    : "nenhum este mês"
                }
                href={hrefFor({ aba: "projetos", status: "concluido" })}
              />
              <KpiCard
                icon={Wallet}
                value={formatBrl(data.income)}
                label="Receitas do mês"
                hint={
                  data.toReceive > 0
                    ? `+ ${formatBrl(data.toReceive)} a receber`
                    : "nada mais a receber"
                }
                href="/financas"
              />
              <KpiCard
                icon={Target}
                value={data.onTime ? `${data.onTime.rate}%` : "—"}
                label="Entrega no prazo"
                hint={
                  data.onTime
                    ? `em ${data.onTime.total} ${data.onTime.total === 1 ? "entrega" : "entregas"} com prazo`
                    : "na 1ª entrega com prazo"
                }
              />
        </section>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="min-w-0 space-y-5">
            <div className="grid items-stretch gap-5 lg:grid-cols-2">
              <Card title="Projetos por status" className="flex flex-col">
                <StatusDonut
                  totalLabel="projetos"
                  parts={(
                    ["em_andamento", "em_revisao", "concluido", "pausado", "sem_status"] as const
                  ).map((key) => ({
                    key,
                    label: key === "sem_status" ? "Sem status" : WORK_STATUS_LABELS[key],
                    value: data.counts[key],
                    color: STATUS_COLORS[key],
                    href: hrefFor({ aba: "projetos", status: key }),
                  }))}
                />
              </Card>
              <Card
                title="Receitas e despesas"
                action={
                  <Link
                    href="/financas"
                    className="text-xs font-semibold text-[var(--insyt-primary-dark)] hover:underline"
                  >
                    Abrir Finanças
                  </Link>
                }
              >
                <MoneyColumns columns={data.moneyMonths} currentMonth={data.currentMonth} />
              </Card>
            </div>

            <section id="lista" className="scroll-mt-20 space-y-3">
              <nav
                aria-label="Listas"
                className="flex gap-1 overflow-x-auto border-b border-[var(--insyt-border)] [scrollbar-width:none]"
              >
                {TABS.map(({ key, label, icon: Icon }) => (
                  <Link
                    key={key}
                    href={hrefFor({ aba: key, status: null })}
                    aria-current={tab === key ? "page" : undefined}
                    className={cn(
                      "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                      tab === key
                        ? "border-[var(--insyt-primary)] text-[var(--insyt-primary-dark)]"
                        : "border-transparent text-[var(--insyt-slate)] hover:text-[var(--insyt-black)]",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {label}
                  </Link>
                ))}
              </nav>

              <div className="insyt-card overflow-hidden">
                {tab === "projetos" && statusFilter ? (
                  <div className="flex items-center justify-between gap-3 border-b border-[var(--insyt-border)] px-5 py-2.5 text-xs text-[var(--insyt-slate)]">
                    <span>
                      Só{" "}
                      <strong className="font-semibold">
                        {statusFilter === "sem_status"
                          ? "sem status"
                          : WORK_STATUS_LABELS[statusFilter].toLowerCase()}
                      </strong>
                    </span>
                    <Link
                      href={hrefFor({ status: null })}
                      className="font-semibold text-[var(--insyt-primary-dark)] hover:underline"
                    >
                      Ver todos
                    </Link>
                  </div>
                ) : null}

                {tab === "financeiro" ? (
                  <MoneyList
                    items={data.openItems.slice(pageStart, pageStart + PAGE_SIZE)}
                    projects={data.projectOptions}
                    today={data.today}
                  />
                ) : (
                  <ProjectsTable
                    projects={listed.slice(pageStart, pageStart + PAGE_SIZE)}
                    today={data.today}
                    empty={
                      tab === "entregas"
                        ? "Nenhuma entrega nos próximos 7 dias. Defina o prazo de cada projeto na aba Projetos."
                        : tab === "briefings"
                          ? "Nenhum briefing esperando resposta do cliente."
                          : "Nenhum projeto nesse filtro."
                    }
                  />
                )}

                {totalItems > PAGE_SIZE ? (
                  <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--insyt-border)] px-5 py-3">
                    <p className="text-xs text-[var(--insyt-slate)]">
                      Mostrando {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, totalItems)} de{" "}
                      {totalItems}
                    </p>
                    <div className="flex items-center gap-1">
                      <PageLink
                        href={hrefFor({ pagina: page - 1 })}
                        disabled={page <= 1}
                        label="Página anterior"
                      >
                        <ChevronLeft className="size-4" />
                      </PageLink>
                      <span className="px-2 text-xs font-semibold tabular-nums text-[var(--insyt-black)]">
                        {page} de {pageCount}
                      </span>
                      <PageLink
                        href={hrefFor({ pagina: page + 1 })}
                        disabled={page >= pageCount}
                        label="Próxima página"
                      >
                        <ChevronRight className="size-4" />
                      </PageLink>
                    </div>
                  </footer>
                ) : null}
              </div>
            </section>
          </div>

          <aside className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
            <Card
              title={
                <span className="flex items-center gap-2">
                  Minhas tarefas
                  {data.taskTotal > 0 ? (
                    <span className="rounded-full bg-[var(--insyt-tint)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--insyt-primary-dark)]">
                      {data.taskTotal}
                    </span>
                  ) : null}
                </span>
              }
            >
              {data.tasks.length === 0 ? (
                <p className="text-sm text-[var(--insyt-muted)]">
                  Nenhum próximo passo marcado. Eles nascem na ficha de cada cliente no CRM.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--insyt-border)]">
                  {data.tasks.map((task) => {
                    const late = Boolean(task.date && task.date < data.today);
                    const isToday = task.date === data.today;
                    return (
                      <li key={task.id} className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
                        {task.kind === "passo" ? (
                          <HomeTaskCheck
                            clientId={task.id}
                            clientName={task.clientName ?? task.detail}
                            step={task.title}
                            date={task.date}
                          />
                        ) : (
                          <PackageCheck className="mt-0.5 size-[18px] shrink-0 text-[var(--insyt-primary)]" />
                        )}
                        <Link href={task.href} className="group min-w-0 flex-1">
                          <span className="line-clamp-2 text-[13px] font-medium leading-snug text-[var(--insyt-black)] group-hover:text-[var(--insyt-primary-dark)]">
                            {task.title}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-[var(--insyt-muted)]">
                            {task.detail}
                          </span>
                        </Link>
                        {task.date ? (
                          <span
                            className={cn(
                              "shrink-0 text-xs font-medium tabular-nums",
                              late
                                ? "text-red-700"
                                : isToday
                                  ? "text-[var(--insyt-primary-dark)]"
                                  : "text-[var(--insyt-slate)]",
                            )}
                          >
                            {isToday ? "Hoje" : dayMonth(task.date)}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card title="Atividades recentes">
              {data.activities.length === 0 ? (
                <p className="text-sm text-[var(--insyt-muted)]">
                  Pagamentos, respostas de briefing e comentários aparecem aqui.
                </p>
              ) : (
                <ul className="space-y-3.5">
                  {data.activities.map((activity) => {
                    const Icon = ACTIVITY_ICONS[activity.kind];
                    return (
                      <li key={activity.id}>
                        <Link href={activity.href} className="group flex gap-3">
                          <span
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-full",
                              activity.kind === "entrega" || activity.kind === "pagamento"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-[var(--insyt-tint)] text-[var(--insyt-primary-dark)]",
                            )}
                          >
                            <Icon className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-[13px] leading-snug text-[var(--insyt-black)] group-hover:text-[var(--insyt-primary-dark)]">
                              {activity.title}
                            </span>
                            <span className="mt-0.5 block text-xs text-[var(--insyt-muted)]">
                              {relativeDay(activity.date, data.today)}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card title="Comercial" className="sm:col-span-2 xl:col-span-1">
              <ul className="space-y-2.5 text-sm">
                <CommercialRow
                  href="/crm?view=conversas&filter=unread"
                  label="Conversas não lidas"
                  value={String(data.unread)}
                />
                <CommercialRow href="/crm" label="Leads ativos" value={String(data.activeLeads)} />
                <CommercialRow
                  href="/crm"
                  label="Pipeline em aberto"
                  value={formatBrl(data.pipeline)}
                />
                <CommercialRow
                  href="/crm"
                  label="Clientes fechados"
                  value={String(data.closedClients)}
                />
              </ul>
            </Card>
          </aside>
        </div>
      </div>
    </AdminShell>
  );
}

function Card({
  title,
  action,
  className,
  children,
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("insyt-card min-w-0 p-5", className)}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-bold tracking-tight text-[var(--insyt-black)]">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function KpiCard({
  icon: Icon,
  value,
  label,
  hint,
  href,
  highlight = false,
}: {
  icon: ComponentType<{ className?: string }>;
  value: string;
  label: string;
  hint: string;
  href?: string;
  highlight?: boolean;
}) {
  const body = (
    <>
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl",
          highlight
            ? "bg-[var(--insyt-primary)] text-white"
            : "bg-[var(--insyt-tint)] text-[var(--insyt-primary-dark)]",
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block whitespace-nowrap font-[family-name:var(--font-heading)] text-[1.625rem] font-bold leading-8 tracking-tight text-[var(--insyt-black)] xl:text-[1.375rem] 2xl:text-[1.625rem]">
          {value}
        </span>
        <span className="block text-[13px] leading-snug text-[var(--insyt-slate)]">{label}</span>
        <span className="mt-1 block text-xs text-[var(--insyt-muted)]">{hint}</span>
      </span>
    </>
  );
  const className = cn(
    "insyt-card flex items-start gap-3.5 p-4 transition-colors duration-150",
    highlight && "!bg-[var(--insyt-tint)]",
    href && "hover:!bg-[var(--insyt-tint)]",
  );
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function CommercialRow({ href, label, value }: { href: string; label: string; value: string }) {
  return (
    <li>
      <Link href={href} className="group flex items-baseline justify-between gap-3">
        <span className="text-[var(--insyt-slate)] group-hover:text-[var(--insyt-primary-dark)]">
          {label}
        </span>
        <span className="font-semibold tabular-nums text-[var(--insyt-black)]">{value}</span>
      </Link>
    </li>
  );
}

function ProjectsTable({
  projects,
  today,
  empty,
}: {
  projects: HomeProject[];
  today: string;
  empty: string;
}) {
  if (projects.length === 0) {
    return <p className="px-5 py-10 text-sm text-[var(--insyt-muted)]">{empty}</p>;
  }
  return (
    <>
    {/* No celular, cada projeto vira um bloco: o nome inteiro vale mais que colunas. */}
    <ul className="divide-y divide-[var(--insyt-border)] sm:hidden">
      {projects.map((project) => {
        const Icon = projectIcon(project.title);
        return (
          <li key={project.id} className="space-y-2.5 px-4 py-3.5">
            <Link href={`/projects/${project.id}`} className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--insyt-tint)] text-[var(--insyt-primary-dark)]">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold leading-snug text-[var(--insyt-black)]">
                  {project.title}
                </span>
                <span className="block text-xs text-[var(--insyt-muted)]">
                  {project.client_name ? `${project.client_name} · ` : ""}
                  Briefing: {STATUS_LABELS[project.status].toLowerCase()}
                </span>
              </span>
              {project.contract_amount != null ? (
                <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--insyt-black)]">
                  {formatBrl(project.contract_amount)}
                </span>
              ) : null}
            </Link>
            <ProjectWorkControls
              layout="inline"
              projectId={project.id}
              projectTitle={project.title}
              workStatus={project.work_status}
              dueOn={project.due_on}
              today={today}
            />
          </li>
        );
      })}
    </ul>
    <div className="@container hidden overflow-x-auto sm:block">
      <table className="w-full min-w-[620px] table-fixed text-sm">
        <colgroup>
          <col />
          {/* Sem espaço, o cliente desce para a linha de baixo do projeto. */}
          <col className="hidden w-[9.5rem] @4xl:table-column" />
          <col className="w-[9.75rem]" />
          <col className="w-[8.5rem]" />
          <col className="w-[6.75rem]" />
          <col className="w-[5.5rem]" />
        </colgroup>
        <thead>
          <tr className="border-b border-[var(--insyt-border)] text-left text-xs font-semibold text-[var(--insyt-slate)]">
            <th scope="col" className="py-3 pl-5 pr-3 font-semibold">Projeto</th>
            <th scope="col" className="hidden px-3 py-3 font-semibold @4xl:table-cell">Cliente</th>
            <th scope="col" className="px-3 py-3 font-semibold">Status</th>
            <th scope="col" className="px-3 py-3 font-semibold">Prazo</th>
            <th scope="col" className="px-3 py-3 text-right font-semibold">Valor</th>
            <th scope="col" className="py-3 pl-3 pr-5 text-right font-semibold">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--insyt-border)]">
          {projects.map((project) => {
            const Icon = projectIcon(project.title);
            return (
            <tr key={project.id} className="transition-colors duration-150 hover:bg-[var(--insyt-canvas)]">
              <td className="py-3 pl-5 pr-3">
                <Link href={`/projects/${project.id}`} className="group flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--insyt-tint)] text-[var(--insyt-primary-dark)]">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-[var(--insyt-black)] group-hover:text-[var(--insyt-primary-dark)]">
                      {project.title}
                    </span>
                    <span className="block truncate text-xs text-[var(--insyt-muted)]">
                      {project.client_name ? (
                        <span className="@4xl:hidden">{project.client_name} · </span>
                      ) : null}
                      Briefing: {STATUS_LABELS[project.status].toLowerCase()}
                    </span>
                  </span>
                </Link>
              </td>
              <td className="hidden truncate px-3 py-3 text-[var(--insyt-slate)] @4xl:table-cell">
                {project.client_name || "—"}
              </td>
              <ProjectWorkControls
                projectId={project.id}
                projectTitle={project.title}
                workStatus={project.work_status}
                dueOn={project.due_on}
                today={today}
              />
              <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-[var(--insyt-black)]">
                {project.contract_amount != null ? formatBrl(project.contract_amount) : "—"}
              </td>
              <td className="py-3 pl-3 pr-5">
                <span className="flex items-center justify-end gap-0.5">
                  <IconLink href={`/projects/${project.id}`} label={`Ver ${project.title}`}>
                    <Eye className="size-4" />
                  </IconLink>
                  <IconLink href={`/sites/${project.id}`} label={`Revisão do site: ${project.title}`}>
                    <Globe className="size-4" />
                  </IconLink>
                </span>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

function MoneyList({
  items,
  projects,
  today,
}: {
  items: HomeMoneyItem[];
  projects: FinanceProjectOption[];
  today: string;
}) {
  if (items.length === 0) {
    return (
      <p className="px-5 py-10 text-sm text-[var(--insyt-muted)]">
        Nada a receber nem a pagar nos próximos 30 dias.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-[var(--insyt-border)]">
      {items.map((item) => {
        const due = dueLabel(item.dueOn, today);
        const incoming = item.kind === "entrada";
        return (
          <li
            key={item.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3 transition-colors duration-150 hover:bg-[var(--insyt-canvas)]"
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full",
                incoming ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600",
              )}
            >
              {incoming ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
            </span>
            <Link
              href={`/financas?mes=${item.dueOn.slice(0, 7)}`}
              className="group min-w-0 flex-1 basis-44"
            >
              <span className="block truncate text-sm font-semibold text-[var(--insyt-black)] group-hover:text-[var(--insyt-primary-dark)]">
                {item.title}
              </span>
              <span className={cn("block text-xs", due.late ? "text-red-700" : "text-[var(--insyt-muted)]")}>
                {due.text}
              </span>
            </Link>
            <span
              className={cn(
                "shrink-0 text-sm font-bold tabular-nums",
                due.late
                  ? "text-red-700"
                  : incoming
                    ? "text-emerald-800"
                    : "text-[var(--insyt-black)]",
              )}
            >
              {incoming ? "" : "−"}
              {formatBrl(item.amount)}
            </span>
            <span className="ml-auto flex w-24 shrink-0 justify-end">
              <MoneySettle item={item} projects={projects} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** A baixa na própria linha; o que vence em meses à frente fica para Finanças. */
function MoneySettle({
  item,
  projects,
}: {
  item: HomeMoneyItem;
  projects: FinanceProjectOption[];
}) {
  const { settle } = item;
  if (settle.type === "sociedade") {
    if (settle.option && item.timing !== "futuro") {
      return (
        <FinanceEntrySheet
          projects={projects}
          receiveProject={settle.option}
          defaultAmount={item.amount}
          triggerLabel="Recebi"
        />
      );
    }
    return (
      <Link
        href={`/financas/projetos#sociedade-${settle.projectId}`}
        className="px-2 text-xs font-semibold text-[var(--insyt-primary-dark)] hover:underline"
      >
        Ver
      </Link>
    );
  }
  if (item.timing === "futuro") return null;
  if (settle.type === "parcela") {
    return (
      <InstallmentSettle
        projectId={settle.projectId}
        projectTitle={settle.projectTitle}
        name={settle.name}
        amount={item.amount}
      />
    );
  }
  if (settle.type === "gasto") {
    return (
      <BillSettle
        expenseId={settle.expenseId}
        description={item.title}
        month={settle.month}
        amount={item.amount}
      />
    );
  }
  return (
    <ChargeSettle
      subscriptionId={settle.subscriptionId}
      clientName={item.title}
      month={settle.month}
      amount={item.amount}
      method={settle.method}
    />
  );
}

function IconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
    >
      {children}
    </Link>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: ReactNode;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), "opacity-40")}
      >
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={buttonVariants({ variant: "outline", size: "icon-sm" })}>
      {children}
    </Link>
  );
}
