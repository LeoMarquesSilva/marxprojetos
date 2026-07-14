"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { createCrmTask, deleteCrmTask, toggleCrmTask } from "@/app/actions/crm";
import type { CrmTask } from "@/types/crm";

export function CrmTasks({
  clientId,
  initialTasks,
}: {
  clientId: string;
  initialTasks: CrmTask[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    if (!title.trim()) {
      toast.error("Escreva a tarefa.");
      return;
    }

    startTransition(async () => {
      const result = await createCrmTask(
        clientId,
        title.trim(),
        dueDate ? new Date(dueDate).toISOString() : undefined,
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setTasks((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          client_id: clientId,
          title: title.trim(),
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
          done: false,
          done_at: null,
          created_at: new Date().toISOString(),
        },
      ]);
      setTitle("");
      setDueDate("");
    });
  }

  function handleToggle(task: CrmTask) {
    const nextDone = !task.done;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, done: nextDone } : t)),
    );
    startTransition(async () => {
      const result = await toggleCrmTask(task.id, clientId, nextDone);
      if (result.error) {
        toast.error(result.error);
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, done: task.done } : t)),
        );
      }
    });
  }

  function handleDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    startTransition(async () => {
      const result = await deleteCrmTask(id, clientId);
      if (result.error) toast.error(result.error);
    });
  }

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 rounded-2xl bg-[var(--insyt-canvas)] p-2 sm:flex-row">
        <Input
          placeholder="Nova tarefa (ex: ligar amanhã)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 border-transparent bg-white"
        />
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="border-transparent bg-white sm:w-40"
        />
        <Button type="button" onClick={handleAdd} disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        </Button>
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-[var(--insyt-muted)]">Nenhuma tarefa ainda.</p>
      ) : (
        <div className="space-y-1.5">
          {[...pending, ...done].map((task) => (
            <div
              key={task.id}
              className="group flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-[var(--insyt-canvas)]"
            >
              <Checkbox
                checked={task.done}
                onCheckedChange={() => handleToggle(task)}
              />
              <div className="flex-1">
                <p
                  className={`text-sm ${
                    task.done
                      ? "text-[var(--insyt-muted)] line-through"
                      : "text-[var(--insyt-black)]"
                  }`}
                >
                  {task.title}
                </p>
                {task.due_date ? (
                  <p className="text-xs text-[var(--insyt-muted)]">
                    {format(new Date(task.due_date), "d MMM yyyy", { locale: ptBR })}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => handleDelete(task.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
