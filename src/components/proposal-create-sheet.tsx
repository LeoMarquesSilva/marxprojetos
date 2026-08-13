"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { createProposal } from "@/app/actions/proposals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

export function ProposalCreateSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await createProposal({ title, subtitle, clientName });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      setTitle("");
      setSubtitle("");
      setClientName("");
      toast.success("Proposta criada.");
      if (result.id) router.push(`/propostas/${result.id}`);
    });
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="border-white/15 bg-white/10 text-white hover:bg-white/15"
      >
        <Plus className="size-4" />
        Nova proposta
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader className="border-b border-[var(--insyt-border)] px-6 py-6">
            <SheetTitle className="text-2xl font-bold">Nova proposta</SheetTitle>
            <SheetDescription>
              O conteúdo você monta na tela seguinte.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 px-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="proposal-client">Cliente</Label>
              <Input
                id="proposal-client"
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                placeholder="Ex: Outeiral Advocacia"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="proposal-title">Título</Label>
              <Input
                id="proposal-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex: Desenvolvimento de Site Institucional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="proposal-subtitle">Subtítulo</Label>
              <Textarea
                id="proposal-subtitle"
                value={subtitle}
                onChange={(event) => setSubtitle(event.target.value)}
                rows={3}
                placeholder="Uma frase que resume a proposta na abertura."
              />
            </div>

            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={save}
              disabled={isPending || !title.trim() || !clientName.trim()}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Criar e montar conteúdo
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
