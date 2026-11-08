"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { updateProjectWork } from "@/app/actions/projects";
import {
  parseWorkStatus,
  WORK_STATUS_LABELS,
  WORK_STATUSES,
  type WorkStatus,
} from "@/lib/project-work";
import { cn } from "@/lib/utils";

const STATUS_TONES: Record<WorkStatus | "none", string> = {
  em_andamento: "bg-[#ffe9df] text-[#b5330f]",
  em_revisao: "bg-amber-100 text-amber-900",
  concluido: "bg-emerald-100 text-emerald-900",
  pausado: "bg-indigo-100 text-indigo-900",
  none: "bg-[var(--insyt-canvas-alt)] text-[var(--insyt-slate)]",
};

function formatDue(date: string) {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

/** Status e prazo do projeto, editados na própria linha, sem abrir nada. */
export function ProjectWorkControls({
  projectId,
  projectTitle,
  workStatus,
  dueOn,
  today,
  layout = "table",
}: {
  projectId: string;
  projectTitle: string;
  workStatus: string | null;
  dueOn: string | null;
  today: string;
  layout?: "table" | "inline";
}) {
  const router = useRouter();
  const [status, setStatus] = useState<WorkStatus | null>(parseWorkStatus(workStatus));
  const [due, setDue] = useState(dueOn ?? "");
  const [isPending, startTransition] = useTransition();
  const dateInput = useRef<HTMLInputElement>(null);

  function save(nextStatus: WorkStatus | null, nextDue: string) {
    const previous = { status, due };
    setStatus(nextStatus);
    setDue(nextDue);
    startTransition(async () => {
      const result = await updateProjectWork(projectId, {
        workStatus: nextStatus,
        dueOn: nextDue || null,
      });
      if (result.error) {
        setStatus(previous.status);
        setDue(previous.due);
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  const overdue =
    Boolean(due) && due < today && status !== "concluido" && status !== "pausado";

  const statusControl = (
    <span className={cn("relative inline-flex", isPending && "opacity-60")}>
      <select
        aria-label={`Status de ${projectTitle}`}
        value={status ?? ""}
        disabled={isPending}
        onChange={(event) => save(parseWorkStatus(event.target.value), due)}
        className={cn(
          "cursor-pointer appearance-none rounded-full py-1 pl-2.5 pr-6 text-xs font-semibold outline-none transition-shadow duration-150 focus-visible:ring-3 focus-visible:ring-ring/50",
          STATUS_TONES[status ?? "none"],
        )}
      >
        <option value="">Sem status</option>
        {WORK_STATUSES.map((value) => (
          <option key={value} value={value}>
            {WORK_STATUS_LABELS[value]}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 opacity-70"
      />
    </span>
  );

  // O campo de data nativo fica por cima, invisível: o texto limpo aparece na linha e
  // clicar abre o calendário do navegador. Com o teclado, o foco revela o campo.
  const dueControl = (
    <span
      className={cn(
        "relative inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-[13px] tabular-nums transition-colors duration-150 hover:bg-[var(--insyt-canvas-alt)]",
        overdue
          ? "font-semibold text-red-700"
          : due
            ? "text-[var(--insyt-slate)]"
            : "text-[var(--insyt-muted)]",
        isPending && "opacity-60",
      )}
    >
      <CalendarDays aria-hidden className="size-3.5 shrink-0 opacity-70" />
      <span aria-hidden>{due ? formatDue(due) : "Definir"}</span>
      <input
        ref={dateInput}
        type="date"
        aria-label={`Prazo de ${projectTitle}`}
        value={due}
        disabled={isPending}
        onClick={() => dateInput.current?.showPicker?.()}
        onChange={(event) => {
          const value = event.target.value;
          // Enquanto digita o ano, o campo passa por datas como 0002-11-08.
          if (value === "" || value >= "2000-01-01") save(status, value);
          else setDue(value);
        }}
        className="absolute inset-0 w-full cursor-pointer rounded-lg bg-white text-[13px] opacity-0 outline-none focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-calendar-picker-indicator]:hidden"
      />
    </span>
  );

  if (layout === "inline") {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        {statusControl}
        {dueControl}
      </span>
    );
  }

  return (
    <>
      <td className="px-3 py-3">{statusControl}</td>
      <td className="px-3 py-3">{dueControl}</td>
    </>
  );
}
