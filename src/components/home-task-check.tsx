"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateCrmNextStep } from "@/app/actions/crm";
import { toastWithUndo } from "@/components/finance-settle";

/** Conclui o próximo passo do cliente; o aviso permite voltar atrás. */
export function HomeTaskCheck({
  clientId,
  clientName,
  step,
  date,
}: {
  clientId: string;
  clientName: string;
  step: string;
  date: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function complete() {
    startTransition(async () => {
      const result = await updateCrmNextStep(clientId, { step: "", date: null });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toastWithUndo(
        `${clientName}: próximo passo concluído.`,
        () => updateCrmNextStep(clientId, { step, date }),
        () => router.refresh(),
      );
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={complete}
      disabled={isPending}
      title="Concluir"
      aria-label={`Concluir: ${step}`}
      className="group/check mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border border-[var(--input)] bg-white transition-colors duration-150 hover:border-[var(--insyt-primary)] disabled:opacity-60"
    >
      {isPending ? (
        <Loader2 className="size-3 animate-spin text-[var(--insyt-muted)]" />
      ) : (
        <Check className="size-3 text-[var(--insyt-primary)] opacity-0 transition-opacity duration-150 group-hover/check:opacity-100" />
      )}
    </button>
  );
}
