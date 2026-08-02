"use client";

import { useState, useTransition } from "react";
import { format, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { updateCrmNextStep } from "@/app/actions/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Substitui as antigas "Tarefas" + "Histórico": as duas tabelas ficaram com
// zero linhas desde que foram criadas. Um único próximo passo com data
// responde a pergunta que importa — "o que eu faço com esse lead e quando" —
// sem virar mais uma lista para manter.
export function CrmNextStep({
  clientId,
  initialStep,
  initialDate,
}: {
  clientId: string;
  initialStep: string | null;
  initialDate: string | null;
}) {
  const [step, setStep] = useState(initialStep ?? "");
  const [date, setDate] = useState(
    initialDate ? initialDate.slice(0, 10) : "",
  );
  const [saved, setSaved] = useState({
    step: initialStep ?? "",
    date: initialDate ? initialDate.slice(0, 10) : "",
  });
  const [isPending, startTransition] = useTransition();

  const dirty = step !== saved.step || date !== saved.date;
  const isOverdue =
    saved.date.length > 0 &&
    saved.step.length > 0 &&
    isBefore(new Date(`${saved.date}T23:59:59`), startOfDay(new Date()));

  function save(nextStep: string, nextDate: string) {
    startTransition(async () => {
      const result = await updateCrmNextStep(clientId, {
        step: nextStep,
        date: nextDate || null,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setSaved({ step: nextStep, date: nextDate });
      toast.success(nextStep ? "Próximo passo salvo." : "Próximo passo concluído.");
    });
  }

  return (
    <div className="space-y-3">
      {saved.step && !dirty ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-3 rounded-xl px-4 py-3",
            isOverdue
              ? "bg-[#fff4f0] text-[var(--insyt-primary-dark)]"
              : "bg-[var(--insyt-canvas)] text-[var(--insyt-black)]",
          )}
        >
          <CalendarClock className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 text-sm font-medium">{saved.step}</span>
          {saved.date ? (
            <span className="text-xs font-semibold">
              {isOverdue ? "Atrasado — " : ""}
              {format(new Date(`${saved.date}T12:00:00`), "d MMM", { locale: ptBR })}
            </span>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => {
              setStep("");
              setDate("");
              save("", "");
            }}
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            Concluir
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[180px] flex-1">
            <Input
              value={step}
              onChange={(event) => setStep(event.target.value)}
              placeholder="Ex: mandar proposta, ligar de novo..."
              aria-label="Próximo passo"
            />
          </div>
          <Input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            aria-label="Data do próximo passo"
            className="w-auto"
          />
          <Button
            type="button"
            size="sm"
            disabled={isPending || !step.trim()}
            onClick={() => save(step.trim(), date)}
          >
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Salvar
          </Button>
          {dirty && saved.step ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setStep(saved.step);
                setDate(saved.date);
              }}
            >
              <X className="size-3.5" />
              Cancelar
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
