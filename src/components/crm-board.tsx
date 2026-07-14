"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CrmClientCard, CrmClientCardStatic } from "@/components/crm-client-card";
import { CrmNewClientDialog } from "@/components/crm-new-client-dialog";
import { updateCrmClientStage } from "@/app/actions/crm";
import { STAGE_COLUMNS, STAGE_LABELS, type CrmClient, type CrmStage } from "@/types/crm";

export function CrmBoard({ initialClients }: { initialClients: CrmClient[] }) {
  const [clients, setClients] = useState(initialClients);
  const [mounted, setMounted] = useState(false);
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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const destStage = (
      STAGE_COLUMNS as string[]
    ).includes(overId)
      ? (overId as CrmStage)
      : clients.find((c) => c.id === overId)?.stage;

    if (!destStage) return;
    moveClient(activeId, destStage);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CrmNewClientDialog />
      </div>

      {mounted ? (
        <DndContext id="crm-board" sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="grid gap-4 lg:grid-cols-5">
            {STAGE_COLUMNS.map((stage) => (
              <CrmColumn
                key={stage}
                stage={stage}
                clients={clients.filter((c) => c.stage === stage)}
                onMove={moveClient}
              />
            ))}
          </div>
        </DndContext>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          {STAGE_COLUMNS.map((stage) => (
            <CrmColumnStatic
              key={stage}
              stage={stage}
              clients={clients.filter((c) => c.stage === stage)}
              onMove={moveClient}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CrmColumnStatic({
  stage,
  clients,
  onMove,
}: {
  stage: CrmStage;
  clients: CrmClient[];
  onMove: (clientId: string, stage: CrmStage) => void;
}) {
  return (
    <div className="flex min-h-[200px] flex-col gap-3 rounded-2xl border border-[var(--insyt-border)] bg-[var(--insyt-canvas)] p-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--insyt-slate)]">
          {STAGE_LABELS[stage]}
        </h3>
        <span className="text-xs text-[var(--insyt-muted)]">{clients.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {clients.map((client) => (
          <CrmClientCardStatic
            key={client.id}
            client={client}
            onMove={(s) => onMove(client.id, s)}
          />
        ))}
        {clients.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--insyt-border)] px-3 py-6 text-center text-xs text-[var(--insyt-muted)]">
            Arraste um cliente para cá
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CrmColumn({
  stage,
  clients,
  onMove,
}: {
  stage: CrmStage;
  clients: CrmClient[];
  onMove: (clientId: string, stage: CrmStage) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[200px] flex-col gap-3 rounded-2xl border border-[var(--insyt-border)] bg-[var(--insyt-canvas)] p-3 transition-colors ${
        isOver ? "bg-[var(--insyt-canvas-alt)]" : ""
      }`}
    >
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--insyt-slate)]">
          {STAGE_LABELS[stage]}
        </h3>
        <span className="text-xs text-[var(--insyt-muted)]">{clients.length}</span>
      </div>

      <SortableContext
        items={clients.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-1 flex-col gap-2">
          {clients.map((client) => (
            <CrmClientCard
              key={client.id}
              client={client}
              onMove={(s) => onMove(client.id, s)}
            />
          ))}
          {clients.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--insyt-border)] px-3 py-6 text-center text-xs text-[var(--insyt-muted)]">
              Arraste um cliente para cá
            </p>
          ) : null}
        </div>
      </SortableContext>
    </div>
  );
}
