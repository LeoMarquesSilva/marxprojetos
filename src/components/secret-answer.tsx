"use client";

import { useState, useTransition } from "react";
import { Copy, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { revealBriefingSecret } from "@/app/actions/projects";

// O valor só sai do servidor quando alguém clica em Revelar: a página do
// projeto renderiza apenas se o campo foi preenchido, nunca o texto cifrado.
export function SecretAnswer({
  projectId,
  questionId,
  filled,
}: {
  projectId: string;
  questionId: string;
  filled: boolean;
}) {
  const [value, setValue] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!filled) {
    return <p className="mt-2 text-sm text-[var(--insyt-slate)]">—</p>;
  }

  function reveal() {
    startTransition(async () => {
      const result = await revealBriefingSecret(projectId, questionId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setValue(result.value);
    });
  }

  async function copy() {
    if (value === null) return;
    await navigator.clipboard.writeText(value);
    toast.success("Copiado!");
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <code className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--insyt-border)] bg-white px-3 py-2 text-sm text-[var(--insyt-slate)]">
        {value === null ? (
          <>
            <Lock className="size-3.5 shrink-0" />
            ••••••••
          </>
        ) : (
          <span className="break-all">{value}</span>
        )}
      </code>
      {value === null ? (
        <Button type="button" variant="outline" size="sm" onClick={reveal} disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
          Revelar
        </Button>
      ) : (
        <>
          <Button type="button" variant="outline" size="sm" onClick={copy}>
            <Copy className="size-4" />
            Copiar
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setValue(null)}>
            <EyeOff className="size-4" />
            Ocultar
          </Button>
        </>
      )}
    </div>
  );
}
