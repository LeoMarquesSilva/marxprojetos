import { Settings, ShieldAlert } from "lucide-react";
import { AccountPasswordCard } from "@/components/account-password-card";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageHeader } from "@/components/admin-page-header";
import { UsersBoard } from "@/components/users-board";
import { getMyRole, listUsers } from "@/app/actions/users";
import { requireAuthenticatedUser } from "@/lib/supabase/require-authenticated-user";

export default async function ConfiguracoesPage() {
  const { user } = await requireAuthenticatedUser();
  const role = await getMyRole();

  return (
    <AdminShell userEmail={user.email}>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-fluid">
        <AdminPageHeader
          icon={Settings}
          title="Configurações"
          description="Sua senha e os usuários que têm acesso ao Briefing Studio."
          activeHref="/configuracoes"
        />

        <AccountPasswordCard email={user.email ?? ""} />

        {role !== "admin" ? (
          <div className="insyt-card flex flex-col items-center gap-3 px-6 py-20 text-center">
            <ShieldAlert className="size-8 text-[var(--insyt-muted)]" />
            <p className="text-[var(--insyt-slate)]">
              Apenas administradores gerenciam usuários.
            </p>
          </div>
        ) : (
          <UsersBoardLoader currentUserId={user.id} />
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
