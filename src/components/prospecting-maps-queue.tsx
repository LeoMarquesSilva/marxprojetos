"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bot, CheckCircle2, Clock, Loader2, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  cancelMapsSearch,
  getMapsSearchJobs,
  type MapsQueueSnapshot,
  type MapsSearchJob,
} from "@/app/actions/prospecting";
import { cn } from "@/lib/utils";

export type MapsQueueState = MapsQueueSnapshot;

const MODE_LABELS: Record<MapsSearchJob["mode"], string> = {
  padrao: "padrão",
  ampla: "ampla",
  varredura: "varredura",
};

const ACTIVE = new Set<MapsSearchJob["status"]>(["pendente", "rodando"]);

/**
 * Fila do robô do Maps. Consulta o banco a cada poucos segundos enquanto há
 * busca andando (e devagar no resto do tempo, só para saber se o robô está
 * ligado). Quando uma busca termina, avisa o quadro para recarregar a lista.
 */
export function ProspectingMapsQueue({
  initial,
  pokeKey,
  onChange,
  onJobFinished,
}: {
  initial: MapsQueueState;
  /** Muda quando a tela coloca uma busca na fila: força consultar já. */
  pokeKey: number;
  onChange: (state: MapsQueueState) => void;
  onJobFinished: (job: MapsSearchJob) => void;
}) {
  const [state, setState] = useState(initial);
  const [, startTransition] = useTransition();
  const previousStatus = useRef(new Map(initial.jobs.map((job) => [job.id, job.status])));
  const callbacks = useRef({ onChange, onJobFinished });
  useEffect(() => {
    callbacks.current = { onChange, onJobFinished };
  });

  const hasActive = state.jobs.some((job) => ACTIVE.has(job.status));

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const next = await getMapsSearchJobs().catch(() => null);
      if (!next || cancelled) return;
      for (const job of next.jobs) {
        const before = previousStatus.current.get(job.id);
        if (before && ACTIVE.has(before) && !ACTIVE.has(job.status)) {
          callbacks.current.onJobFinished(job);
        }
        previousStatus.current.set(job.id, job.status);
      }
      setState(next);
      callbacks.current.onChange(next);
    }

    void poll();
    const timer = setInterval(() => void poll(), hasActive ? 4000 : 20000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [hasActive, pokeKey]);

  function handleCancel(id: string) {
    setState((current) => ({
      ...current,
      jobs: current.jobs.map((job) => (job.id === id ? { ...job, status: "cancelado" } : job)),
    }));
    startTransition(async () => {
      await cancelMapsSearch(id);
    });
  }

  if (state.jobs.length === 0 && !state.workerOnline) return null;

  return (
    <div className="insyt-card space-y-3 p-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Bot className="size-4 text-[var(--insyt-slate)]" />
        <span className="font-semibold text-[var(--insyt-black)]">Robô do Google Maps</span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold",
            state.workerOnline ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              state.workerOnline ? "bg-emerald-500" : "bg-slate-400",
            )}
          />
          {state.workerOnline ? "ligado" : "desligado"}
        </span>
        {!state.workerOnline ? (
          <span className="text-xs text-[var(--insyt-muted)]">
            Rode <code className="rounded bg-[var(--insyt-canvas-alt)] px-1">npm run maps:robo</code>{" "}
            no computador — as buscas esperam na fila até ele ligar.
          </span>
        ) : null}
      </div>

      {state.jobs.length > 0 ? (
        <ul className="divide-y divide-[var(--insyt-border)]">
          {state.jobs.map((job) => (
            <li key={job.id} className="flex items-start gap-3 py-2.5 text-sm">
              <StatusIcon status={job.status} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[var(--insyt-black)]">
                  <span className="font-semibold">{job.niche}</span> · {job.city}
                  {job.state ? `/${job.state}` : ""}
                  <span className="text-[var(--insyt-muted)]"> · {MODE_LABELS[job.mode]}</span>
                </p>
                <p className="text-xs text-[var(--insyt-muted)]">
                  {job.status === "pendente"
                    ? `Na fila ${formatDistanceToNow(new Date(job.created_at), { locale: ptBR, addSuffix: false })}`
                    : job.status === "rodando"
                      ? (job.progress ?? "Buscando…")
                      : job.status === "concluido"
                        ? `${job.imported} novo(s) · ${job.updated} atualizado(s) · de ${job.found} encontrado(s)`
                        : job.status === "erro"
                          ? (job.error ?? "Falhou")
                          : "Cancelada"}
                </p>
              </div>
              {ACTIVE.has(job.status) ? (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  title="Cancelar busca"
                  onClick={() => handleCancel(job.id)}
                >
                  <X className="size-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function StatusIcon({ status }: { status: MapsSearchJob["status"] }) {
  if (status === "rodando") {
    return <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-[var(--insyt-primary)]" />;
  }
  if (status === "pendente") return <Clock className="mt-0.5 size-4 shrink-0 text-amber-600" />;
  if (status === "concluido") {
    return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />;
  }
  return <XCircle className="mt-0.5 size-4 shrink-0 text-[var(--insyt-muted)]" />;
}
