import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/types/briefing";

const styles: Record<ProjectStatus, string> = {
  draft: "bg-[var(--insyt-canvas-alt)] text-[var(--insyt-slate)] border-[var(--insyt-border)]",
  sent: "bg-[#fff4f0] text-[#bf3616] border-[#ffd6c8]",
  in_progress: "bg-[#fff8eb] text-[#a16207] border-[#fde6b3]",
  submitted: "bg-[#ecfdf3] text-[#047857] border-[#bbf7d0]",
  reviewed: "bg-[#eef2ff] text-[#4338ca] border-[#c7d2fe]",
  archived: "bg-[var(--insyt-canvas-alt)] text-[var(--insyt-muted)] border-[var(--insyt-border)]",
};

const labels: Record<ProjectStatus, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  in_progress: "Em andamento",
  submitted: "Respondido",
  reviewed: "Revisado",
  archived: "Arquivado",
};

export function StatusBadge({
  status,
  className,
}: {
  status: ProjectStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        styles[status],
        className,
      )}
    >
      {labels[status]}
    </span>
  );
}
