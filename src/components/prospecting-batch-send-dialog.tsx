"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  Loader2,
  Pause,
  Play,
  Send,
  Square,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ProspectingDialogShell } from "@/components/prospecting-dialog-shell";
import { draftMessageFor, type MessageKind } from "@/components/prospecting-message-dialog";
import { checkProspectsWhatsapp, sendProspectToConversas } from "@/app/actions/prospecting";
import { isFollowupDue } from "@/lib/prospecting/followup";
import type { Prospect, ProspectingSettings } from "@/types/prospecting";

type ItemState =
  | { state: "fila" }
  | { state: "enviando" }
  | { state: "enviado" }
  | { state: "erro"; message: string };

type Phase = "config" | "verificando" | "enviando" | "pausado" | "fim";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isEligible(lead: Prospect, kind: MessageKind) {
  if (!lead.phone_e164 || lead.has_whatsapp === false) return false;
  return kind === "followup" ? isFollowupDue(lead) : lead.status === "novo";
}

/**
 * Disparo em lote com cadência de gente: um envio por vez, intervalo
 * sorteado entre o mínimo e o máximo, "digitando..." antes de cada mensagem
 * e texto variando por lead (spintax). Roda nesta aba — fechar para a fila,
 * mas tudo o que já saiu fica registrado no lead e no CRM.
 */
