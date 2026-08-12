import { Users } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageHeader } from "@/components/admin-page-header";
import { CrmWorkspace } from "@/components/crm-workspace";
import {
  getCrmBoardClients,
  getCrmUnreadConversationCount,
} from "@/app/actions/crm";
import { getCrmWhatsappInbox } from "@/app/actions/crm-whatsapp";
import { createClient } from "@/lib/supabase/server";

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; chat?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const initialView = params.view === "conversas" ? "conversas" : "funil";
  const initialChatJid = params.chat?.trim() || null;
  const [clients, chats, unreadTotal] = await Promise.all([
    initialView === "funil" ? getCrmBoardClients() : [],
    initialView === "conversas" ? getCrmWhatsappInbox() : [],
    getCrmUnreadConversationCount(),
  ]);

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
          unreadTotal={unreadTotal}
          initialView={initialView}
          initialChatJid={initialChatJid}
          initialInboxFilter={params.filter === "unread" ? "unread" : undefined}
        />
      </div>
    </AdminShell>
  );
}
