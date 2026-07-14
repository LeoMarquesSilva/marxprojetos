"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Building2, FileText, GripVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STAGE_COLUMNS, STAGE_LABELS, type CrmClient, type CrmStage } from "@/types/crm";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

function CrmClientCardContent({
  client,
  onMove,
  dragHandle,
}: {
  client: CrmClient;
  onMove: (stage: CrmStage) => void;
  dragHandle?: React.ReactNode;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/crm/${client.id}`}
          className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--insyt-black)] hover:text-[var(--insyt-primary)]"
        >
          {client.name}
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          {dragHandle}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="rounded px-1 text-xs text-[var(--insyt-muted)] hover:text-[var(--insyt-slate)]"
                >
                  •••
                </button>
              }
            />
            <DropdownMenuContent align="end">
              {STAGE_COLUMNS.filter((s) => s !== client.stage).map((s) => (
                <DropdownMenuItem key={s} onClick={() => onMove(s)}>
                  Mover para {STAGE_LABELS[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {client.company ? (
        <p className="flex items-center gap-1.5 text-xs text-[var(--insyt-muted)]">
          <Building2 className="size-3.5 shrink-0" />
          <span className="truncate">{client.company}</span>
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        {client.value ? (
          <span className="text-xs font-semibold text-[var(--insyt-primary-dark)]">
            {currencyFormatter.format(client.value)}
          </span>
        ) : (
          <span />
        )}
        {client.project_id ? (
          <span className="flex items-center gap-1 rounded-full bg-[var(--insyt-canvas-alt)] px-2 py-0.5 text-[10px] text-[var(--insyt-slate)]">
            <FileText className="size-3" />
            Briefing
          </span>
        ) : null}
      </div>
    </>
  );
}

// Non-interactive variant: rendered before client-side mount so the SSR/CSR
// output never contains @dnd-kit's internal aria-describedby ids (they come
// from a global counter that drifts on every mount and causes a hydration
// mismatch if this card is drag-enabled before hydration settles).
export function CrmClientCardStatic({
  client,
  onMove,
}: {
  client: CrmClient;
  onMove: (stage: CrmStage) => void;
}) {
  return (
    <div className="insyt-card flex flex-col gap-2 border-none p-3 shadow-none ring-1 ring-[var(--insyt-border)]">
      <CrmClientCardContent client={client} onMove={onMove} />
    </div>
  );
}

export function CrmClientCard({
  client,
  onMove,
}: {
  client: CrmClient;
  onMove: (stage: CrmStage) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: client.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`insyt-card group flex flex-col gap-2 border-none p-3 shadow-none ring-1 ring-[var(--insyt-border)] transition-shadow ${
        isDragging ? "opacity-50" : "hover:shadow-md"
      }`}
    >
      <CrmClientCardContent
        client={client}
        onMove={onMove}
        dragHandle={
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none rounded p-0.5 text-[var(--insyt-muted)] hover:text-[var(--insyt-slate)] active:cursor-grabbing"
            aria-label="Arrastar"
          >
            <GripVertical className="size-4" />
          </button>
        }
      />
    </div>
  );
}
