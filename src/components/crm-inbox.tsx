"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Check,
  CheckCheck,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  MessageCircle,
  Search,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import {
  createCrmNote,
  updateCrmClient,
  updateCrmClientStage,
} from "@/app/actions/crm";
import {
  getCrmInboxChatContext,
  getCrmWhatsappThreadByJid,
  updateCrmInboxNote,
} from "@/app/actions/crm-whatsapp";
import { CrmWhatsappThread } from "@/components/crm-whatsapp-thread";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  STAGE_ACCENT,
  STAGE_COLUMNS,
  STAGE_LABELS,
  type CrmInboxChat,
  type CrmInboxProspect,
  type CrmNote,
  type CrmStage,
  type CrmWhatsappMessage,
} from "@/types/crm";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

type Filter = "all" | "unread" | "unlinked" | CrmStage;

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0]?.slice(0, 2);
  return (initials ?? "?").toUpperCase();
}

function displayName(chat: CrmInboxChat) {
  if (chat.client?.name) return chat.client.name;
  if (chat.profileName) return chat.profileName;
  if (chat.pushName) return chat.pushName;
  return chat.remoteJid.replace("@s.whatsapp.net", "");
}

function formatChatTime(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd/MM", { locale: ptBR });
}

function statusLabel(status: CrmWhatsappMessage["status"] | null) {
  if (!status) return "Sem envio ainda";
  if (status === "read" || status === "played") return "Lida";
  if (status === "delivery_ack") return "Entregue";
  if (status === "server_ack") return "Enviada";
  if (status === "pending") return "Enviando...";
  if (status === "error") return "Falhou";
  return status;
}

