"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { resolveComment } from "@/app/actions/review";
import type { SiteComment } from "@/types/briefing";

export function ProjectReviewComments({
  projectId,
  comments,
}: {
  projectId: string;
  comments: SiteComment[];
}) {
  const [items, setItems] = useState(comments);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleResolve(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const result = await resolveComment(id, projectId);
      setPendingId(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setItems((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, status: "resolved", resolved_at: new Date().toISOString() }
            : c,
        ),
      );
      toast.success("Comentário resolvido!");
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--insyt-muted)]">
        Nenhum comentário do cliente ainda.
      </p>
    );
  }

  const open = items.filter((c) => c.status === "open");
  const resolved = items.filter((c) => c.status === "resolved");

  return (
    <div className="space-y-2">
      {[...open, ...resolved].map((c) => (
        <div
          key={c.id}
          className="flex items-start justify-between gap-3 rounded-xl border border-[var(--insyt-border)] bg-[var(--insyt-canvas)] p-3"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {c.width_pct > 0 && c.height_pct > 0 ? (
                <Badge variant="secondary" className="text-[10px]">
                  Área
                </Badge>
              ) : null}
              <p className="text-sm text-[var(--insyt-black)]">{c.comment}</p>
            </div>
            <p className="text-xs text-[var(--insyt-muted)]">
              {c.author_name || "Anônimo"} · {c.page_path} ·{" "}
              {format(new Date(c.created_at), "d MMM yyyy 'às' HH:mm", {
                locale: ptBR,
              })}
            </p>
          </div>
          {c.status === "resolved" ? (
            <Badge variant="secondary">Resolvido</Badge>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pendingId === c.id}
              onClick={() => handleResolve(c.id)}
            >
              {pendingId === c.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Resolver
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
