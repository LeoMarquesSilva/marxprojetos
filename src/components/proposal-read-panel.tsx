"use client";

import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Eye, EyeOff, MonitorSmartphone, Percent } from "lucide-react";
import {
  formatReadingTime,
  summarizeProposalSessions,
  type ProposalSession,
} from "@/types/proposal";
import { cn } from "@/lib/utils";

function deviceOf(userAgent: string | null): string {
  if (!userAgent) return "Desconhecido";
  if (/iPhone|Android.*Mobile|Mobile.*Android/i.test(userAgent)) return "Celular";
  if (/iPad|Tablet/i.test(userAgent)) return "Tablet";
  return "Computador";
}

export function ProposalReadPanel({
  sessions,
  totalBlocks,
}: {
  sessions: ProposalSession[];
  totalBlocks: number;
}) {
  const stats = summarizeProposalSessions(sessions);

  if (stats.sessions === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--insyt-border)] py-12 text-center">
        <EyeOff className="size-6 text-[var(--insyt-muted)]" />
        <p className="text-sm font-medium text-[var(--insyt-black)]">
          Ainda não foi aberta
        </p>
        <p className="max-w-xs text-xs text-[var(--insyt-muted)]">
          Assim que o cliente abrir o link, você vê aqui quantas vezes entrou,
          quanto tempo ficou e até onde leu.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          icon={Eye}
          label={stats.sessions === 1 ? "Vez que abriu" : "Vezes que abriu"}
          value={String(stats.sessions)}
        />
        <Metric
          icon={Clock}
          label="Tempo lendo"
          value={formatReadingTime(stats.totalSeconds)}
        />
        <Metric
          icon={Percent}
          label="Leu até"
          value={`${stats.bestScrollPercent}%`}
          highlight={stats.reachedEnd}
          hint={stats.reachedEnd ? "Chegou ao fim" : undefined}
        />
      </div>

      <p className="text-xs text-[var(--insyt-muted)]">
        Primeira abertura{" "}
        {stats.firstOpenedAt
          ? formatDistanceToNowStrict(new Date(stats.firstOpenedAt), {
              locale: ptBR,
              addSuffix: true,
            })
          : "—"}
        {stats.sessions > 1 && stats.lastOpenedAt ? (
          <>
            {" · "}última{" "}
            {formatDistanceToNowStrict(new Date(stats.lastOpenedAt), {
              locale: ptBR,
              addSuffix: true,
            })}
          </>
        ) : null}
      </p>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--insyt-muted)]">
          Cada abertura
        </p>
        {sessions.map((session) => (
          <div
            key={session.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-[var(--insyt-canvas)] px-4 py-3 text-sm"
          >
            <span className="font-medium text-[var(--insyt-black)]">
              {format(new Date(session.started_at), "d MMM 'às' HH:mm", {
                locale: ptBR,
              })}
            </span>
            <span className="flex items-center gap-1.5 text-[var(--insyt-muted)]">
              <MonitorSmartphone className="size-3.5" />
              {deviceOf(session.user_agent)}
            </span>
            <span className="text-[var(--insyt-muted)]">
              {formatReadingTime(session.seconds_reading)}
            </span>
            <span
              className={cn(
                "ml-auto text-xs font-semibold",
                session.reached_end
                  ? "text-emerald-700"
                  : "text-[var(--insyt-muted)]",
              )}
            >
              {session.reached_end
                ? "leu até o fim"
                : `${session.max_scroll_percent}% da página`}
            </span>
            {totalBlocks > 0 ? (
              <span className="w-full text-xs text-[var(--insyt-muted)]">
                {session.sections_seen.length} de {totalBlocks} seções vistas
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  highlight,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl p-4",
        highlight ? "bg-emerald-50" : "bg-[var(--insyt-canvas)]",
      )}
    >
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--insyt-muted)]">
        <Icon className="size-3.5" />
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 text-2xl font-bold tabular-nums",
          highlight ? "text-emerald-800" : "text-[var(--insyt-black)]",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-xs font-medium text-emerald-700">{hint}</p>
      ) : null}
    </div>
  );
}
