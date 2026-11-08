import { Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageHeader } from "@/components/admin-page-header";
import { CreateProjectForm } from "@/components/create-project-form";
import { getTemplates } from "@/app/actions/projects";
import { getCrmClients } from "@/app/actions/crm";
import { createClient } from "@/lib/supabase/server";
import type { BriefingTemplate } from "@/types/briefing";

export default async function NewProjectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [templates, crmClients] = await Promise.all([
    getTemplates() as Promise<BriefingTemplate[]>,
    getCrmClients(),
  ]);
  const today = format(new Date(), "dd MMM yyyy", { locale: ptBR });

  return (
    <AdminShell userEmail={user?.email}>
      <div>
        <AdminPageHeader
          icon={Plus}
          title="Novo briefing"
          description={`Novo projeto · ${today}`}
        />
        <div className="mt-8">
          <CreateProjectForm templates={templates} crmClients={crmClients} />
        </div>
      </div>
    </AdminShell>
  );
}
