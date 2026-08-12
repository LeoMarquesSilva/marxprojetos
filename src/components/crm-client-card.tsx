"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, formatDistanceToNowStrict, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarClock,
  FileText,
  GripVertical,
  MessageCircle,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { classifyNextStep } from "@/lib/flow-utils";
import {
  STAGE_COLUMNS,
  STAGE_LABELS,
  type CrmBoardClient,
  type CrmStage,
} from "@/types/crm";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0]?.slice(0, 2);
  return (initials ?? "").toUpperCase();
}

function CrmClientCardContent({
  client,
  onMove,
  onOpenChat,
  dragHandle,
}: {
  client: CrmBoardClient;
  onMove: (stage: CrmStage) => void;
  onOpenChat?: () => void;
  dragHandle?: React.ReactNode;
}) {
  const chat = client.chat;
  const hasUnread = (chat?.unreadCount ?? 0) > 0;
  const nextStepDate = client.next_step_at
    ? new Date(client.next_step_at)
    : null;
  const nextStepTiming = classifyNextStep(client.next_step_at);

  return (
    <>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
            hasUnread
              ? "bg-[var(--insyt-primary)] text-white"
              : "bg-[var(--insyt-canvas-alt)] text-[var(--insyt-primary)]",
          )}
        >
          {initialsOf(client.name)}
        </span>

        <div className="min-w-0 flex-1 pt-0.5">
          <Link
            href={`/crm/${client.id}`}
            className="block truncate text-sm font-semibold leading-snug text-[var(--insyt-black)] hover:text-[var(--insyt-primary)]"
          >
            {client.name}
          </Link>
          {client.company ? (
            <p className="mt-0.5 truncate text-xs text-[var(--insyt-muted)]">
              {client.company}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {dragHandle}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label={`Ações de ${client.name}`}
                  className="rounded-md p-1 text-[var(--insyt-muted)] transition-colors hover:bg-[var(--insyt-canvas)] hover:text-[var(--insyt-black)]"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              }
            />
            <DropdownMenuContent align="end">
              {onOpenChat ? (
                <>
                  <DropdownMenuItem onClick={onOpenChat}>
                    Abrir conversa
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              {STAGE_COLUMNS.filter((s) => s !== client.stage).map((s) => (
                <DropdownMenuItem key={s} onClick={() => onMove(s)}>
                  Mover para {STAGE_LABELS[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {client.value || client.project_id ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {client.value ? (
            <span className="rounded-md bg-[var(--accent)] px-2 py-1 text-xs font-bold tabular-nums text-[var(--accent-foreground)]">
              {currencyFormatter.format(client.value)}
            </span>
          ) : null}
          {client.project_id ? (
            <span className="flex items-center gap-1 rounded-md bg-[var(--insyt-canvas-alt)] px-2 py-1 text-xs font-medium text-[var(--insyt-slate)]">
              <FileText className="size-3" />
              Briefing
            </span>
          ) : null}
        </div>
      ) : null}

      {client.next_step ? (
        <div
          className={cn(
            "flex items-start gap-2 rounded-xl border px-2.5 py-2",
            nextStepTiming === "overdue"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-[var(--insyt-border)] bg-[var(--insyt-canvas)] text-[var(--insyt-slate)]",
          )}
        >
          <CalendarClock className="mt-0.5 size-3.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{client.next_step}</p>
            {nextStepDate && isValid(nextStepDate) ? (
              <p className="mt-0.5 text-[10px] font-medium">
                {nextStepTiming === "overdue" ? "Atrasado" : "Próximo"} ·{" "}
                {format(nextStepDate, "dd 'de' MMM", { locale: ptBR })}
              </p>
            ) : (
              <p className="mt-0.5 text-[10px]">Próximo passo</p>
            )}
          </div>
        </div>
      ) : null}

      {/* Prévia da última mensagem: contexto suficiente para decidir se abre
          a conversa. Renderiza também na variante estática (pré-hidratação)
          para o bloco não aparecer só depois e empurrar o layout. */}
      {chat ? <ChatPreviewRow chat={chat} onOpenChat={onOpenChat} /> : null}
    </>
  );
}

function ChatPreviewRow({
  chat,
  onOpenChat,
}: {
  chat: NonNullable<CrmBoardClient["chat"]>;
  onOpenChat?: () => void;
}) {
  const hasUnread = chat.unreadCount > 0;

  const inner = (
    <>
      <MessageCircle
        className={cn(
          "size-3.5 shrink-0",
          hasUnread ? "text-[var(--insyt-primary)]" : "text-[var(--insyt-muted)]",
        )}
      />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-xs",
          hasUnread
            ? "font-semibold text-[var(--insyt-black)]"
            : "text-[var(--insyt-muted)]",
        )}
      >
        {chat.lastMessagePreview ?? "Conversa iniciada"}
      </span>
      {hasUnread ? (
        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--insyt-primary)] text-[10px] font-bold text-white">
          {chat.unreadCount > 9 ? "9+" : chat.unreadCount}
        </span>
      ) : chat.lastMessageAt ? (
        <span className="shrink-0 text-[10px] tabular-nums text-[var(--insyt-muted)]">
          {formatDistanceToNowStrict(new Date(chat.lastMessageAt), { locale: ptBR })}
        </span>
      ) : null}
    </>
  );

  const className = cn(
    "flex w-full items-center gap-2 rounded-xl border border-transparent px-2.5 py-2 text-left",
    hasUnread
      ? "border-[var(--insyt-primary)]/10 bg-[var(--accent)]"
      : "bg-[var(--insyt-canvas)]",
  );

  if (!onOpenChat) {
    return <div className={className}>{inner}</div>;
  }

  return (
    <button
      type="button"
      onClick={onOpenChat}
      className={cn(
        className,
        "transition-colors",
        hasUnread
          ? "hover:bg-[#ffe9e0]"
          : "hover:border-[var(--insyt-border)] hover:bg-[var(--insyt-canvas-alt)]",
      )}
    >
      {inner}
    </button>
  );
}

// Variante não interativa: renderizada antes do mount para que o HTML do SSR
// nunca contenha os ids internos de aria-describedby do @dnd-kit (vêm de um
// contador global que muda a cada mount e causa erro de hidratação se o card
// já estiver arrastável). Também é o preview "levantado" do DragOverlay.
export function CrmClientCardStatic({
  client,
  onMove,
  onOpenChat,
}: {
  client: CrmBoardClient;
  onMove: (stage: CrmStage) => void;
  onOpenChat?: () => void;
}) {
  return (
    <div className="insyt-card flex flex-col gap-2.5 p-3.5">
      <CrmClientCardContent
        client={client}
        onMove={onMove}
        onOpenChat={onOpenChat}
      />
    </div>
  );
}

export function CrmClientCard({
  client,
  onMove,
  onOpenChat,
  index = 0,
}: {
  client: CrmBoardClient;
  onMove: (stage: CrmStage) => void;
  onOpenChat?: () => void;
  index?: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: client.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hasUnread = (client.chat?.unreadCount ?? 0) > 0;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: isDragging ? 0.4 : 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(index, 6) * 0.03, ease: "easeOut" }}
      whileHover={isDragging ? undefined : { y: -1 }}
      className={cn(
        "insyt-card group flex flex-col gap-2.5 p-3.5 transition-shadow hover:shadow-md",
        hasUnread && "ring-1 ring-[var(--insyt-primary)]/20",
      )}
    >
      <CrmClientCardContent
        client={client}
        onMove={onMove}
        onOpenChat={onOpenChat}
        dragHandle={
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none rounded-md p-1 text-[var(--insyt-muted)] opacity-40 transition-opacity hover:text-[var(--insyt-slate)] group-hover:opacity-100 active:cursor-grabbing sm:opacity-0"
            aria-label={`Arrastar ${client.name}`}
          >
            <GripVertical className="size-4" />
          </button>
        }
      />
    </motion.div>
  );
}
