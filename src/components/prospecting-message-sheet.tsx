"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Loader2, MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  personalizeMessage,
  updateProspectMessage,
} from "@/app/actions/prospecting";
import { buildWaMeUrl, fillTemplate } from "@/lib/phone";
import type { Prospect } from "@/types/prospecting";

export function ProspectingMessageSheet({
  prospect,
  template,
  open,
  onOpenChange,
}: {
  prospect: Prospect;
  template: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [message, setMessage] = useState(
    prospect.custom_message ??
      fillTemplate(template, {
        nome: prospect.name,
        cidade: prospect.city,
        hasSite: Boolean(prospect.website),
      }),
  );
  const [isSaving, startSaveTransition] = useTransition();
  const [isGenerating, startGenerateTransition] = useTransition();
  const router = useRouter();

  function handleSave() {
    startSaveTransition(async () => {
      const result = await updateProspectMessage(prospect.id, message.trim());
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Mensagem salva!");
      router.refresh();
    });
  }

  function handlePersonalize() {
    startGenerateTransition(async () => {
      const result = await personalizeMessage(prospect.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setMessage(result.message!);
      toast.success("Mensagem personalizada gerada!");
      router.refresh();
    });
  }

  function handleCopy() {
    navigator.clipboard.writeText(message);
    toast.success("Mensagem copiada!");
  }

  function handleOpenWhatsApp() {
    if (!prospect.phone_e164) return;
    window.open(buildWaMeUrl(prospect.phone_e164, message), "_blank");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Mensagem para {prospect.name}</SheetTitle>
          <SheetDescription>
            {prospect.niche} · {prospect.city}
            {prospect.website ? " · tem site" : " · sem site"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
          <Textarea
            rows={10}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePersonalize}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Personalizar com IA
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="size-4" />
              Copiar
            </Button>
          </div>
        </div>

        <SheetFooter className="flex-row justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
            Salvar
          </Button>
          <Button
            type="button"
            onClick={handleOpenWhatsApp}
            disabled={!prospect.phone_e164}
          >
            <MessageCircle className="size-4" />
            Abrir WhatsApp
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
