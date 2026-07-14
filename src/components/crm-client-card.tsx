"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FileText, GripVertical } from "lucide-react";
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

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0]?.slice(0, 2);
  return (initials ?? "").toUpperCase();
}

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
      <div className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--insyt-canvas-alt)] text-[11px] font-bold text-[var(--insyt-primary)]">
          {initialsOf(client.name)}
        </span>
        <div className="min-w-0 flex-1">
          <Link
            href={`/crm/${client.id}`}
            className="block truncate text-sm font-semibold text-[var(--insyt-black)] hover:text-[var(--insyt-primary)]"
          >
            {client.name}
          </Link>
          {client.company ? (
            <p className="truncate text-xs text-[var(--insyt-muted)]">{client.company}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
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

      {client.value || client.project_id ? (
        <div className="ml-[42px] flex flex-wrap items-center gap-1.5">
          {client.value ? (
            <span className="rounded-full bg-[#fff4f0] px-2 py-0.5 text-[11px] font-semibold text-[var(--insyt-primary-dark)]">
              {currencyFormatter.format(client.value)}
            </span>
          ) : null}
          {client.project_id ? (
            <span className="flex items-center gap-1 rounded-full bg-[var(--insyt-canvas-alt)] px-2 py-0.5 text-[10px] font-medium text-[var(--insyt-slate)]">
              <FileText className="size-3" />
              Briefing
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

// Non-interactive variant: rendered before client-side mount so the SSR/CSR
// output never contains @dnd-kit's internal aria-describedby ids (they come
// from a global counter that drifts on every mount and causes a hydration
// mismatch if this card is drag-enabled before hydration settles). Also
// reused as the DragOverlay's "lifted" preview.
export function CrmClientCardStatic({
  client,
  onMove,
}: {
  client: CrmClient;
  onMove: (stage: CrmStage) => void;
}) {
  return (
    <div className="insyt-card flex flex-col gap-2 p-3">
      <CrmClientCardContent client={client} onMove={onMove} />
    </div>
  );
}

export function CrmClientCard({
  client,
  onMove,
  index = 0,
}: {
  client: CrmClient;
  onMove: (stage: CrmStage) => void;
  index?: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: client.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: isDragging ? 0.4 : 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(index, 6) * 0.03, ease: "easeOut" }}
      whileHover={isDragging ? undefined : { y: -2 }}
      className="insyt-card group flex flex-col gap-2 p-3 transition-shadow hover:shadow-lg"
    >
      <CrmClientCardContent
        client={client}
        onMove={onMove}
        dragHandle={
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none rounded p-0.5 text-[var(--insyt-muted)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--insyt-slate)] active:cursor-grabbing"
            aria-label="Arrastar"
          >
            <GripVertical className="size-4" />
          </button>
        }
      />
    </motion.div>
  );
}
