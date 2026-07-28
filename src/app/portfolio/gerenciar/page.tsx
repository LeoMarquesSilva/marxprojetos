import Link from "next/link";
import { BriefcaseBusiness, ExternalLink } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageHeader } from "@/components/admin-page-header";
import { PortfolioManager } from "@/components/portfolio-manager";
import { PortfolioCaseEditor } from "@/components/portfolio-case-editor";
import { PortfolioExternalManager } from "@/components/portfolio-external-manager";
import { buttonVariants } from "@/components/ui/button";
import {
  getExternalProjects,
  getPortfolioCases,
  getPortfolioProjects,
} from "@/app/actions/portfolio";
import { createClient } from "@/lib/supabase/server";

export default async function ManagePortfolioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [projects, cases, externalProjects] = await Promise.all([
    getPortfolioProjects(),
    getPortfolioCases(),
    getExternalProjects(),
  ]);

  // Quantos projetos publicados cada case tem hoje — um case sem projeto
  // publicado não aparece na página pública.
  const chapterCountByCase = projects.reduce<Record<string, number>>(
    (acc, project) => {
      if (project.portfolio_case_id && project.portfolio_published) {
        acc[project.portfolio_case_id] = (acc[project.portfolio_case_id] ?? 0) + 1;
      }
      return acc;
    },
    {},
  );

  return (
    <AdminShell userEmail={user?.email}>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-fluid">
        <AdminPageHeader
          icon={BriefcaseBusiness}
          title="Portfólio"
          description="Transforme trabalhos entregues em prova para a próxima venda."
          activeHref="/portfolio/gerenciar"
          actions={
            <Link
              href="/portfolio"
              target="_blank"
              className={buttonVariants({
                variant: "outline",
                className:
                  "border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white",
              })}
            >
              Ver página pública
              <ExternalLink className="size-4" />
            </Link>
          }
        />

        <PortfolioManager initialProjects={projects} cases={cases} />

        <PortfolioCaseEditor
          cases={cases}
          chapterCountByCase={chapterCountByCase}
        />

        <PortfolioExternalManager projects={externalProjects} />
      </div>
    </AdminShell>
  );
}
