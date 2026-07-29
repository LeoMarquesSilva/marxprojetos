import { Users } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageHeader } from "@/components/admin-page-header";
import { CrmWorkspace } from "@/components/crm-workspace";
import { getCrmBoardClients } from "@/app/actions/crm";
import { getCrmWhatsappInbox } from "@/app/actions/crm-whatsapp";
import { createClient } from "@/lib/supabase/server";

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; chat?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [clients, chats] = await Promise.all([
    getCrmBoardClients(),
    getCrmWhatsappInbox(),
  ]);

  const initialView = params.view === "conversas" ? "conversas" : "funil";
  const initialChatJid = params.chat?.trim() || null;

  return (
    <AdminShell userEmail={user?.email} wide>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-fluid">
        <AdminPageHeader
          icon={Users}
          title="CRM"
          description="Acompanhe leads, propostas e clientes fechados num só lugar."
          activeHref="/crm"
        />

        <CrmWorkspace
          clients={clients}
          chats={chats}
          initialView={initialView}
          initialChatJid={initialChatJid}
        />
      </div>
    </AdminShell>
  );
}
