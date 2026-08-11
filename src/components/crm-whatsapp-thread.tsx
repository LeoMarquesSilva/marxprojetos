"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Check, CheckCheck, Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import {
  sendCrmWhatsappChatMessage,
  sendCrmWhatsappMessage,
} from "@/app/actions/crm-whatsapp";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { CrmWhatsappMessage } from "@/types/crm";

function mergeIncomingMessage(
  prev: CrmWhatsappMessage[],
  incoming: CrmWhatsappMessage,
): CrmWhatsappMessage[] {
  if (prev.some((m) => m.id === incoming.id)) {
    return prev.map((m) => (m.id === incoming.id ? { ...m, ...incoming } : m));
  }

  if (incoming.provider_message_id) {
    const byProvider = prev.findIndex(
      (m) => m.provider_message_id === incoming.provider_message_id,
    );
    if (byProvider >= 0) {
      const next = [...prev];
      next[byProvider] = { ...next[byProvider], ...incoming };
      return next;
    }
  }

  // Substitui o otimista pendente com o mesmo texto (evita bolha duplicada).
  if (incoming.from_me && incoming.conteudo) {
    const pendingIdx = prev.findIndex(
      (m) =>
        m.status === "pending" &&
        m.from_me &&
        m.conteudo === incoming.conteudo,
    );
    if (pendingIdx >= 0) {
      const next = [...prev];
      next[pendingIdx] = incoming;
      return next;
    }
  }

  return [...prev, incoming];
}

export function CrmWhatsappThread({
  clientId,
  remoteJid,
  initialMessages,
  layout = "page",
  onMessageSent,
}: {
  clientId?: string | null;
  remoteJid: string | null;
  initialMessages: CrmWhatsappMessage[];
  /** "sheet" / "inbox" preenchem o painel; "page" é a ficha do cliente. */
  layout?: "page" | "sheet" | "inbox";
  onMessageSent?: (preview: string) => void;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const messageListRef = useRef<HTMLDivElement>(null);
  const isPanel = layout === "sheet" || layout === "inbox";

  // Ressincroniza quando o servidor manda outra lista (ex: router.refresh()
  // na ficha do cliente). Feito durante o render em vez de num efeito: o
  // efeito rodava um render a mais, exibindo a lista antiga por um quadro —
  // é o padrão que o React recomenda para ajustar estado quando a prop muda.
  const [syncedMessages, setSyncedMessages] = useState(initialMessages);
  if (syncedMessages !== initialMessages) {
    setSyncedMessages(initialMessages);
    setMessages(initialMessages);
  }

  // Mensagens/status chegam via webhook → Postgres → Realtime.
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
          setMessages((prev) => mergeIncomingMessage(prev, incoming));
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
            prev.map((m) => {
              if (m.id === updated.id) return { ...m, ...updated };
              if (
                updated.provider_message_id &&
                m.provider_message_id === updated.provider_message_id
              ) {
                return { ...m, ...updated };
              }
              return m;
            }),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [remoteJid]);

  useEffect(() => {
    // scrollIntoView também rolava a página inteira e fazia o composer
    // parecer "empurrado" para baixo. Rolamos somente a lista de mensagens.
    const list = messageListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
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
        client_id: clientId ?? null,
        from_me: true,
        conteudo: text,
        status: "pending",
        erro: null,
        created_at: new Date().toISOString(),
        reactions: [],
      },
    ]);
    setDraft("");
    onMessageSent?.(text);

    startTransition(async () => {
      const result = clientId
        ? await sendCrmWhatsappMessage(clientId, text)
        : await sendCrmWhatsappChatMessage(remoteJid, text);

      if ("error" in result && result.error) {
        toast.error(result.error);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId
              ? { ...m, status: "error", erro: result.error! }
              : m,
          ),
        );
        return;
      }

      if ("message" in result && result.message) {
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticId ? result.message! : m)),
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
      <div
        className={cn(
          "flex flex-col items-center gap-2 text-center",
          isPanel
            ? "flex-1 justify-center px-6 py-16"
            : "rounded-xl border border-dashed border-[var(--insyt-border)] py-10",
        )}
      >
        <MessageCircle className="size-6 text-[var(--insyt-muted)]" />
        <p className="max-w-xs text-sm text-[var(--insyt-muted)]">
          Cadastre um telefone válido para conversar com este cliente pelo
          WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        isPanel
          ? "flex min-h-0 flex-1 flex-col overflow-hidden"
          : "space-y-3",
      )}
    >
      <div
        ref={messageListRef}
        className={cn(
          "overscroll-contain space-y-3 overflow-y-auto bg-[var(--insyt-canvas)] p-4",
          isPanel
            ? "min-h-0 flex-1 rounded-none"
            : "max-h-[420px] rounded-xl",
        )}
      >
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--insyt-muted)]">
            Nenhuma mensagem ainda. Escreva abaixo para iniciar a conversa.
          </p>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
      </div>

      <div
        className={cn(
          "space-y-2",
          isPanel &&
            "flex shrink-0 items-end gap-2 space-y-0 border-t border-[var(--insyt-border)] bg-white px-4 py-3",
        )}
      >
        <Textarea
          placeholder="Escreva uma mensagem..."
          rows={1}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          className={
            isPanel
              ? "max-h-32 min-h-11 flex-1 resize-none py-2.5"
              : undefined
          }
        />
        <div className={cn("flex justify-end", isPanel && "shrink-0")}>
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
  const reactions = message.reactions ?? [];

  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        message.from_me ? "items-end" : "items-start",
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

      {reactions.length > 0 ? (
        <div className="flex gap-1 px-1">
          {reactions.map((reaction, index) => (
            <span
              key={`${reaction.emoji}-${index}`}
              className="rounded-full border border-[var(--insyt-border)] bg-white px-1.5 py-0.5 text-xs shadow-sm"
              title={reaction.fromMe ? "Você" : "Contato"}
            >
              {reaction.emoji}
            </span>
          ))}
        </div>
      ) : null}
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
