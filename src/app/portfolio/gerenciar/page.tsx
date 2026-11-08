import Link from "next/link";
import { BriefcaseBusiness, ExternalLink } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageHeader } from "@/components/admin-page-header";
import { PortfolioManager } from "@/components/portfolio-manager";
import { PortfolioCaseEditor } from "@/components/portfolio-case-editor";
import { PortfolioExternalManager } from "@/components/portfolio-external-manager";
import { PortfolioSiteSettingsEditor } from "@/components/portfolio-site-settings-editor";
import { buttonVariants } from "@/components/ui/button";
import {
  getExternalProjects,
  getPortfolioCases,
  getPortfolioProjects,
  getSiteSettings,
} from "@/app/actions/portfolio";
import { createClient } from "@/lib/supabase/server";

export default async function ManagePortfolioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [projects, cases, externalProjects, siteSettings] = await Promise.all([
    getPortfolioProjects(),
    getPortfolioCases(),
    getExternalProjects(),
    getSiteSettings(),
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
      <div className="space-y-6">
        <AdminPageHeader
          icon={BriefcaseBusiness}
          title="Portfólio"
          activeHref="/portfolio/gerenciar"
          actions={
            <Link
              href="/"
              target="_blank"
              className={buttonVariants({ variant: "outline" })}
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

        <PortfolioSiteSettingsEditor settings={siteSettings} />
      </div>
    </AdminShell>
  );
}
