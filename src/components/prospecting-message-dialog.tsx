"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, ExternalLink, Loader2, MessageCircle, Send, Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ProspectingDialogShell } from "@/components/prospecting-dialog-shell";
import {
  personalizeMessage,
  sendProspectToConversas,
  updateProspectMessage,
} from "@/app/actions/prospecting";
import { buildWaMeUrl } from "@/lib/phone";
import { renderProspectMessage } from "@/lib/prospecting/message";
import { scoreProspect } from "@/lib/prospecting/score";
import type { Prospect, ProspectingSettings } from "@/types/prospecting";

export type MessageKind = "primeira" | "followup";

// O rascunho é a mensagem salva para o lead ou o modelo preenchido. Nada é
// acrescentado por fora: o que aparece na caixa é exatamente o que vai sair.
export function draftMessageFor(
  prospect: Prospect,
  settings: ProspectingSettings,
  kind: MessageKind,
) {
  if (kind === "primeira" && prospect.custom_message?.trim()) {
    return prospect.custom_message.trim();
  }
  return renderProspectMessage(
    kind === "followup" ? settings.followupTemplate : settings.template,
    prospect,
  );
}

export function ProspectingMessageDialog({
  prospect,
  settings,
  kind,
  open,
  onOpenChange,
  onSent,
}: {
  prospect: Prospect;
  settings: ProspectingSettings;
  kind: MessageKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: (result: { remoteJid: string; sentToday: number }) => void;
}) {
  const [message, setMessage] = useState(() => draftMessageFor(prospect, settings, kind));
  const [isSaving, startSaveTransition] = useTransition();
  const [isGenerating, startGenerateTransition] = useTransition();
  const [isSending, startSendTransition] = useTransition();
  const router = useRouter();
  const score = scoreProspect(prospect);

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
      setMessage((result.message ?? "").trim());
      toast.success("Mensagem personalizada gerada!");
    });
  }

  function handleCopy() {
    navigator.clipboard.writeText(message.trim());
    toast.success("Mensagem copiada!");
  }

  function handleOpenWhatsApp() {
    if (!prospect.phone_e164) return;
    window.open(buildWaMeUrl(prospect.phone_e164, message.trim()), "_blank");
  }

  function handleSend() {
    startSendTransition(async () => {
      const result = await sendProspectToConversas(prospect.id, message.trim(), {
        followup: kind === "followup",
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      onSent({ remoteJid: result.remoteJid!, sentToday: result.sentToday ?? 0 });
      onOpenChange(false);
    });
  }

  const blocked = !prospect.phone_e164 || prospect.has_whatsapp === false;

  return (
    <ProspectingDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={kind === "followup" ? `Follow-up para ${prospect.name}` : prospect.name}
      description={
        <>
          {prospect.category ?? prospect.niche} · {prospect.city}
          {score.segment ? ` · ${score.segment.label}` : ""}
        </>
      }
      footer={
        <div className="space-y-2">
          <Button
            type="button"
            className="w-full"
            onClick={handleSend}
            disabled={blocked || isSending || !message.trim()}
          >
            {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {kind === "followup" ? "Enviar follow-up" : "Enviar pelo WhatsApp"}
          </Button>
          <div className="flex gap-2">
            {kind === "primeira" ? (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                Salvar
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleOpenWhatsApp}
              disabled={!prospect.phone_e164}
              title="Abre o WhatsApp do seu celular/computador com o texto pronto"
            >
              <ExternalLink className="size-4" />
              wa.me
            </Button>
          </div>
        </div>
      }
    >
      {score.reasons.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {score.reasons.map((reason) => (
            <span
              key={reason}
              className="rounded-full bg-[var(--insyt-canvas-alt)] px-2.5 py-1 text-[11px] font-medium text-[var(--insyt-slate)]"
            >
              {reason}
            </span>
          ))}
        </div>
      ) : null}

      {prospect.has_whatsapp === false ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          A verificação indicou que este número não tem WhatsApp.{" "}
          {prospect.email || prospect.instagram
            ? `Tente ${[prospect.email ? "o e-mail" : null, prospect.instagram ? "o Instagram" : null]
                .filter(Boolean)
                .join(" ou ")}.`
            : "Rode “Analisar sites” — o site costuma ter o WhatsApp de verdade."}
        </p>
      ) : null}

      <Textarea rows={11} value={message} onChange={(e) => setMessage(e.target.value)} />

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
        {prospect.instagram ? (
          <a
            href={prospect.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <MessageCircle className="size-4" />
            Instagram
          </a>
        ) : null}
      </div>
    </ProspectingDialogShell>
  );
}
