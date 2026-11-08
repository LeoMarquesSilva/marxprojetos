"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateProjectStatus } from "@/app/actions/projects";
import { toastWithUndo } from "@/components/finance-settle";
import { Button } from "@/components/ui/button";
import type { ProjectStatus } from "@/types/briefing";

/** Arquivar é um clique: o aviso diz o que aconteceu e permite desfazer. */
export function ProjectArchiveButton({
  projectId,
  status,
  restoreTo,
}: {
  projectId: string;
  status: ProjectStatus;
  /** Para onde o briefing volta ao desarquivar. */
  restoreTo: ProjectStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const archived = status === "archived";

  function run() {
    startTransition(async () => {
      const result = await updateProjectStatus(projectId, archived ? restoreTo : "archived");
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (archived) {
        toast.success("Projeto de volta à Início.");
      } else {
        toastWithUndo(
          "Projeto arquivado. Ele saiu da Início.",
          () => updateProjectStatus(projectId, status),
          () => router.refresh(),
        );
      }
      router.refresh();
    });
  }

  const Icon = isPending ? Loader2 : archived ? ArchiveRestore : Archive;
  return (
    <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={run}>
      <Icon className={isPending ? "size-4 animate-spin" : "size-4"} />
      {archived ? "Desarquivar" : "Arquivar"}
    </Button>
  );
}
