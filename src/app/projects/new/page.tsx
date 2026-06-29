import { LayoutDashboard, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageHeader } from "@/components/admin-page-header";
import { CreateProjectForm } from "@/components/create-project-form";
import { getTemplates } from "@/app/actions/projects";
import { createClient } from "@/lib/supabase/server";
import type { BriefingTemplate } from "@/types/briefing";

export default async function NewProjectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const templates = (await getTemplates()) as BriefingTemplate[];
  const today = format(new Date(), "dd MMM yyyy", { locale: ptBR });

  return (
    <AdminShell userEmail={user?.email}>
      <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-fluid">
        <AdminPageHeader
          icon={Plus}
          title="Novo briefing"
          description={`Novo projeto · ${today}`}
          activeHref="/projects/new"
          quickLinks={[
            { href: "/dashboard", label: "Briefings", icon: LayoutDashboard },
            { href: "/projects/new", label: "Novo briefing", icon: Plus },
          ]}
        />
        <div className="mt-8">
          <CreateProjectForm templates={templates} />
        </div>
      </div>
    </AdminShell>
  );
}
