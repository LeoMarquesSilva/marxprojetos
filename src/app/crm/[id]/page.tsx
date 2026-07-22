import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Building2, Mail, Phone, Tag } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { CrmStageSelect } from "@/components/crm-stage-select";
import { CrmLinkBriefing } from "@/components/crm-link-briefing";
import { CrmTasks } from "@/components/crm-tasks";
import { CrmNotes } from "@/components/crm-notes";
import { CrmDeleteClientButton } from "@/components/crm-delete-client-button";
import { CrmEditClientSheet } from "@/components/crm-edit-client-sheet";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getCrmClient, getLinkableProjects } from "@/app/actions/crm";
import { createClient } from "@/lib/supabase/server";

export default async function CrmClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { client, tasks, notes } = await getCrmClient(id);
  if (!client) notFound();

  const linkableProjects = await getLinkableProjects(client.project_id);
  const currentProjectTitle =
    linkableProjects.find((p) => p.id === client.project_id)?.title ?? null;

  return (
    <AdminShell userEmail={user?.email}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <Link
              href="/crm"
              className={buttonVariants({
                variant: "ghost",
                size: "sm",
                className: "-ml-2",
              })}
            >
              <ArrowLeft className="size-4" />
              Voltar
            </Link>
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-[var(--insyt-black)]">
                {client.name}
              </h1>
              <p className="mt-1 text-sm text-[var(--insyt-muted)]">
                Cliente desde{" "}
                {format(new Date(client.created_at), "d MMM yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CrmStageSelect clientId={client.id} currentStage={client.stage} />
            <CrmEditClientSheet client={client} />
            <CrmDeleteClientButton clientId={client.id} />
          </div>
        </div>

        {client.stage === "perdido" ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {client.lost_reason ? (
              <p>
                <span className="font-semibold">Motivo da perda:</span> {client.lost_reason}
              </p>
            ) : (
              <p>
                Este cliente foi marcado como perdido. Considere registrar o motivo em{" "}
                <span className="font-semibold">Editar</span> para ajudar a entender o
                pipeline no futuro.
              </p>
            )}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="insyt-card border-none shadow-none lg:col-span-1 lg:sticky lg:top-8 lg:h-fit">
            <CardHeader>
              <CardTitle>Contato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {client.company ? (
                <p className="flex items-center gap-2 text-[var(--insyt-black)]">
                  <Building2 className="size-4 text-[var(--insyt-muted)]" />
                  {client.company}
                </p>
              ) : null}
              {client.email ? (
                <p className="flex items-center gap-2 text-[var(--insyt-black)]">
                  <Mail className="size-4 text-[var(--insyt-muted)]" />
                  {client.email}
                </p>
              ) : null}
              {client.phone ? (
                <p className="flex items-center gap-2 text-[var(--insyt-black)]">
                  <Phone className="size-4 text-[var(--insyt-muted)]" />
                  {client.phone}
                </p>
              ) : null}
              {client.source ? (
                <p className="flex items-center gap-2 text-[var(--insyt-black)]">
                  <Tag className="size-4 text-[var(--insyt-muted)]" />
                  {client.source}
                </p>
              ) : null}
              {!client.company && !client.email && !client.phone && !client.source ? (
                <p className="text-[var(--insyt-muted)]">Sem informações adicionais.</p>
              ) : null}
            </CardContent>
          </Card>

          <div className="space-y-6 lg:col-span-2">
            <Card className="insyt-card border-none shadow-none">
              <CardHeader>
                <CardTitle>Briefing vinculado</CardTitle>
                <CardDescription>
                  Vincule um briefing já enviado a este cliente, quando houver.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CrmLinkBriefing
                  clientId={client.id}
                  currentProjectId={client.project_id}
                  currentProjectTitle={currentProjectTitle}
                  linkableProjects={linkableProjects}
                />
              </CardContent>
            </Card>

            <Card className="insyt-card border-none shadow-none">
              <CardHeader>
                <CardTitle>Tarefas</CardTitle>
                <CardDescription>Follow-ups e lembretes para este cliente.</CardDescription>
              </CardHeader>
              <CardContent>
                <CrmTasks clientId={client.id} initialTasks={tasks} />
              </CardContent>
            </Card>

            <Card className="insyt-card border-none shadow-none">
              <CardHeader>
                <CardTitle>Histórico</CardTitle>
                <CardDescription>Ligações, reuniões e observações.</CardDescription>
              </CardHeader>
              <CardContent>
                <CrmNotes clientId={client.id} initialNotes={notes} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
