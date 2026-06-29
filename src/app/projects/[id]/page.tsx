import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, FileText } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { CopyLinkButton } from "@/components/copy-link-button";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getProject } from "@/app/actions/projects";
import { createClient } from "@/lib/supabase/server";
import { formatAnswer, groupQuestionsBySection } from "@/lib/briefing-utils";
import type {
  BriefingQuestion,
  Project,
  ProjectStatus,
} from "@/types/briefing";
import { setProjectStatus } from "@/app/actions/status";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { project, submission } = await getProject(id);
  if (!project) notFound();

  const questions = project.questions as BriefingQuestion[];
  const sections = groupQuestionsBySection(questions);
  const answers = (submission?.answers ?? {}) as Record<string, unknown>;

  return (
    <AdminShell userEmail={user?.email}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2" })}
            >
              <ArrowLeft className="size-4" />
              Voltar
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-4xl font-bold tracking-tight text-[var(--insyt-black)]">
                  {project.title}
                </h1>
                <StatusBadge status={project.status as ProjectStatus} />
              </div>
              <p className="mt-1 text-sm text-[var(--insyt-muted)]">
                Criado em{" "}
                {format(new Date(project.created_at), "d MMM yyyy", {
                  locale: ptBR,
                })}
              </p>
            </div>
          </div>

          <StatusActions project={project as Project} />
        </div>

        <Card className="insyt-card border-none shadow-none">
          <CardHeader>
            <CardTitle>Link do cliente</CardTitle>
            <CardDescription>
              Envie este link para o cliente preencher o briefing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CopyLinkButton token={project.token} />
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="insyt-card border-none shadow-none lg:col-span-1 lg:sticky lg:top-8 lg:h-fit">
            <CardHeader>
              <CardTitle>Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow label="Nome" value={project.client_name} />
              <InfoRow label="E-mail" value={project.client_email} />
              <InfoRow label="Empresa" value={project.client_company} />
              <Separator />
              <InfoRow
                label="Respondido em"
                value={
                  project.submitted_at
                    ? format(new Date(project.submitted_at), "d MMM yyyy HH:mm", {
                        locale: ptBR,
                      })
                    : null
                }
              />
            </CardContent>
          </Card>

          <Card className="insyt-card border-none shadow-none lg:col-span-2">
            <CardHeader>
              <CardTitle>Respostas</CardTitle>
              <CardDescription>
                {submission
                  ? "Briefing recebido do cliente."
                  : "Aguardando resposta do cliente."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!submission ? (
                <div className="rounded-xl border border-dashed border-[var(--insyt-border)] bg-[var(--insyt-canvas)] px-6 py-10 text-center text-[var(--insyt-muted)]">
                  Nenhuma resposta ainda.
                </div>
              ) : (
                sections.map(([section, sectionQuestions]) => (
                  <div key={section} className="space-y-4">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--insyt-primary)]">
                      {section}
                    </h3>
                    <div className="space-y-4">
                      {sectionQuestions.map((q) => (
                        <AnswerRow
                          key={q.id}
                          question={q}
                          value={answers[q.id]}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-[var(--insyt-muted)]">{label}</p>
      <p className="font-medium text-[var(--insyt-black)]">{value || "N/A"}</p>
    </div>
  );
}

function AnswerRow({
  question,
  value,
}: {
  question: BriefingQuestion;
  value: unknown;
}) {
  return (
    <div className="rounded-xl border border-[var(--insyt-border)] bg-[var(--insyt-canvas)] p-4">
      <p className="text-sm font-semibold text-[var(--insyt-black)]">{question.label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--insyt-slate)]">
        {formatAnswer(value)}
      </p>
    </div>
  );
}

function StatusActions({ project }: { project: Project }) {
  const options: { status: ProjectStatus; label: string }[] = [
    { status: "in_progress", label: "Marcar em andamento" },
    { status: "reviewed", label: "Marcar revisado" },
    { status: "archived", label: "Arquivar" },
  ];
  const nextStatuses = options.filter((s) => s.status !== project.status);

  return (
    <div className="flex flex-wrap gap-2">
      {nextStatuses.map(({ status, label }) => (
        <form key={status} action={setProjectStatus.bind(null, project.id, status)}>
          <Button type="submit" variant="outline" size="sm">
            <FileText className="size-4" />
            {label}
          </Button>
        </form>
      ))}
    </div>
  );
}