export function ProspectingBatchSendDialog({
  open,
  onOpenChange,
  leads,
  kind,
  settings,
  sentToday,
  whatsappReady,
  onLeadSent,
  onLeadsChecked,
  onFinished,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Prospect[];
  kind: MessageKind;
  settings: ProspectingSettings;
  sentToday: number;
  whatsappReady: boolean;
  onLeadSent: (id: string, sentToday: number) => void;
  onLeadsChecked: (withWhatsapp: string[], withoutWhatsapp: string[]) => void;
  onFinished: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("config");
  const [minSeconds, setMinSeconds] = useState("45");
  const [maxSeconds, setMaxSeconds] = useState("120");
  const [onlyConfirmed, setOnlyConfirmed] = useState(true);
  const [queue, setQueue] = useState<Prospect[]>([]);
  const [items, setItems] = useState<Record<string, ItemState>>({});
  const [countdown, setCountdown] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [sentNow, setSentNow] = useState(sentToday);
  const stopRef = useRef(false);
  const pauseRef = useRef(false);

  const eligible = useMemo(() => leads.filter((lead) => isEligible(lead, kind)), [leads, kind]);
  const remainingToday = Math.max(0, settings.dailyLimit - sentNow);
  const running = phase === "enviando" || phase === "pausado" || phase === "verificando";

  // Fechar a aba no meio do lote corta a fila; o navegador avisa antes.
  useEffect(() => {
    if (!running) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  function handleOpenChange(next: boolean) {
    if (!next && running) {
      if (!window.confirm("Parar o disparo? O que já foi enviado fica registrado.")) return;
      stopRef.current = true;
      pauseRef.current = false;
    }
    onOpenChange(next);
  }

  async function start() {
    const min = Math.max(15, Number(minSeconds) || 45);
    const max = Math.max(min, Number(maxSeconds) || min);
    stopRef.current = false;
    pauseRef.current = false;
    setNote(null);

    let candidates = eligible;

    // Antes de mandar, pergunta à Evolution quem tem WhatsApp entre os
    // ainda não verificados — melhor do que descobrir no erro do envio.
    const unverified = candidates.filter((lead) => lead.has_whatsapp == null);
    if (whatsappReady && unverified.length > 0) {
      setPhase("verificando");
      const check = await checkProspectsWhatsapp({ ids: unverified.map((lead) => lead.id) });
      if (check.error) {
        toast.error(check.error);
      } else {
        const without = new Set(check.semIds ?? []);
        const withIds = new Set(check.comIds ?? []);
        onLeadsChecked(check.comIds ?? [], check.semIds ?? []);
        candidates = candidates
          .filter((lead) => !without.has(lead.id))
          .map((lead) => (withIds.has(lead.id) ? { ...lead, has_whatsapp: true } : lead));
      }
    }

    if (onlyConfirmed && whatsappReady) {
      candidates = candidates.filter((lead) => lead.has_whatsapp === true);
    }

    const toSend = candidates.slice(0, remainingToday);
    if (toSend.length === 0) {
      setPhase("config");
      toast.info("Nenhum lead da seleção pode receber agora.");
      return;
    }
    if (candidates.length > toSend.length) {
      setNote(
        `${candidates.length - toSend.length} lead(s) ficaram para amanhã por causa do limite diário.`,
      );
    }

    setQueue(toSend);
    setItems(Object.fromEntries(toSend.map((lead) => [lead.id, { state: "fila" } as ItemState])));
    setPhase("enviando");

    for (let index = 0; index < toSend.length; index += 1) {
      if (stopRef.current) break;
      while (pauseRef.current && !stopRef.current) await sleep(400);
      if (stopRef.current) break;

      const lead = toSend[index];
      setItems((current) => ({ ...current, [lead.id]: { state: "enviando" } }));

      const result = await sendProspectToConversas(
        lead.id,
        draftMessageFor(lead, settings, kind),
        { followup: kind === "followup", quiet: true },
      );

      if (result.error) {
        setItems((current) => ({
          ...current,
          [lead.id]: { state: "erro", message: result.error! },
        }));
        if ("limitReached" in result && result.limitReached) {
          setNote(result.error);
          break;
        }
      } else {
        setItems((current) => ({ ...current, [lead.id]: { state: "enviado" } }));
        setSentNow(result.sentToday ?? sentNow + 1);
        onLeadSent(lead.id, result.sentToday ?? 0);
      }

      if (index < toSend.length - 1) {
        const waitSeconds = Math.round(min + Math.random() * (max - min));
        for (let left = waitSeconds; left > 0; left -= 1) {
          if (stopRef.current) break;
          while (pauseRef.current && !stopRef.current) await sleep(400);
          setCountdown(left);
          await sleep(1000);
        }
        setCountdown(0);
      }
    }

    setPhase("fim");
    onFinished();
  }

  function togglePause() {
    pauseRef.current = !pauseRef.current;
    setPhase(pauseRef.current ? "pausado" : "enviando");
  }

  function stop() {
    stopRef.current = true;
    pauseRef.current = false;
  }

  const sentCount = Object.values(items).filter((item) => item.state === "enviado").length;
  const errorCount = Object.values(items).filter((item) => item.state === "erro").length;
  const skipped = leads.length - eligible.length;

  return (
    <ProspectingDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      title={kind === "followup" ? "Follow-up em lote" : "Disparo em lote"}
      description={
        phase === "config"
          ? `${eligible.length} de ${leads.length} selecionado(s) podem receber${
              skipped > 0
                ? ` — ${skipped} fora (sem telefone, sem WhatsApp ou ${
                    kind === "followup" ? "sem follow-up pendente" : "já abordados"
                  })`
                : ""
            }.`
          : `${sentCount} enviado(s)${errorCount ? ` · ${errorCount} com erro` : ""} de ${queue.length}.`
      }
      footer={
        phase === "config" ? (
          <Button
            type="button"
            className="w-full"
            onClick={start}
            disabled={!whatsappReady || eligible.length === 0 || remainingToday === 0}
          >
            <Send className="size-4" />
            Começar ({Math.min(eligible.length, remainingToday)})
          </Button>
        ) : phase === "fim" ? (
          <Button type="button" className="w-full" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={togglePause}
              disabled={phase === "verificando"}
            >
              {phase === "pausado" ? <Play className="size-4" /> : <Pause className="size-4" />}
              {phase === "pausado" ? "Continuar" : "Pausar"}
            </Button>
            <Button type="button" variant="destructive" className="flex-1" onClick={stop}>
              <Square className="size-4" />
              Parar
            </Button>
          </div>
        )
      }
    >
      {phase === "config" ? (
        <>
          {!whatsappReady ? (
            <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              O WhatsApp da INSYT não está conectado (EVOLUTION_API_URL, EVOLUTION_API_KEY e
              EVOLUTION_INSTANCE). Sem ele, use o wa.me de cada lead.
            </p>
          ) : null}
          <div className="rounded-2xl bg-[var(--insyt-canvas)] px-4 py-3 text-sm text-[var(--insyt-slate)]">
            Hoje: <strong className="text-[var(--insyt-black)]">{sentNow}</strong> de{" "}
            {settings.dailyLimit} envios · restam{" "}
            <strong className="text-[var(--insyt-black)]">{remainingToday}</strong>.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="batch-min">Intervalo mínimo (s)</Label>
              <Input
                id="batch-min"
                type="number"
                min={15}
                value={minSeconds}
                onChange={(e) => setMinSeconds(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-max">Intervalo máximo (s)</Label>
              <Input
                id="batch-max"
                type="number"
                min={15}
                value={maxSeconds}
                onChange={(e) => setMaxSeconds(e.target.value)}
              />
            </div>
          </div>

          {whatsappReady ? (
            <label className="flex cursor-pointer items-start gap-3 text-sm text-[var(--insyt-slate)]">
              <Switch checked={onlyConfirmed} onCheckedChange={setOnlyConfirmed} />
              <span>
                Só quem tem WhatsApp confirmado
                <span className="block text-xs text-[var(--insyt-muted)]">
                  Os não verificados são consultados antes de começar, sem enviar nada.
                </span>
              </span>
            </label>
          ) : null}

          {eligible[0] ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--insyt-muted)]">
                Prévia — {eligible[0].name}
              </p>
              <div className="rounded-2xl bg-[#e7f8ef] p-4 text-sm whitespace-pre-wrap text-[var(--insyt-black)]">
                {draftMessageFor(eligible[0], settings, kind)}
              </div>
            </div>
          ) : null}

          <p className="text-xs text-[var(--insyt-muted)]">
            Mantenha esta aba aberta durante o disparo. Com intervalos de 45–120s,
            20 mensagens levam cerca de 30 minutos — é o ritmo que protege o número.
          </p>
        </>
      ) : (
        <>
          {phase === "verificando" ? (
            <p className="flex items-center gap-2 text-sm text-[var(--insyt-slate)]">
              <Loader2 className="size-4 animate-spin" />
              Verificando quem tem WhatsApp…
            </p>
          ) : null}
          {countdown > 0 && phase !== "fim" ? (
            <p className="text-sm text-[var(--insyt-slate)]">
              {phase === "pausado" ? "Pausado" : `Próximo envio em ${countdown}s`}
            </p>
          ) : null}
          {note ? (
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{note}</p>
          ) : null}
          {queue.length > 0 ? (
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--insyt-canvas-alt)]">
              <div
                className="h-full rounded-full bg-[var(--insyt-primary)] transition-all"
                style={{ width: `${((sentCount + errorCount) / queue.length) * 100}%` }}
              />
            </div>
          ) : null}
          <ul className="space-y-1.5">
            {queue.map((lead) => {
              const item = items[lead.id] ?? { state: "fila" };
              return (
                <li key={lead.id} className="flex items-start gap-2 text-sm">
                  {item.state === "enviado" ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  ) : item.state === "erro" ? (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-rose-600" />
                  ) : item.state === "enviando" ? (
                    <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-[var(--insyt-primary)]" />
                  ) : (
                    <Circle className="mt-0.5 size-4 shrink-0 text-[var(--insyt-border)]" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-[var(--insyt-black)]">{lead.name}</span>
                    {item.state === "erro" ? (
                      <span className="block text-xs text-rose-600">{item.message}</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </ProspectingDialogShell>
  );
}
