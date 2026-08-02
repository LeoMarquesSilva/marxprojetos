"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { MessageCircle, Search, UserPlus, Users, X } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CrmClientCard, CrmClientCardStatic } from "@/components/crm-client-card";
import { CrmNewClientSheet } from "@/components/crm-new-client-sheet";
import { CrmWhatsappSheet } from "@/components/crm-whatsapp-sheet";
import { updateCrmClientStage } from "@/app/actions/crm";
import { cn } from "@/lib/utils";
import {
  OPEN_STAGES,
  STAGE_ACCENT,
  STAGE_COLUMNS,
  STAGE_LABELS,
  type CrmBoardClient,
  type CrmStage,
} from "@/types/crm";

const compactCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

function sumValues(clients: CrmBoardClient[]) {
  return clients.reduce((total, client) => total + (client.value ?? 0), 0);
}

export function CrmBoard({ initialClients }: { initialClients: CrmBoardClient[] }) {
  const [clients, setClients] = useState(initialClients);
  const [mounted, setMounted] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [chatClient, setChatClient] = useState<CrmBoardClient | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  useEffect(() => {
    // Client-only mount flag: @dnd-kit's internal accessibility ids come
    // from a global counter that drifts between SSR and hydration, so the
    // drag-enabled tree is only rendered after mount (see CrmClientCardStatic).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const unreadTotal = useMemo(
    () => clients.filter((client) => (client.chat?.unreadCount ?? 0) > 0).length,
    [clients],
  );

  const pipelineTotal = useMemo(
    () => sumValues(clients.filter((client) => OPEN_STAGES.includes(client.stage))),
    [clients],
  );

  const openCount = useMemo(
    () => clients.filter((client) => OPEN_STAGES.includes(client.stage)).length,
    [clients],
  );

  const visibleClients = useMemo(() => {
    const term = query.trim().toLowerCase();
    return clients.filter((client) => {
      if (onlyUnread && (client.chat?.unreadCount ?? 0) === 0) return false;
      if (!term) return true;
      return (
        client.name.toLowerCase().includes(term) ||
        (client.company ?? "").toLowerCase().includes(term)
      );
    });
  }, [clients, query, onlyUnread]);

  const isFiltering = query.trim().length > 0 || onlyUnread;
  const boardEmpty = clients.length === 0;
  const filterEmpty = !boardEmpty && visibleClients.length === 0;

  function moveClient(clientId: string, destStage: CrmStage) {
    const prevStage = clients.find((c) => c.id === clientId)?.stage;
    if (!prevStage || prevStage === destStage) return;

    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, stage: destStage } : c)),
    );

    startTransition(async () => {
      const result = await updateCrmClientStage(clientId, destStage);
      if (result.error) {
        toast.error(result.error);
        setClients((prev) =>
          prev.map((c) => (c.id === clientId ? { ...c, stage: prevStage } : c)),
        );
      }
    });
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const destStage = (STAGE_COLUMNS as string[]).includes(overId)
      ? (overId as CrmStage)
      : clients.find((c) => c.id === overId)?.stage;

    if (!destStage) return;
    moveClient(activeId, destStage);
  }

  // Abrir a conversa zera o contador de não lidas no servidor; refletimos
  // isso no board na hora para o card não continuar destacado.
  function openChat(client: CrmBoardClient) {
    setChatClient(client);
    setClients((prev) =>
      prev.map((c) =>
        c.id === client.id && c.chat
          ? { ...c, chat: { ...c.chat, unreadCount: 0 } }
          : c,
      ),
    );
  }

  const activeClient = activeId ? clients.find((c) => c.id === activeId) : undefined;

  return (
    <div className="space-y-6">
      <div className="insyt-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        <div className="flex shrink-0 items-center gap-6 border-[var(--insyt-border)] sm:border-r sm:pr-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--insyt-muted)]">
              Em negociação
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-[var(--insyt-black)]">
              {compactCurrency.format(pipelineTotal)}
            </p>
            <p className="mt-0.5 text-xs text-[var(--insyt-muted)]">
              {openCount} {openCount === 1 ? "oportunidade" : "oportunidades"}
            </p>
          </div>
        </div>

        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--insyt-muted)]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome ou empresa..."
            aria-label="Buscar cliente"
            className="w-full rounded-xl border border-[var(--insyt-border)] bg-[var(--insyt-canvas)] py-2.5 pl-10 pr-3 text-sm outline-none transition-all placeholder:text-[var(--insyt-muted)] hover:bg-white focus:border-[var(--insyt-primary)]/40 focus:bg-white focus:ring-4 focus:ring-[var(--insyt-primary)]/10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlyUnread((value) => !value)}
            aria-pressed={onlyUnread}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
              onlyUnread
                ? "bg-[var(--insyt-primary)] text-white shadow-sm"
                : "border border-[var(--insyt-border)] bg-white text-[var(--insyt-slate)] hover:bg-[var(--insyt-canvas)]",
            )}
          >
            <MessageCircle className="size-4" />
            <span className="hidden sm:inline">Aguardando</span>
            {unreadTotal > 0 ? (
              <span
                className={cn(
                  "flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold",
                  onlyUnread
                    ? "bg-white/25 text-white"
                    : "bg-[var(--insyt-primary)] text-white",
                )}
              >
                {unreadTotal}
              </span>
            ) : null}
          </button>

          {isFiltering ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setOnlyUnread(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm text-[var(--insyt-muted)] transition-colors hover:text-[var(--insyt-black)]"
            >
              <X className="size-3.5" />
              Limpar
            </button>
          ) : null}

          <CrmNewClientSheet />
        </div>
      </div>

      {boardEmpty ? (
        <div className="insyt-card flex flex-col items-center gap-3 px-6 py-20 text-center">
          <Users className="size-8 text-[var(--insyt-muted)]" />
          <div className="space-y-1">
            <p className="font-semibold text-[var(--insyt-black)]">
              Nenhum cliente no funil
            </p>
            <p className="text-sm text-[var(--insyt-slate)]">
              Cadastre o primeiro lead para começar a acompanhar o pipeline.
            </p>
          </div>
          <CrmNewClientSheet />
        </div>
      ) : filterEmpty ? (
        <div className="insyt-card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <Search className="size-8 text-[var(--insyt-muted)]" />
          <p className="text-[var(--insyt-slate)]">
            Nenhum cliente com esse filtro.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOnlyUnread(false);
            }}
            className="text-sm font-medium text-[var(--insyt-primary)] hover:underline"
          >
            Limpar filtros
          </button>
        </div>
      ) : mounted ? (
        <DndContext
          id="crm-board"
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="flex gap-3 overflow-x-auto pb-2">
            {STAGE_COLUMNS.map((stage) => (
              <CrmColumn
                key={stage}
                stage={stage}
                clients={visibleClients.filter((c) => c.stage === stage)}
                isFiltering={isFiltering}
                onMove={moveClient}
                onOpenChat={openChat}
              />
            ))}
          </div>

          <DragOverlay>
            {activeClient ? (
              <div className="w-[18.5rem] rotate-1 shadow-2xl">
                <CrmClientCardStatic client={activeClient} onMove={() => {}} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {STAGE_COLUMNS.map((stage) => (
            <CrmColumnStatic
              key={stage}
              stage={stage}
              clients={visibleClients.filter((c) => c.stage === stage)}
              isFiltering={isFiltering}
              onMove={moveClient}
            />
          ))}
        </div>
      )}

      <CrmWhatsappSheet
        client={chatClient}
        onOpenChange={(open) => {
          if (!open) setChatClient(null);
        }}
      />
    </div>
  );
}

