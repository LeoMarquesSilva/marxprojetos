"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { createSiteReview } from "@/app/actions/review";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Ativa a revisão de um site que não teve briefing. */
export function SiteReviewCreateDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [sitePath, setSitePath] = useState("");
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await createSiteReview({ title, clientName, sitePath });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Revisão ativada. Copie o link e envie ao cliente.");
      setOpen(false);
      router.push(`/sites/${result.id}`);
    });
  }

  return (
    <>
      <Button type="button" className="rounded-full" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Adicionar site
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-3xl bg-white p-0 sm:max-w-md">
          <DialogHeader className="border-b border-[var(--insyt-border)] px-6 py-5 pr-12">
            <DialogTitle className="text-2xl font-bold text-[var(--insyt-black)]">
              Adicionar site
            </DialogTitle>
            <DialogDescription>
              Para site feito sem briefing. Gera o link de revisão na hora.
            </DialogDescription>
          </DialogHeader>

          <form
            className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="site-review-title">Nome do site</Label>
              <Input
                id="site-review-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex: Site — Casa AMPLA"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-review-client">Cliente (opcional)</Label>
              <Input
                id="site-review-client"
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                placeholder="Ex: Camila"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-review-slug">Slug do site</Label>
              <Input
                id="site-review-slug"
                value={sitePath}
                onChange={(event) => setSitePath(event.target.value)}
                placeholder="ex: casa-ampla"
              />
              <p className="text-xs text-[var(--insyt-muted)]">
                A pasta em public/sites/ copiada pelo sync-site.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Ativar revisão
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
