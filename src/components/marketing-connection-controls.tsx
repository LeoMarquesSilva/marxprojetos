"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Unplug } from "lucide-react";
import { toast } from "sonner";
import {
  chooseMarketingAdAccount,
  chooseMarketingPage,
  disconnectMarketing,
} from "@/app/actions/marketing";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { MetaAdAccountOption, MetaPageOption } from "@/types/marketing";

const selectClassName =
  "w-full rounded-xl border border-transparent bg-[var(--insyt-canvas)] px-4 py-3 text-sm font-medium text-[var(--insyt-black)] outline-none transition-all duration-300 hover:border-[var(--insyt-border)] hover:bg-white focus:border-[var(--insyt-primary)]/50 focus:bg-white focus:ring-4 focus:ring-[var(--insyt-primary)]/10";

export function MarketingPagePicker({
  pages,
  selectedId,
}: {
  pages: MetaPageOption[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function choose(pageId: string) {
    if (!pageId || pageId === selectedId) return;
    startTransition(async () => {
      const result = await chooseMarketingPage(pageId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Instagram escolhido.");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className={selectClassName}
        value={selectedId ?? ""}
        disabled={isPending}
        onChange={(event) => choose(event.target.value)}
      >
        <option value="" disabled>
          Escolha a Página
        </option>
        {pages.map((page) => (
          <option key={page.id} value={page.id} disabled={!page.igUserId}>
            {page.name}
            {page.igUsername ? ` · @${page.igUsername}` : " · sem Instagram ligado"}
          </option>
        ))}
      </select>
      {isPending ? <Loader2 className="size-4 animate-spin text-[var(--insyt-muted)]" /> : null}
    </div>
  );
}

const ACCOUNT_STATUS: Record<number, string> = {
  1: "ativa",
  2: "desativada",
  3: "pagamento pendente",
  7: "em análise",
  9: "em período de carência",
  101: "encerrada",
};

export function MarketingAdAccountPicker({
  accounts,
  selectedId,
}: {
  accounts: MetaAdAccountOption[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function choose(accountId: string) {
    if (!accountId || accountId === selectedId) return;
    startTransition(async () => {
      const result = await chooseMarketingAdAccount(accountId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Conta de anúncios escolhida.");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className={selectClassName}
        value={selectedId ?? ""}
        disabled={isPending}
        onChange={(event) => choose(event.target.value)}
      >
        <option value="" disabled>
          Escolha a conta de anúncios
        </option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
            {account.currency ? ` · ${account.currency}` : ""}
            {account.status != null && account.status !== 1
              ? ` · ${ACCOUNT_STATUS[account.status] ?? "inativa"}`
              : ""}
          </option>
        ))}
      </select>
      {isPending ? <Loader2 className="size-4 animate-spin text-[var(--insyt-muted)]" /> : null}
    </div>
  );
}

export function MarketingDisconnectButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function disconnect() {
    startTransition(async () => {
      const result = await disconnectMarketing();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Meta desconectada.");
      router.refresh();
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button type="button" variant="outline" disabled={isPending}>
            <Unplug className="size-4" />
            Desconectar
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desconectar a Meta?</AlertDialogTitle>
          <AlertDialogDescription>
            O sistema apaga os tokens guardados. Posts agendados não serão publicados até
            você conectar de novo. Os leads já criados no CRM continuam lá.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={disconnect}>Desconectar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
