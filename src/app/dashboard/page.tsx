import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  LayoutDashboard,
  Plus,
  Users,
  Wallet,
} from "lucide-react";
import type { ComponentType } from "react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageHeader } from "@/components/admin-page-header";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProjects } from "@/app/actions/projects";
import { getCrmClients } from "@/app/actions/crm";
import { createClient } from "@/lib/supabase/server";
import type { ProjectStatus } from "@/types/briefing";
import { cn } from "@/lib/utils";
import { displayNameFromEmail, getTimeGreeting } from "@/lib/greeting";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [projects, crmClients] = await Promise.all([getProjects(), getCrmClients()]);

  const stats = {
    total: projects.length,
    submitted: projects.filter((p) => p.status === "submitted").length,
    pending: projects.filter((p) =>
      ["sent", "in_progress"].includes(p.status),
    ).length,
  };
  const responseRate =
    stats.total > 0 ? Math.round((stats.submitted / stats.total) * 100) : 0;
  const today = format(new Date(), "dd MMM yyyy", { locale: ptBR });
  const userName = displayNameFromEmail(user?.email);

  const crmStats = {
    active: crmClients.filter((c) => c.stage !== "fechado" && c.stage !== "perdido")
      .length,
    openValue: crmClients
      .filter((c) => c.stage !== "fechado" && c.stage !== "perdido")
      .reduce((sum, c) => sum + (c.value ?? 0), 0),
    closed: crmClients.filter((c) => c.stage === "fechado").length,
  };

  return (
    <AdminShell userEmail={user?.email}>
      <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-fluid">
        <AdminPageHeader
          icon={LayoutDashboard}
          title={`${getTimeGreeting()}, ${userName}`}
          description={`INSYT Briefings · ${today}`}
          activeHref="/dashboard"
          quickLinks={[
            { href: "/dashboard", label: "Briefings", icon: LayoutDashboard },
            { href: "/projects/new", label: "Novo briefing", icon: Plus },
          ]}
          actions={
            <Link
              href="/projects/new"
              className={cn(
                buttonVariants({ size: "lg" }),
                "rounded-full px-6 py-5 text-sm shadow-lg shadow-[var(--insyt-primary)]/25 transition-all duration-500 ease-fluid hover:scale-[1.02] hover:shadow-xl hover:shadow-[var(--insyt-primary)]/35 group",
              )}
            >
              Novo briefing
              <div className="ml-2 flex size-7 items-center justify-center rounded-full bg-white/20 transition-transform duration-500 ease-fluid group-hover:translate-x-0.5 group-hover:scale-110">
                <Plus className="size-3.5" />
              </div>
            </Link>
          }
        />

        {/* Asymmetrical Bento Grid */}
        <div className="grid gap-6 md:grid-cols-12 md:grid-rows-2">
          <div className="md:col-span-8 md:row-span-2">
            <StatCard
              label="Projetos aguardando resposta"
              value={stats.pending}
              icon={Clock3}
              accent
              large
            />
          </div>
          <div className="md:col-span-4 md:row-span-1">
            <StatCard
              label="Total de projetos"
              value={stats.total}
              icon={ClipboardCheck}
            />
          </div>
          <div className="md:col-span-4 md:row-span-1">
            <StatCard
              label="Taxa de resposta"
              value={`${responseRate}%`}
              icon={ArrowUpRight}
            />
          </div>
        </div>

        {/* CRM summary */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-[var(--insyt-black)]">CRM</h2>
            <Link
              href="/crm"
              className="text-sm font-medium text-[var(--insyt-primary)] hover:underline"
            >
              Ver pipeline completo
            </Link>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <StatCard label="Leads ativos" value={crmStats.active} icon={Users} />
            <StatCard
              label="Pipeline em aberto"
              value={currencyFormatter.format(crmStats.openValue)}
              icon={Wallet}
            />
            <StatCard label="Clientes fechados" value={crmStats.closed} icon={CheckCircle2} />
          </div>
        </div>

        {/* Table Card */}
        <div className="insyt-card overflow-hidden">
            <div className="border-b border-[var(--insyt-border)] px-8 py-6">
              <h2 className="text-2xl font-bold tracking-tight text-[var(--insyt-black)]">Projetos recentes</h2>
              <p className="mt-1 text-sm text-[var(--insyt-slate)]">
                Clique em um projeto para ver respostas e copiar o link do cliente.
              </p>
            </div>
            <div className="p-0 bg-white">
              {projects.length === 0 ? (
                <div className="px-6 py-24 text-center">
                  <p className="text-lg text-[var(--insyt-slate)]">
                    Nenhum briefing criado ainda.
                  </p>
                  <Link
                    href="/projects/new"
                    className={cn(buttonVariants({ variant: "outline" }), "mt-6 rounded-full px-6")}
                  >
                    Criar primeiro briefing
                  </Link>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-[var(--insyt-border)]">
                      <TableHead className="pl-8">Projeto</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado</TableHead>
                      <TableHead>Atualização</TableHead>
                      <TableHead className="w-10 pr-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((project) => (
                      <TableRow key={project.id} className="group border-[var(--insyt-border)] transition-colors hover:bg-[var(--insyt-canvas-alt)]/50">
                        <TableCell className="pl-8 py-5">
                          <Link
                            href={`/projects/${project.id}`}
                            className="font-semibold text-[var(--insyt-black)] transition-colors group-hover:text-[var(--insyt-primary)]"
                          >
                            {project.title}
                          </Link>
                        </TableCell>
                        <TableCell className="py-5 text-[var(--insyt-slate)]">
                          {project.client_name || "—"}
                        </TableCell>
                        <TableCell className="py-5">
                          <StatusBadge status={project.status as ProjectStatus} />
                        </TableCell>
                        <TableCell className="py-5 text-[var(--insyt-muted)]">
                          {format(new Date(project.created_at), "d MMM yyyy", {
                            locale: ptBR,
                          })}
                        </TableCell>
                        <TableCell className="py-5 text-[var(--insyt-muted)]">
                          {project.submitted_at
                            ? format(new Date(project.submitted_at), "d MMM yyyy", {
                                locale: ptBR,
                              })
                            : "Sem resposta"}
                        </TableCell>
                        <TableCell className="pr-8 py-5">
                          <Link
                            href={`/projects/${project.id}`}
                            className="inline-flex items-center justify-center size-8 rounded-full bg-[var(--insyt-canvas)] text-[var(--insyt-muted)] transition-all duration-300 ease-fluid group-hover:bg-[var(--insyt-primary)] group-hover:text-white group-hover:scale-110"
                          >
                            <ArrowUpRight className="size-4" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
        </div>
      </div>
    </AdminShell>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent = false,
  large = false,
}: {
  label: string;
  value: number | string;
  icon: ComponentType<{ className?: string }>;
  accent?: boolean;
  large?: boolean;
}) {
  return (
    <div
      className={cn(
        "insyt-card flex h-full flex-col",
        large ? "p-8 sm:p-12" : "p-6 sm:p-8",
      )}
    >
        <div className="flex flex-1 flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className={cn(
              "inline-flex items-center justify-center rounded-2xl",
              accent ? "bg-[var(--insyt-primary)]/10 text-[var(--insyt-primary)]" : "bg-[var(--insyt-canvas-alt)] text-[var(--insyt-slate)]",
              large ? "size-14" : "size-12"
            )}>
              <Icon className={cn(large ? "size-6" : "size-5")} />
            </span>
          </div>
          
          <div className="mt-8">
            <p className="text-sm font-medium text-[var(--insyt-muted)] uppercase tracking-wider">{label}</p>
            <p className={cn(
              "mt-3 font-bold tracking-tighter text-[var(--insyt-black)]",
              large ? "text-6xl sm:text-8xl" : "text-4xl sm:text-5xl"
            )}>
              {value}
            </p>
          </div>
        </div>
    </div>
  );
}
