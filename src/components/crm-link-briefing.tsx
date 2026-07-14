"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Link2, Loader2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { linkCrmClientProject } from "@/app/actions/crm";

type LinkableProject = { id: string; title: string; client_name: string | null };

export function CrmLinkBriefing({
  clientId,
  currentProjectId,
  currentProjectTitle,
  linkableProjects,
}: {
  clientId: string;
  currentProjectId: string | null;
  currentProjectTitle: string | null;
  linkableProjects: LinkableProject[];
}) {
  const [selected, setSelected] = useState<string>(currentProjectId ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleLink() {
    if (!selected) return;
    startTransition(async () => {
      const result = await linkCrmClientProject(clientId, selected);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Briefing vinculado!");
      router.refresh();
    });
  }

  function handleUnlink() {
    startTransition(async () => {
      const result = await linkCrmClientProject(clientId, null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setSelected("");
      toast.success("Briefing desvinculado.");
      router.refresh();
    });
  }

  if (currentProjectId) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/projects/${currentProjectId}`}
          className="text-sm font-medium text-[var(--insyt-primary)] hover:underline"
        >
          {currentProjectTitle ?? "Ver briefing"}
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleUnlink}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Unlink className="size-4" />
          )}
          Desvincular
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Select value={selected} onValueChange={(value) => setSelected(value ?? "")}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Selecionar briefing existente...">
            {(value: string | null) =>
              linkableProjects.find((p) => p.id === value)?.title ??
              "Selecionar briefing existente..."
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {linkableProjects.length === 0 ? (
            <SelectItem value="none" disabled>
              Nenhum briefing disponível
            </SelectItem>
          ) : (
            linkableProjects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      <Button type="button" onClick={handleLink} disabled={isPending || !selected}>
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Link2 className="size-4" />
        )}
        Vincular
      </Button>
    </div>
  );
}