function ColumnHeader({
  stage,
  clients,
}: {
  stage: CrmStage;
  clients: CrmBoardClient[];
}) {
  const total = sumValues(clients);
  const accent = STAGE_ACCENT[stage];

  return (
    <div className="space-y-3">
      <span className={cn("block h-0.5 w-10 rounded-full", accent.bar)} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-[var(--insyt-black)]">
              {STAGE_LABELS[stage]}
            </h3>
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                accent.pillBg,
                accent.pillText,
              )}
            >
              {clients.length}
            </span>
          </div>
          {total > 0 ? (
            <p className="text-xs font-medium tabular-nums text-[var(--insyt-muted)]">
              {compactCurrency.format(total)}
            </p>
          ) : (
            <p className="text-xs text-[var(--insyt-muted)]">Sem valor</p>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyColumn({ isFiltering }: { isFiltering: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--insyt-border)] px-3 py-14 text-center">
      <UserPlus className="size-5 text-[var(--insyt-muted)]" />
      <p className="text-xs leading-relaxed text-[var(--insyt-muted)]">
        {isFiltering ? "Nada com esse filtro" : "Solte um cliente aqui"}
      </p>
    </div>
  );
}

const COLUMN_CLASS =
  "flex min-h-[320px] w-[18.5rem] shrink-0 flex-col gap-3.5 rounded-2xl border border-[var(--insyt-border)]/70 bg-[var(--insyt-canvas)]/80 p-3.5 transition-all";

function CrmColumnStatic({
  stage,
  clients,
  isFiltering,
  onMove,
}: {
  stage: CrmStage;
  clients: CrmBoardClient[];
  isFiltering: boolean;
  onMove: (clientId: string, stage: CrmStage) => void;
}) {
  return (
    <div className={COLUMN_CLASS}>
      <ColumnHeader stage={stage} clients={clients} />
      <div className="flex flex-1 flex-col gap-2.5">
        {clients.map((client) => (
          <CrmClientCardStatic
            key={client.id}
            client={client}
            onMove={(s) => onMove(client.id, s)}
          />
        ))}
        {clients.length === 0 ? <EmptyColumn isFiltering={isFiltering} /> : null}
      </div>
    </div>
  );
}

function CrmColumn({
  stage,
  clients,
  isFiltering,
  onMove,
  onOpenChat,
}: {
  stage: CrmStage;
  clients: CrmBoardClient[];
  isFiltering: boolean;
  onMove: (clientId: string, stage: CrmStage) => void;
  onOpenChat: (client: CrmBoardClient) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        COLUMN_CLASS,
        isOver &&
          "border-[var(--insyt-primary)]/30 bg-[var(--accent)] ring-2 ring-[var(--insyt-primary)]/15",
      )}
    >
      <ColumnHeader stage={stage} clients={clients} />

      <SortableContext
        items={clients.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-1 flex-col gap-2.5">
          {clients.map((client, index) => (
            <CrmClientCard
              key={client.id}
              client={client}
              index={index}
              onMove={(s) => onMove(client.id, s)}
              onOpenChat={() => onOpenChat(client)}
            />
          ))}
          {clients.length === 0 ? <EmptyColumn isFiltering={isFiltering} /> : null}
        </div>
      </SortableContext>
    </div>
  );
}
