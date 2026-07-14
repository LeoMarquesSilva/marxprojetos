import { Users } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageHeader } from "@/components/admin-page-header";
import { CrmBoard } from "@/components/crm-board";
import { getCrmClients } from "@/app/actions/crm";
import { createClient } from "@/lib/supabase/server";

export default async function CrmPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const clients = await getCrmClients();

  return (
    <AdminShell userEmail={user?.email}>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-fluid">
        <AdminPageHeader
          icon={Users}
          title="CRM"
          description="Acompanhe leads, propostas e clientes fechados num só lugar."
          activeHref="/crm"
        />

        <CrmBoard initialClients={clients} />
      </div>
    </AdminShell>
  );
}
