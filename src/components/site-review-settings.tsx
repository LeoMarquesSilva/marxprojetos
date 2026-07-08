"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { enableSiteReview } from "@/app/actions/review";

export function SiteReviewSettings({ projectId }: { projectId: string }) {
  const [sitePath, setSitePath] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleEnable() {
    if (!sitePath.trim()) {
      toast.error("Informe a pasta do site em public/sites/");
      return;
    }

    startTransition(async () => {
      const result = await enableSiteReview(projectId, sitePath.trim());
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Revisão do site ativada!");
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--insyt-slate)]">
        Rode <code className="rounded bg-[var(--insyt-canvas)] px-1.5 py-0.5">npm run sync-site &lt;caminho-do-dist&gt; &lt;slug&gt;</code>{" "}
        para copiar o build do Astro para{" "}
        <code className="rounded bg-[var(--insyt-canvas)] px-1.5 py-0.5">public/sites/&lt;slug&gt;</code>, depois informe o mesmo{" "}
        <strong>slug</strong> abaixo.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="site-path">Slug do site</Label>
          <Input
            id="site-path"
            placeholder="ex: pereira-garcia"
            value={sitePath}
            onChange={(e) => setSitePath(e.target.value)}
          />
        </div>
        <Button type="button" onClick={handleEnable} disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Ativar revisão
        </Button>
      </div>
    </div>
  );
}
