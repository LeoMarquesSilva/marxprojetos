"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Loader2, MessageCircle, MessagesSquare, Sparkles } from "lucide-react";
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
  sendProspectToConversas,
  updateProspectMessage,
} from "@/app/actions/prospecting";
import { buildWaMeUrl, fillTemplate } from "@/lib/phone";
import { INSYT_STUDIO_URL, type Prospect } from "@/types/prospecting";

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
  const portfolioUrl = INSYT_STUDIO_URL;
  const [message, setMessage] = useState(
    prospect.custom_message ??
      fillTemplate(template, {
        nome: prospect.name,
        cidade: prospect.city,
        hasSite: Boolean(prospect.website),
        portfolioUrl,
      }),
  );
  const [isSaving, startSaveTransition] = useTransition();
  const [isGenerating, startGenerateTransition] = useTransition();
  const [isSending, startSendTransition] = useTransition();
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

  function handleSendToConversas() {
    startSendTransition(async () => {
      const result = await sendProspectToConversas(prospect.id, message);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Mensagem enviada · lead no CRM");
      onOpenChange(false);
      router.push(
        `/crm?view=conversas&chat=${encodeURIComponent(result.remoteJid!)}`,
      );
      router.refresh();
    });
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
            rows={12}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <p className="text-xs text-[var(--insyt-muted)]">
            Portfólio no modelo:{" "}
            <a
              href={portfolioUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[var(--insyt-primary)] hover:underline"
            >
              {portfolioUrl}
            </a>
          </p>

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

        <SheetFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            onClick={handleSendToConversas}
            disabled={!prospect.phone_e164 || isSending}
            className="w-full"
          >
            {isSending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MessagesSquare className="size-4" />
            )}
            Enviar e abrir Conversas
          </Button>
          <div className="flex w-full flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1"
            >
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              Salvar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleOpenWhatsApp}
              disabled={!prospect.phone_e164}
              className="flex-1"
            >
              <MessageCircle className="size-4" />
              Abrir WhatsApp
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
