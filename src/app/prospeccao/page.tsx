import { Radar } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageHeader } from "@/components/admin-page-header";
import { ProspectingBoard } from "@/components/prospecting-board";
import { getProspectingTemplate, getProspects } from "@/app/actions/prospecting";
import { createClient } from "@/lib/supabase/server";

export default async function ProspectingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [prospects, template] = await Promise.all([
    getProspects(),
    getProspectingTemplate(),
  ]);

  return (
    <AdminShell userEmail={user?.email}>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-fluid">
        <AdminPageHeader
          icon={Radar}
          title="Prospecção"
          description="Encontre negócios no Google Maps e aborde direto no WhatsApp."
          activeHref="/prospeccao"
        />

        <ProspectingBoard initialProspects={prospects} template={template} />
      </div>
    </AdminShell>
  );
}
