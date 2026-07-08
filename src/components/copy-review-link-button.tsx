"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { getReviewLink } from "@/lib/briefing-utils";

export function CopyReviewLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const link = getReviewLink(token);

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <code className="flex-1 truncate rounded-xl border border-[var(--insyt-border)] bg-[var(--insyt-canvas)] px-3 py-2.5 text-sm text-[var(--insyt-slate)]">
        {link}
      </code>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={copy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          Copiar
        </Button>
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: "secondary" })}
        >
          <ExternalLink className="size-4" />
          Abrir
        </a>
      </div>
    </div>
  );
}
