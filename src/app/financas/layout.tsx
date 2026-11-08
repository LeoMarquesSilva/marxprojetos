import { Suspense, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { FinanceEntrySheet } from "@/components/finance-entry-sheet";
import { FinanceHeader } from "@/components/finance-header";
import { Button } from "@/components/ui/button";
import { loadFinanceData } from "@/lib/finance-page-data";
import { requireAuthenticatedUser } from "@/lib/supabase/require-authenticated-user";

export default async function FinanceLayout({ children }: { children: ReactNode }) {
  const { user } = await requireAuthenticatedUser();

  return (
    <AdminShell userEmail={user.email}>
      <div className="space-y-6">
        <FinanceHeader
          actions={
            <Suspense fallback={<LaunchPlaceholder />}>
              <LaunchButton />
            </Suspense>
          }
        />
        {children}
      </div>
    </AdminShell>
  );
}

/** O formulário precisa da lista de projetos: entra quando os dados chegam. */
async function LaunchButton() {
  const { projectOptions } = await loadFinanceData();
  return <FinanceEntrySheet projects={projectOptions} />;
}

function LaunchPlaceholder() {
  return (
    <Button disabled>
      <Plus className="size-4" />
      Lançar
    </Button>
  );
}