function Avatar({
  name,
  src,
  size = "md",
  unread = false,
}: {
  name: string;
  src: string | null;
  size?: "sm" | "md" | "lg";
  unread?: boolean;
}) {
  const sizeClass =
    size === "lg" ? "size-14 text-base" : size === "sm" ? "size-9 text-[10px]" : "size-10 text-xs";

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL do CDN WhatsApp expira e muda de host
      <img
        src={src}
        alt={name}
        className={cn("shrink-0 rounded-full object-cover", sizeClass)}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold",
        sizeClass,
        unread
          ? "bg-[var(--insyt-primary)] text-white"
          : "bg-[var(--insyt-canvas-alt)] text-[var(--insyt-primary)]",
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

export function CrmInbox({
  initialChats,
  initialActiveJid = null,
}: {
  initialChats: CrmInboxChat[];
  initialActiveJid?: string | null;
}) {
  const [chats, setChats] = useState(initialChats);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [activeJid, setActiveJid] = useState<string | null>(() => {
    if (
      initialActiveJid &&
      initialChats.some((chat) => chat.remoteJid === initialActiveJid)
    ) {
      return initialActiveJid;
    }
    return initialActiveJid ?? initialChats[0]?.remoteJid ?? null;
  });
  const [loaded, setLoaded] = useState<{
    remoteJid: string;
    messages: CrmWhatsappMessage[];
  } | null>(null);
  const [context, setContext] = useState<{
    chat: CrmInboxChat;
    prospect: CrmInboxProspect | null;
    notes: CrmNote[];
    lastOutboundStatus: CrmWhatsappMessage["status"] | null;
  } | null>(null);

  const isLoadingThread =
    activeJid !== null && loaded?.remoteJid !== activeJid;

  // Realtime na lista: prévia, unread e avatar atualizam sem reload.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("crm-whatsapp-inbox")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crm_whatsapp_chats",
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as Record<string, unknown> | null;
          if (!row?.remote_jid) return;

          if (payload.eventType === "DELETE") {
            setChats((prev) =>
              prev.filter((chat) => chat.remoteJid !== row.remote_jid),
            );
            return;
          }

          const nextPartial: Partial<CrmInboxChat> & { remoteJid: string } = {
            remoteJid: row.remote_jid as string,
            pushName: (row.push_name as string | null) ?? null,
            profileName: (row.profile_name as string | null) ?? null,
            profilePictureUrl: (row.profile_picture_url as string | null) ?? null,
            profileStatus: (row.profile_status as string | null) ?? null,
            lastMessageAt: (row.last_message_at as string | null) ?? null,
            lastMessagePreview: (row.last_message_preview as string | null) ?? null,
            unreadCount: (row.unread_count as number) ?? 0,
            inboxNote: (row.inbox_note as string | null) ?? null,
          };

          setChats((prev) => {
            const idx = prev.findIndex((c) => c.remoteJid === nextPartial.remoteJid);
            if (idx < 0) {
              return [
                {
                  ...nextPartial,
                  client: null,
                } as CrmInboxChat,
                ...prev,
              ];
            }
            const next = [...prev];
            next[idx] = { ...next[idx], ...nextPartial };
            next.sort((a, b) => {
              const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
              const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
              return bTime - aTime;
            });
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!activeJid) return;

    let cancelled = false;

    getCrmWhatsappThreadByJid(activeJid)
      .then((thread) => {
        if (cancelled) return;
        setLoaded({
          remoteJid: thread.remoteJid,
          messages: thread.messages,
        });
        setChats((prev) =>
          prev.map((chat) =>
            chat.remoteJid === activeJid
              ? { ...chat, unreadCount: 0 }
              : chat,
          ),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded({ remoteJid: activeJid, messages: [] });
      });

    getCrmInboxChatContext(activeJid)
      .then((result) => {
        if (cancelled || !result.chat) return;
        const enriched = result.chat;
        setContext({
          chat: enriched,
          prospect: result.prospect,
          notes: result.notes,
          lastOutboundStatus: result.lastOutboundStatus,
        });
        setChats((prev) =>
          prev.map((chat) =>
            chat.remoteJid === activeJid
              ? {
                  ...chat,
                  ...enriched,
                  client: enriched.client ?? chat.client,
                }
              : chat,
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setContext(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activeJid]);

  const counts = useMemo(() => {
    const byStage = Object.fromEntries(
      STAGE_COLUMNS.map((stage) => [stage, 0]),
    ) as Record<CrmStage, number>;
    let unread = 0;
    let unlinked = 0;

    for (const chat of chats) {
      if (chat.unreadCount > 0) unread += 1;
      if (!chat.client) {
        unlinked += 1;
        continue;
      }
      byStage[chat.client.stage] += 1;
    }

    return { byStage, unread, unlinked, total: chats.length };
  }, [chats]);

  const visibleChats = useMemo(() => {
    const term = query.trim().toLowerCase();
    return chats.filter((chat) => {
      if (filter === "unread" && chat.unreadCount === 0) return false;
      if (filter === "unlinked" && chat.client) return false;
      if (
        filter !== "all" &&
        filter !== "unread" &&
        filter !== "unlinked" &&
        chat.client?.stage !== filter
      ) {
        return false;
      }
      if (!term) return true;
      const haystack = [
        chat.client?.name,
        chat.client?.company,
        chat.profileName,
        chat.pushName,
        chat.remoteJid,
        chat.lastMessagePreview,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [chats, filter, query]);

  const activeChat =
    activeJid ? (chats.find((chat) => chat.remoteJid === activeJid) ?? null) : null;

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "Todas", count: counts.total },
    { id: "unread", label: "Não lidas", count: counts.unread },
    ...STAGE_COLUMNS.map((stage) => ({
      id: stage as Filter,
      label: STAGE_LABELS[stage],
      count: counts.byStage[stage],
    })),
    { id: "unlinked", label: "Sem cliente", count: counts.unlinked },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((item) => {
          const active = filter === item.id;
          const stageAccent =
            item.id !== "all" &&
            item.id !== "unread" &&
            item.id !== "unlinked"
              ? STAGE_ACCENT[item.id]
              : null;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors",
                active
                  ? "bg-[var(--insyt-black)] text-white"
                  : stageAccent
                    ? cn(stageAccent.pillBg, stageAccent.pillText, "hover:opacity-90")
                    : "bg-[var(--insyt-canvas)] text-[var(--insyt-slate)] hover:bg-[var(--insyt-canvas-alt)]",
              )}
            >
              {item.label}
              <span
                className={cn(
                  "tabular-nums",
                  active ? "text-white/70" : "opacity-70",
                )}
              >
                {item.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="insyt-card grid min-h-[640px] overflow-hidden lg:grid-cols-[20rem_minmax(0,1fr)_18rem]">
        <aside className="flex min-h-[280px] flex-col border-b border-[var(--insyt-border)] lg:min-h-0 lg:border-b-0 lg:border-r">
          <div className="border-b border-[var(--insyt-border)] p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--insyt-muted)]" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar conversa..."
                aria-label="Buscar conversa"
                className="w-full rounded-xl border border-transparent bg-[var(--insyt-canvas)] py-2.5 pl-9 pr-3 text-sm outline-none transition-all placeholder:text-[var(--insyt-muted)] focus:border-[var(--insyt-primary)]/40 focus:bg-white focus:ring-4 focus:ring-[var(--insyt-primary)]/10"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {visibleChats.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
                <MessageCircle className="size-7 text-[var(--insyt-muted)]" />
                <p className="text-sm text-[var(--insyt-slate)]">
                  {chats.length === 0
                    ? "Nenhuma conversa ainda."
                    : "Nenhuma conversa com esse filtro."}
                </p>
              </div>
            ) : (
              visibleChats.map((chat) => {
                const name = displayName(chat);
                const selected = chat.remoteJid === activeJid;
                const hasUnread = chat.unreadCount > 0;

                return (
                  <button
                    key={chat.remoteJid}
                    type="button"
                    onClick={() => setActiveJid(chat.remoteJid)}
                    className={cn(
                      "flex w-full items-start gap-3 border-b border-[var(--insyt-border)]/70 px-3.5 py-3.5 text-left transition-colors",
                      selected
                        ? "bg-[var(--accent)]"
                        : "hover:bg-[var(--insyt-canvas)]",
                    )}
                  >
                    <Avatar
                      name={name}
                      src={chat.profilePictureUrl}
                      unread={hasUnread}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p
                          className={cn(
                            "truncate text-sm",
                            hasUnread
                              ? "font-bold text-[var(--insyt-black)]"
                              : "font-semibold text-[var(--insyt-black)]",
                          )}
                        >
                          {name}
                        </p>
                        <span className="shrink-0 text-[10px] tabular-nums text-[var(--insyt-muted)]">
                          {formatChatTime(chat.lastMessageAt)}
                        </span>
                      </div>

                      <div className="mt-0.5 flex items-center gap-2">
                        <p
                          className={cn(
                            "min-w-0 flex-1 truncate text-xs",
                            hasUnread
                              ? "font-medium text-[var(--insyt-slate)]"
                              : "text-[var(--insyt-muted)]",
                          )}
                        >
                          {chat.lastMessagePreview ?? "Sem mensagens"}
                        </p>
                        {hasUnread ? (
                          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--insyt-primary)] text-[10px] font-bold text-white">
                            {chat.unreadCount > 9 ? "9+" : chat.unreadCount}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {chat.client ? (
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                              STAGE_ACCENT[chat.client.stage].pillBg,
                              STAGE_ACCENT[chat.client.stage].pillText,
                            )}
                          >
                            {STAGE_LABELS[chat.client.stage]}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-[var(--insyt-canvas-alt)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--insyt-muted)]">
                            Sem cliente
                          </span>
                        )}
                        {chat.client?.value ? (
                          <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold tabular-nums text-[var(--accent-foreground)]">
                            {currencyFormatter.format(chat.client.value)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="flex min-h-[420px] flex-col border-b border-[var(--insyt-border)] lg:min-h-0 lg:border-b-0 lg:border-r">
          {activeChat ? (
            <>
              <header className="flex items-center justify-between gap-3 border-b border-[var(--insyt-border)] px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar
                    name={displayName(activeChat)}
                    src={activeChat.profilePictureUrl}
                    size="md"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold text-[var(--insyt-black)]">
                      {displayName(activeChat)}
                    </p>
                    <p className="truncate text-sm text-[var(--insyt-muted)]">
                      {activeChat.profileStatus ||
                        activeChat.client?.company ||
                        activeChat.client?.phone ||
                        activeChat.remoteJid.replace("@s.whatsapp.net", "")}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {activeChat.client ? (
                    <>
                      <span
                        className={cn(
                          "hidden rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide sm:inline-flex",
                          STAGE_ACCENT[activeChat.client.stage].pillBg,
                          STAGE_ACCENT[activeChat.client.stage].pillText,
                        )}
                      >
                        {STAGE_LABELS[activeChat.client.stage]}
                      </span>
                      <Link
                        href={`/crm/${activeChat.client.id}`}
                        className="inline-flex items-center gap-1 rounded-xl border border-[var(--insyt-border)] px-3 py-2 text-xs font-medium text-[var(--insyt-slate)] transition-colors hover:bg-[var(--insyt-canvas)] hover:text-[var(--insyt-black)]"
                      >
                        Abrir ficha
                        <ExternalLink className="size-3" />
                      </Link>
                    </>
                  ) : null}
                </div>
              </header>

              {isLoadingThread || !loaded ? (
                <div className="flex flex-1 items-center justify-center gap-2 text-sm text-[var(--insyt-muted)]">
                  <Loader2 className="size-4 animate-spin" />
                  Carregando conversa...
                </div>
              ) : (
                <CrmWhatsappThread
                  key={activeChat.remoteJid}
                  clientId={activeChat.client?.id}
                  remoteJid={loaded.remoteJid}
                  initialMessages={loaded.messages}
                  layout="inbox"
                  onMessageSent={(preview) => {
                    setChats((prev) => {
                      const next = prev.map((chat) =>
                        chat.remoteJid === activeChat.remoteJid
                          ? {
                              ...chat,
                              lastMessagePreview: preview.slice(0, 140),
                              lastMessageAt: new Date().toISOString(),
                              unreadCount: 0,
                            }
                          : chat,
                      );
                      next.sort((a, b) => {
                        const aTime = a.lastMessageAt
                          ? new Date(a.lastMessageAt).getTime()
                          : 0;
                        const bTime = b.lastMessageAt
                          ? new Date(b.lastMessageAt).getTime()
                          : 0;
                        return bTime - aTime;
                      });
                      return next;
                    });
                  }}
                />
              )}
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
              <MessageCircle className="size-8 text-[var(--insyt-muted)]" />
              <p className="font-semibold text-[var(--insyt-black)]">
                Selecione uma conversa
              </p>
              <p className="text-sm text-[var(--insyt-slate)]">
                As mensagens do WhatsApp aparecem aqui em tempo real.
              </p>
            </div>
          )}
        </section>

        <InboxDetailsPanel
          activeChat={activeChat}
          context={context}
          onNoteSaved={(note) => {
            if (!activeChat) return;
            setChats((prev) =>
              prev.map((chat) =>
                chat.remoteJid === activeChat.remoteJid
                  ? { ...chat, inboxNote: note }
                  : chat,
              ),
            );
            setContext((prev) =>
              prev
                ? { ...prev, chat: { ...prev.chat, inboxNote: note } }
                : prev,
            );
          }}
          onClientNoteAdded={(note) => {
            setContext((prev) =>
              prev ? { ...prev, notes: [note, ...prev.notes] } : prev,
            );
          }}
          onClientUpdated={(client) => {
            if (!activeChat) return;
            setChats((prev) =>
              prev.map((chat) =>
                chat.remoteJid === activeChat.remoteJid
                  ? { ...chat, client }
                  : chat,
              ),
            );
            setContext((prev) =>
              prev
                ? { ...prev, chat: { ...prev.chat, client } }
                : prev,
            );
          }}
        />
      </div>
    </div>
  );
}

function InboxDetailsPanel({
  activeChat,
  context,
  onNoteSaved,
  onClientNoteAdded,
  onClientUpdated,
}: {
  activeChat: CrmInboxChat | null;
  context: {
    chat: CrmInboxChat;
    prospect: CrmInboxProspect | null;
    notes: CrmNote[];
    lastOutboundStatus: CrmWhatsappMessage["status"] | null;
  } | null;
  onNoteSaved: (note: string | null) => void;
  onClientNoteAdded: (note: CrmNote) => void;
  onClientUpdated: (client: NonNullable<CrmInboxChat["client"]>) => void;
}) {
  const [inboxNote, setInboxNote] = useState("");
  const [clientNote, setClientNote] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [dealSource, setDealSource] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setInboxNote(context?.chat.inboxNote ?? activeChat?.inboxNote ?? "");
    setClientNote("");
    const client = context?.chat.client ?? activeChat?.client;
    setDealValue(client?.value != null ? String(client.value) : "");
    setDealSource(client?.source ?? "");
  }, [
    activeChat?.remoteJid,
    context?.chat.inboxNote,
    activeChat?.inboxNote,
    context?.chat.client,
    activeChat?.client,
  ]);

  if (!activeChat) {
    return (
      <aside className="hidden flex-col bg-[var(--insyt-canvas)]/40 p-5 lg:flex">
        <p className="text-sm text-[var(--insyt-muted)]">
          Detalhes do contato aparecem ao abrir uma conversa.
        </p>
      </aside>
    );
  }

  const name = displayName(activeChat);
  const prospect = context?.prospect ?? null;
  const lastStatus = context?.lastOutboundStatus ?? null;
  const phone = activeChat.remoteJid.replace("@s.whatsapp.net", "");

  return (
    <aside className="flex min-h-[280px] flex-col overflow-y-auto bg-[var(--insyt-canvas)]/30 p-5 lg:min-h-0">
      <div className="flex flex-col items-center gap-3 border-b border-[var(--insyt-border)] pb-5 text-center">
        <Avatar
          name={name}
          src={activeChat.profilePictureUrl}
          size="lg"
        />
        <div className="min-w-0">
          <p className="truncate font-bold text-[var(--insyt-black)]">{name}</p>
          <p className="text-xs tabular-nums text-[var(--insyt-muted)]">{phone}</p>
          {activeChat.profileStatus ? (
            <p className="mt-1 text-xs italic text-[var(--insyt-slate)]">
              “{activeChat.profileStatus}”
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-5 py-5">
        <section className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--insyt-muted)]">
            Status da mensagem
          </p>
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm">
            {lastStatus === "read" || lastStatus === "played" ? (
              <CheckCheck className="size-4 text-sky-500" />
            ) : lastStatus === "delivery_ack" ? (
              <CheckCheck className="size-4 text-[var(--insyt-muted)]" />
            ) : (
              <Check className="size-4 text-[var(--insyt-muted)]" />
            )}
            <span className="font-medium text-[var(--insyt-black)]">
              {statusLabel(lastStatus)}
            </span>
          </div>
          <p className="text-[11px] text-[var(--insyt-muted)]">
            Última mensagem sua · ticks atualizam em tempo real
          </p>
        </section>

        {activeChat.client ? (
          <section className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--insyt-muted)]">
              Negociação
            </p>

            <div className="space-y-1.5 rounded-xl bg-white p-3">
              <label
                htmlFor="inbox-deal-value"
                className="text-xs font-medium text-[var(--insyt-slate)]"
              >
                Valor em negociação
              </label>
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--insyt-muted)]">
                    R$
                  </span>
                  <Input
                    id="inbox-deal-value"
                    inputMode="decimal"
                    value={dealValue}
                    onChange={(event) =>
                      setDealValue(event.target.value.replace(/[^\d.,]/g, ""))
                    }
                    placeholder="0"
                    className="pl-9 tabular-nums"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    const client = activeChat.client!;
                    const parsed = dealValue
                      .replace(/\./g, "")
                      .replace(",", ".");
                    const value =
                      dealValue.trim() === ""
                        ? null
                        : Number(parsed);
                    if (value != null && Number.isNaN(value)) {
                      toast.error("Valor inválido.");
                      return;
                    }
                    startTransition(async () => {
                      const result = await updateCrmClient(client.id, { value });
                      if (result.error) {
                        toast.error(result.error);
                        return;
                      }
                      onClientUpdated({ ...client, value });
                      toast.success("Valor atualizado");
                    });
                  }}
                >
                  Salvar
                </Button>
              </div>
              {activeChat.client.value != null ? (
                <p className="text-xs font-semibold tabular-nums text-[var(--insyt-primary-dark)]">
                  {currencyFormatter.format(activeChat.client.value)}
                </p>
              ) : (
                <p className="text-[11px] text-[var(--insyt-muted)]">
                  Ainda sem valor no funil
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[var(--insyt-slate)]">
                Estágio no funil
              </p>
              <div className="flex flex-wrap gap-1.5">
                {STAGE_COLUMNS.map((stage) => {
                  const active = activeChat.client!.stage === stage;
                  return (
                    <button
                      key={stage}
                      type="button"
                      disabled={isPending || active}
                      onClick={() => {
                        const client = activeChat.client!;
                        startTransition(async () => {
                          const result = await updateCrmClientStage(
                            client.id,
                            stage,
                          );
                          if (result.error) {
                            toast.error(result.error);
                            return;
                          }
                          onClientUpdated({ ...client, stage });
                          toast.success(`Movido para ${STAGE_LABELS[stage]}`);
                        });
                      }}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors",
                        active
                          ? cn(
                              STAGE_ACCENT[stage].pillBg,
                              STAGE_ACCENT[stage].pillText,
                              "ring-1 ring-[var(--insyt-border)]",
                            )
                          : "bg-white text-[var(--insyt-muted)] hover:bg-[var(--insyt-canvas-alt)] hover:text-[var(--insyt-slate)]",
                      )}
                    >
                      {STAGE_LABELS[stage]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="inbox-deal-source"
                className="text-xs font-medium text-[var(--insyt-slate)]"
              >
                Origem
              </label>
              <div className="flex gap-2">
                <Input
                  id="inbox-deal-source"
                  value={dealSource}
                  onChange={(event) => setDealSource(event.target.value)}
                  placeholder="Indicação, Instagram, Google..."
                  className="bg-white"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => {
                    const client = activeChat.client!;
                    const source = dealSource.trim() || null;
                    startTransition(async () => {
                      const result = await updateCrmClient(client.id, {
                        source,
                      });
                      if (result.error) {
                        toast.error(result.error);
                        return;
                      }
                      onClientUpdated({ ...client, source });
                      toast.success("Origem salva");
                    });
                  }}
                >
                  OK
                </Button>
              </div>
            </div>

            {(activeChat.client.company || activeChat.client.email) && (
              <div className="space-y-1 text-xs text-[var(--insyt-muted)]">
                {activeChat.client.company ? (
                  <p>{activeChat.client.company}</p>
                ) : null}
                {activeChat.client.email ? (
                  <p className="truncate">{activeChat.client.email}</p>
                ) : null}
              </div>
            )}
          </section>
        ) : (
          <section className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--insyt-muted)]">
              Negociação
            </p>
            <p className="text-xs text-[var(--insyt-muted)]">
              Vincule um cliente CRM para registrar valor, estágio e origem.
            </p>
          </section>
        )}

        <section className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--insyt-muted)]">
            Prospecção
          </p>
          {prospect ? (
            <div className="space-y-2 rounded-xl bg-white p-3 text-sm">
              <p className="font-semibold text-[var(--insyt-black)]">
                {prospect.name}
              </p>
              <p className="text-xs text-[var(--insyt-muted)]">
                {prospect.niche} · {prospect.city}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                    prospect.website
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-[var(--accent)] text-[var(--accent-foreground)]",
                  )}
                >
                  {prospect.website ? "Tem site" : "Sem site"}
                </span>
                {prospect.rating != null ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--insyt-canvas-alt)] px-2 py-0.5 text-[10px] font-semibold text-[var(--insyt-slate)]">
                    <Star className="size-3" />
                    {prospect.rating}
                  </span>
                ) : null}
              </div>
              {prospect.website ? (
                <a
                  href={prospect.website}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-[var(--insyt-primary)] hover:underline"
                >
                  <Globe className="size-3.5" />
                  {prospect.website.replace(/^https?:\/\//, "")}
                </a>
              ) : null}
              {prospect.address ? (
                <p className="flex items-start gap-1.5 text-xs text-[var(--insyt-muted)]">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" />
                  {prospect.address}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-[var(--insyt-muted)]">
              Nenhum lead de prospecção com este telefone.
            </p>
          )}
        </section>

        <section className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--insyt-muted)]">
            Nota rápida
          </p>
          <Textarea
            rows={3}
            value={inboxNote}
            onChange={(event) => setInboxNote(event.target.value)}
            placeholder="Anotação desta conversa..."
            className="bg-white text-sm"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                const result = await updateCrmInboxNote(
                  activeChat.remoteJid,
                  inboxNote,
                );
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                onNoteSaved(inboxNote.trim() || null);
                toast.success("Nota salva");
              });
            }}
          >
            Salvar nota
          </Button>
        </section>

        {activeChat.client ? (
          <section className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--insyt-muted)]">
              Anotações do cliente
            </p>
            <Textarea
              rows={2}
              value={clientNote}
              onChange={(event) => setClientNote(event.target.value)}
              placeholder="Registrar observação na ficha..."
              className="bg-white text-sm"
            />
            <Button
              type="button"
              size="sm"
              disabled={isPending || !clientNote.trim()}
              onClick={() => {
                const body = clientNote.trim();
                const clientId = activeChat.client!.id;
                startTransition(async () => {
                  const result = await createCrmNote(clientId, body);
                  if (result.error) {
                    toast.error(result.error);
                    return;
                  }
                  onClientNoteAdded({
                    id: crypto.randomUUID(),
                    client_id: clientId,
                    body,
                    created_at: new Date().toISOString(),
                  });
                  setClientNote("");
                  toast.success("Anotação registrada");
                });
              }}
            >
              Registrar
            </Button>
            <div className="space-y-2">
              {(context?.notes ?? []).slice(0, 4).map((note) => (
                <div
                  key={note.id}
                  className="rounded-xl border-l-2 border-[var(--insyt-primary)]/30 bg-white p-2.5 pl-3"
                >
                  <p className="text-xs whitespace-pre-wrap text-[var(--insyt-black)]">
                    {note.body}
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--insyt-muted)]">
                    {format(new Date(note.created_at), "dd MMM HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </aside>
  );
}
