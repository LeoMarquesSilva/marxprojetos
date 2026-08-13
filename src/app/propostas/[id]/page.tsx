import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { ProposalActions } from "@/components/proposal-actions";
import { ProposalContentEditor } from "@/components/proposal-content-editor";
import { ProposalReadPanel } from "@/components/proposal-read-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getProposal } from "@/app/actions/proposals";
import { createClient } from "@/lib/supabase/server";

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { proposal, sessions } = await getProposal(id);
  if (!proposal) notFound();

  return (
    <AdminShell userEmail={user?.email}>
      <div className="space-y-6">
        <div className="space-y-3">
          <Link
            href="/propostas"
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "-ml-2",
            })}
          >
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
          <div className="flex items-center gap-3">
            <FileText className="size-5 text-[var(--insyt-muted)]" />
            <h1 className="text-3xl font-bold tracking-tight text-[var(--insyt-black)]">
              {proposal.client_name}
            </h1>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1 lg:sticky lg:top-8 lg:h-fit">
            <Card className="insyt-card border-none shadow-none">
              <CardHeader>
                <CardTitle>Leitura do cliente</CardTitle>
                <CardDescription>
                  O que dá para saber sem perguntar.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProposalReadPanel
                  sessions={sessions}
                  totalBlocks={proposal.content.length}
                />
              </CardContent>
            </Card>

            <Card className="insyt-card border-none shadow-none">
              <CardHeader>
                <CardTitle>Envio</CardTitle>
              </CardHeader>
              <CardContent>
                <ProposalActions
                  proposalId={proposal.id}
                  token={proposal.token}
                  published={proposal.published}
                  status={proposal.status}
                />
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <ProposalContentEditor proposal={proposal} />
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
