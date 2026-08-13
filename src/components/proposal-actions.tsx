"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteProposal,
  setProposalPublished,
  setProposalStatus,
} from "@/app/actions/proposals";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  PROPOSAL_STATUS_LABELS,
  type ProposalStatus,
} from "@/types/proposal";

const STATUS_STYLE: Record<ProposalStatus, string> = {
  rascunho: "bg-[var(--insyt-canvas-alt)] text-[var(--insyt-slate)]",
  enviada: "bg-[#fff1ec] text-[var(--insyt-primary-dark)]",
  aceita: "bg-emerald-50 text-emerald-800",
  recusada: "bg-stone-100 text-stone-600",
};

export function ProposalActions({
  proposalId,
  token,
  published,
  status,
}: {
  proposalId: string;
  token: string;
  published: boolean;
  status: ProposalStatus;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const publicUrl =
    typeof window === "undefined" ? "" : `${window.location.origin}/p/${token}`;

  function copyLink() {
    navigator.clipboard.writeText(publicUrl).then(
      () => {
        setCopied(true);
        toast.success("Link copiado.");
        setTimeout(() => setCopied(false), 2000);
      },
      () => toast.error("Não consegui copiar o link."),
    );
  }

  return (
    <>
      <div className="space-y-5">
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-[var(--insyt-canvas)] p-4">
          <div>
            <p className="text-sm font-semibold">Link ativo</p>
            <p className="mt-1 text-xs text-[var(--insyt-muted)]">
              Desligado, o link para de abrir — mesmo para quem já recebeu.
            </p>
          </div>
          <Switch
            checked={published}
            disabled={isPending}
            onCheckedChange={(checked) =>
              startTransition(async () => {
                const result = await setProposalPublished(proposalId, checked);
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                router.refresh();
              })
            }
          />
        </label>

        {published ? (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--insyt-muted)]">
              Link do cliente
            </p>
            <div className="flex gap-2">
              <code className="min-w-0 flex-1 truncate rounded-xl bg-[var(--insyt-canvas)] px-3 py-2.5 text-xs text-[var(--insyt-slate)]">
                {publicUrl}
              </code>
              <Button type="button" variant="outline" size="sm" onClick={copyLink}>
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                Copiar
              </Button>
              <a
                href={`/p/${token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex size-9 items-center justify-center rounded-full text-[var(--insyt-muted)] transition-colors hover:bg-[var(--insyt-canvas)] hover:text-[var(--insyt-black)]"
                aria-label="Abrir proposta"
              >
                <ExternalLink className="size-4" />
              </a>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--insyt-muted)]">
            Situação
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PROPOSAL_STATUS_LABELS) as ProposalStatus[]).map(
              (option) => (
                <button
                  key={option}
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await setProposalStatus(proposalId, option);
                      if (result.error) {
                        toast.error(result.error);
                        return;
                      }
                      router.refresh();
                    })
                  }
                  className={cn(
                    "rounded-full px-3.5 py-2 text-xs font-semibold transition-colors",
                    status === option
                      ? STATUS_STYLE[option]
                      : "bg-white text-[var(--insyt-muted)] hover:bg-[var(--insyt-canvas)]",
                  )}
                >
                  {PROPOSAL_STATUS_LABELS[option]}
                </button>
              ),
            )}
            {isPending ? (
              <Loader2 className="size-4 animate-spin self-center text-[var(--insyt-primary)]" />
            ) : null}
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="size-4" />
          Excluir proposta
        </Button>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta proposta?</AlertDialogTitle>
            <AlertDialogDescription>
              O link para de funcionar e o histórico de leitura é perdido junto.
              Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteProposal(proposalId);
                  if (result.error) {
                    toast.error(result.error);
                    return;
                  }
                  router.push("/propostas");
                })
              }
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
