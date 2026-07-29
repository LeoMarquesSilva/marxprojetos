"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Check, CheckCheck, Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { sendCrmWhatsappMessage } from "@/app/actions/crm-whatsapp";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { CrmWhatsappMessage } from "@/types/crm";

export function CrmWhatsappThread({
  clientId,
  remoteJid,
  initialMessages,
}: {
  clientId: string;
  remoteJid: string | null;
  initialMessages: CrmWhatsappMessage[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Mensagens novas (respostas do lead, confirmações de status) chegam pelo
  // webhook direto no banco — a tela só precisa escutar, sem recarregar.
  useEffect(() => {
    if (!remoteJid) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`crm-whatsapp-${remoteJid}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "crm_whatsapp_mensagens",
          filter: `remote_jid=eq.${remoteJid}`,
        },
        (payload) => {
          const incoming = payload.new as CrmWhatsappMessage;
          setMessages((prev) =>
            prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming],
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "crm_whatsapp_mensagens",
          filter: `remote_jid=eq.${remoteJid}`,
        },
        (payload) => {
          const updated = payload.new as CrmWhatsappMessage;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m)),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [remoteJid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  function handleSend() {
    const text = draft.trim();
    if (!text || !remoteJid) return;

    const optimisticId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        remote_jid: remoteJid,
        client_id: clientId,
        from_me: true,
        conteudo: text,
        status: "pending",
        erro: null,
        created_at: new Date().toISOString(),
      },
    ]);
    setDraft("");

    startTransition(async () => {
      const result = await sendCrmWhatsappMessage(clientId, text);
      if (result.error) {
        toast.error(result.error);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId ? { ...m, status: "error", erro: result.error! } : m,
          ),
        );
      }
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  if (!remoteJid) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--insyt-border)] py-10 text-center">
        <MessageCircle className="size-6 text-[var(--insyt-muted)]" />
        <p className="text-sm text-[var(--insyt-muted)]">
          Cadastre um telefone válido para conversar com este cliente pelo
          WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-xl bg-[var(--insyt-canvas)] p-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-[var(--insyt-muted)]">
            Nenhuma mensagem ainda. Escreva abaixo para iniciar a conversa.
          </p>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="space-y-2">
        <Textarea
          placeholder="Escreva uma mensagem para o WhatsApp do cliente..."
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={handleSend}
            disabled={isPending || !draft.trim()}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: CrmWhatsappMessage }) {
  const isError = message.status === "error";

  return (
    <div
      className={cn(
        "flex",
        message.from_me ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
          message.from_me
            ? isError
              ? "bg-rose-50 text-rose-900"
              : "bg-[var(--insyt-primary)] text-white"
            : "bg-white text-[var(--insyt-black)]",
        )}
      >
        <p className="whitespace-pre-wrap">{message.conteudo}</p>
        <div
          className={cn(
            "mt-1.5 flex items-center justify-end gap-1 text-[11px]",
            message.from_me ? "text-white/70" : "text-[var(--insyt-muted)]",
            isError && "text-rose-600",
          )}
        >
          <span>
            {format(new Date(message.created_at), "HH:mm", { locale: ptBR })}
          </span>
          {message.from_me ? <MessageStatusIcon status={message.status} /> : null}
        </div>
        {isError && message.erro ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-rose-700">
            <AlertTriangle className="size-3" />
            {message.erro}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function MessageStatusIcon({ status }: { status: CrmWhatsappMessage["status"] }) {
  if (status === "error") return <AlertTriangle className="size-3" />;
  if (status === "pending") return <Loader2 className="size-3 animate-spin" />;
  if (status === "read" || status === "played") {
    return <CheckCheck className="size-3.5 text-sky-300" />;
  }
  if (status === "delivery_ack") return <CheckCheck className="size-3.5" />;
  return <Check className="size-3.5" />;
}
