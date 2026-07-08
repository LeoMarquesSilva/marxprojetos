import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, CheckCircle2, FileText } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { CopyReviewLinkButton } from "@/components/copy-review-link-button";
import { SiteReviewSettings } from "@/components/site-review-settings";
import { ProjectReviewComments } from "@/components/project-review-comments";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getProject } from "@/app/actions/projects";
import { getProjectComments } from "@/app/actions/review";
import { createClient } from "@/lib/supabase/server";

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { project } = await getProject(id);
  if (!project) notFound();

  const comments = await getProjectComments(id);

  return (
    <AdminShell userEmail={user?.email}>
      <div className="space-y-6">
        <div className="space-y-3">
          <Link
            href="/sites"
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "-ml-2",
            })}
          >
            <ArrowLeft className="size-4" />
            Voltar para Sites
          </Link>
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-[var(--insyt-black)]">
              {project.title}
            </h1>
            <Link
              href={`/projects/${project.id}`}
              className="mt-1 inline-flex items-center gap-1.5 text-sm text-[var(--insyt-primary)] hover:underline"
            >
              <FileText className="size-3.5" />
              Ver briefing e respostas do cliente
            </Link>
          </div>
        </div>

        <Card className="insyt-card border-none shadow-none">
          <CardHeader>
            <CardTitle>Revisão do site</CardTitle>
            <CardDescription>
              Envie este link para o cliente comentar diretamente no site já
              construído.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {project.review_enabled ? (
              <div className="space-y-2">
                <CopyReviewLinkButton token={project.review_token!} />
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--insyt-muted)]">
                  {project.review_enabled_at ? (
                    <span>
                      Disponível desde{" "}
                      {format(
                        new Date(project.review_enabled_at),
                        "d MMM yyyy HH:mm",
                        { locale: ptBR },
                      )}
                    </span>
                  ) : null}
                  {project.review_approved_at ? (
                    <span className="flex items-center gap-1 font-medium text-emerald-700">
                      <CheckCircle2 className="size-3.5" />
                      Aprovado em{" "}
                      {format(
                        new Date(project.review_approved_at),
                        "d MMM yyyy HH:mm",
                        { locale: ptBR },
                      )}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : (
              <SiteReviewSettings projectId={project.id} />
            )}
          </CardContent>
        </Card>

        {project.review_enabled ? (
          <Card className="insyt-card border-none shadow-none">
            <CardHeader>
              <CardTitle>Comentários do cliente</CardTitle>
              <CardDescription>
                {comments.length === 0
                  ? "Nenhum comentário recebido ainda."
                  : `${comments.filter((c) => c.status === "open").length} aberto(s) de ${comments.length}.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectReviewComments projectId={project.id} comments={comments} />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AdminShell>
  );
}
