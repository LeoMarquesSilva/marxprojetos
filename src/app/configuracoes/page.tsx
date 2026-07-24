import { Settings, ShieldAlert } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageHeader } from "@/components/admin-page-header";
import { UsersBoard } from "@/components/users-board";
import { getMyRole, listUsers } from "@/app/actions/users";
import { createClient } from "@/lib/supabase/server";

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = await getMyRole();

  return (
    <AdminShell userEmail={user?.email}>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-fluid">
        <AdminPageHeader
          icon={Settings}
          title="Configurações"
          description="Gerencie os usuários que têm acesso ao Briefing Studio."
          activeHref="/configuracoes"
        />

        {role !== "admin" ? (
          <div className="insyt-card flex flex-col items-center gap-3 px-6 py-20 text-center">
            <ShieldAlert className="size-8 text-[var(--insyt-muted)]" />
            <p className="text-[var(--insyt-slate)]">
              Apenas administradores têm acesso a esta página.
            </p>
          </div>
        ) : (
          <UsersBoardLoader currentUserId={user!.id} />
        )}
      </div>
    </AdminShell>
  );
}

async function UsersBoardLoader({ currentUserId }: { currentUserId: string }) {
  const result = await listUsers();

  if ("error" in result) {
    return (
      <div className="insyt-card px-6 py-10 text-center text-[var(--insyt-slate)]">
        {result.error}
      </div>
    );
  }

  return <UsersBoard initialUsers={result.users} currentUserId={currentUserId} />;
}
