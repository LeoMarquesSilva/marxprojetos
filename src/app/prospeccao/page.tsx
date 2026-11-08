import { Radar } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageHeader } from "@/components/admin-page-header";
import { ProspectingBoard } from "@/components/prospecting-board";
import {
  getMapsSearchJobs,
  getProspectingSettings,
  getProspectingStatus,
  getProspects,
} from "@/app/actions/prospecting";
import { createClient } from "@/lib/supabase/server";

// Vale para as Server Actions da página: a busca ampla/varredura e a
// análise de sites passam do limite padrão de uma função.
export const maxDuration = 300;

export default async function ProspectingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [prospects, settings, status, mapsQueue] = await Promise.all([
    getProspects(),
    getProspectingSettings(),
    getProspectingStatus(),
    getMapsSearchJobs(),
  ]);

  return (
    <AdminShell userEmail={user?.email} wide>
      <div className="space-y-6">
        <AdminPageHeader
          icon={Radar}
          title="Prospecção"
          activeHref="/prospeccao"
        />

        <ProspectingBoard
          initialProspects={prospects}
          settings={settings}
          status={status}
          initialMapsQueue={mapsQueue}
        />
      </div>
    </AdminShell>
  );
}
