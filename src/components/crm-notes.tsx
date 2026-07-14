"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createCrmNote } from "@/app/actions/crm";
import type { CrmNote } from "@/types/crm";

export function CrmNotes({
  clientId,
  initialNotes,
}: {
  clientId: string;
  initialNotes: CrmNote[];
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    if (!body.trim()) {
      toast.error("Escreva a anotação.");
      return;
    }

    startTransition(async () => {
      const result = await createCrmNote(clientId, body.trim());
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setNotes((prev) => [
        {
          id: crypto.randomUUID(),
          client_id: clientId,
          body: body.trim(),
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setBody("");
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Textarea
          placeholder="Registrar uma ligação, reunião ou observação..."
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={handleAdd} disabled={isPending}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Registrar
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-[var(--insyt-muted)]">Nenhuma anotação ainda.</p>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className="rounded-xl border-l-2 border-[var(--insyt-primary)]/30 bg-[var(--insyt-canvas)] p-3 pl-4"
            >
              <p className="text-sm whitespace-pre-wrap text-[var(--insyt-black)]">
                {note.body}
              </p>
              <p className="mt-1 text-xs text-[var(--insyt-muted)]">
                {format(new Date(note.created_at), "d MMM yyyy 'às' HH:mm", {
                  locale: ptBR,
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
