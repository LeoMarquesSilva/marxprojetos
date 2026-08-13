import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Eye, FileText, Clock } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageHeader } from "@/components/admin-page-header";
import { ProposalCreateSheet } from "@/components/proposal-create-sheet";
import { getProposals } from "@/app/actions/proposals";
import { createClient } from "@/lib/supabase/server";
import {
  PROPOSAL_STATUS_LABELS,
  formatReadingTime,
  summarizeProposalSessions,
  type ProposalSession,
} from "@/types/proposal";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  rascunho: "bg-[var(--insyt-canvas-alt)] text-[var(--insyt-slate)]",
  enviada: "bg-[#fff1ec] text-[var(--insyt-primary-dark)]",
  aceita: "bg-emerald-50 text-emerald-800",
  recusada: "bg-stone-100 text-stone-600",
};

export default async function ProposalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const proposals = await getProposals();

  // Uma consulta só para as métricas de todas as propostas, em vez de uma
  // por linha da lista.
  const { data: allSessions } = await supabase
    .from("proposal_sessions")
    .select("*");

  const sessionsByProposal = new Map<string, ProposalSession[]>();
  for (const session of (allSessions ?? []) as ProposalSession[]) {
    const list = sessionsByProposal.get(session.proposal_id) ?? [];
    list.push(session);
    sessionsByProposal.set(session.proposal_id, list);
  }

  return (
    <AdminShell userEmail={user?.email}>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-fluid">
        <AdminPageHeader
          icon={FileText}
          title="Propostas"
          description="Monte, envie e acompanhe se o cliente leu."
          activeHref="/propostas"
          actions={<ProposalCreateSheet />}
        />

        {proposals.length === 0 ? (
          <div className="insyt-card flex flex-col items-center gap-3 py-20 text-center">
            <FileText className="size-7 text-[var(--insyt-muted)]" />
            <h2 className="text-lg font-semibold">Nenhuma proposta ainda</h2>
            <p className="max-w-sm text-sm text-[var(--insyt-muted)]">
              Crie a primeira, publique o link e acompanhe aqui quantas vezes o
              cliente abriu e até onde leu.
            </p>
          </div>
        ) : (
          <div className="insyt-card divide-y divide-[var(--insyt-border)] overflow-hidden">
            {proposals.map((proposal) => {
              const stats = summarizeProposalSessions(
                sessionsByProposal.get(proposal.id) ?? [],
              );

              return (
                <Link
                  key={proposal.id}
                  href={`/propostas/${proposal.id}`}
                  className="grid gap-3 px-6 py-5 transition-colors hover:bg-[var(--insyt-canvas)]/70 sm:grid-cols-[1fr_auto] sm:items-center sm:px-8"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-bold text-[var(--insyt-black)]">
                        {proposal.client_name}
                      </h2>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                          STATUS_STYLE[proposal.status],
                        )}
                      >
                        {PROPOSAL_STATUS_LABELS[proposal.status]}
                      </span>
                      {!proposal.published ? (
                        <span className="text-[11px] font-medium text-[var(--insyt-muted)]">
                          link desligado
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-[var(--insyt-muted)]">
                      {proposal.title}
                    </p>
                    <p className="mt-1 text-xs text-[var(--insyt-muted)]">
                      Criada em{" "}
                      {format(new Date(proposal.created_at), "d MMM yyyy", {
                        locale: ptBR,
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-5 text-sm sm:justify-end">
                    {stats.sessions === 0 ? (
                      <span className="text-xs text-[var(--insyt-muted)]">
                        não aberta
                      </span>
                    ) : (
                      <>
                        <span className="flex items-center gap-1.5 text-[var(--insyt-slate)]">
                          <Eye className="size-3.5" />
                          {stats.sessions}
                        </span>
                        <span className="flex items-center gap-1.5 text-[var(--insyt-slate)]">
                          <Clock className="size-3.5" />
                          {formatReadingTime(stats.totalSeconds)}
                        </span>
                        <span
                          className={cn(
                            "text-xs font-semibold",
                            stats.reachedEnd
                              ? "text-emerald-700"
                              : "text-[var(--insyt-muted)]",
                          )}
                        >
                          {stats.reachedEnd
                            ? "leu tudo"
                            : `${stats.bestScrollPercent}%`}
                        </span>
                      </>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
