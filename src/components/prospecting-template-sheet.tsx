"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { saveProspectingTemplate } from "@/app/actions/prospecting";
import { fillTemplate } from "@/lib/phone";

export function ProspectingTemplateSheet({ template }: { template: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(template);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSave() {
    if (!value.trim()) {
      toast.error("O modelo não pode ficar vazio.");
      return;
    }
    startTransition(async () => {
      const result = await saveProspectingTemplate(value.trim());
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Modelo salvo!");
      setOpen(false);
      router.refresh();
    });
  }

  const preview = fillTemplate(value, {
    nome: "Padaria Central",
    cidade: "Campinas",
    hasSite: false,
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button type="button" variant="outline">
            <FileText className="size-4" />
            Modelo
          </Button>
        }
      />
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Modelo de mensagem</SheetTitle>
          <SheetDescription>
            Usado para todos os leads. Placeholders disponíveis:{" "}
            <code className="rounded bg-[var(--insyt-canvas-alt)] px-1">
              {"{{nome}}"}
            </code>{" "}
            <code className="rounded bg-[var(--insyt-canvas-alt)] px-1">
              {"{{cidade}}"}
            </code>{" "}
            <code className="rounded bg-[var(--insyt-canvas-alt)] px-1">
              {"{{site}}"}
            </code>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-4">
          <Textarea
            rows={10}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--insyt-muted)]">
              Prévia (lead sem site)
            </p>
            <div className="rounded-2xl bg-[#e7f8ef] p-4 text-sm whitespace-pre-wrap text-[var(--insyt-black)]">
              {preview}
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Salvar modelo
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
