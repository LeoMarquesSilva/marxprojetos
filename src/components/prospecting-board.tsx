"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AtSign,
  BadgeCheck,
  Download,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  MessagesSquare,
  MoreHorizontal,
  RefreshCw,
  Repeat2,
  ScanSearch,
  Search,
  Send,
  Sparkles,
  Star,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProspectingSearchPanel } from "@/components/prospecting-search-panel";
import {
  ProspectingMapsQueue,
  type MapsQueueState,
} from "@/components/prospecting-maps-queue";
import { ProspectingSettingsDialog } from "@/components/prospecting-settings-dialog";
import { ProspectingImportDialog } from "@/components/prospecting-import-dialog";
import { ProspectingBatchSendDialog } from "@/components/prospecting-batch-send-dialog";
import {
  ProspectingMessageDialog,
  draftMessageFor,
  type MessageKind,
} from "@/components/prospecting-message-dialog";
import {
  bulkUpdateProspectStatus,
  checkProspectsWhatsapp,
  deleteProspect,
  promoteToCrm,
  refreshEnrichment,
  scanProspectSites,
  sendProspectToConversas,
  updateProspectStatus,
  type ProspectingStatus,
} from "@/app/actions/prospecting";
import { buildWaMeUrl, formatBrPhone } from "@/lib/phone";
import { isFollowupDue } from "@/lib/prospecting/followup";
import {
  scoreBreakdown,
  scoreProspect,
  TIER_LABELS,
  type ProspectScore,
} from "@/lib/prospecting/score";
import { PROSPECT_SEGMENTS } from "@/lib/prospecting/segments";
import { cn } from "@/lib/utils";
import {
  PROSPECT_STATUS_ACCENT,
  PROSPECT_STATUS_LABELS,
  PROSPECT_STATUS_ORDER,
  type Prospect,
  type ProspectStatus,
  type ProspectingSettings,
} from "@/types/prospecting";

type SortKey = "prioridade" | "recentes" | "avaliacoes";
type Row = { p: Prospect; score: ProspectScore; followupDue: boolean };
type Enrichment = { label: string; done: number; total: number } | null;

const PAGE_SIZE = 100;
// Patch otimista vale até o servidor confirmar — ou por no máximo 1 min,
// para um valor alterado por outra pessoa não ficar escondido.
const PATCH_TTL_MS = 60_000;

const TIER_STYLES: Record<ProspectScore["tier"], string> = {
  quente: "bg-[#fff4f0] text-[var(--insyt-primary-dark)]",
  morno: "bg-amber-50 text-amber-700",
  frio: "bg-slate-100 text-slate-500",
};

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[;"\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function ProspectingBoard({
  initialProspects,
  settings,
  status,
  initialMapsQueue,
}: {
  initialProspects: Prospect[];
  settings: ProspectingSettings;
  status: ProspectingStatus;
  initialMapsQueue: MapsQueueState;
}) {
  const [prospects, setProspects] = useState(initialProspects);
  const [workerOnline, setWorkerOnline] = useState(initialMapsQueue.workerOnline);
  const [queuePoke, setQueuePoke] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [segmentFilter, setSegmentFilter] = useState<string>("todos");
  const [onlyNoSite, setOnlyNoSite] = useState(false);
  const [onlyWhatsapp, setOnlyWhatsapp] = useState(false);
  const [onlyFollowup, setOnlyFollowup] = useState(false);
  const [sort, setSort] = useState<SortKey>("prioridade");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [messageTarget, setMessageTarget] = useState<{ p: Prospect; kind: MessageKind } | null>(
    null,
  );
  const [batch, setBatch] = useState<{ kind: MessageKind; ids: string[]; key: number } | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<Prospect | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  // O servidor conta os envios no carregamento; a tela soma os que saíram
  // desde então sem esperar o próximo refresh.
  const [localSentToday, setSentToday] = useState(0);
  const sentToday = Math.max(status.sentToday, localSentToday);
  const [enrichment, setEnrichment] = useState<Enrichment>(null);
  const [isEnriching, startEnrichTransition] = useTransition();
  const [isChecking, startCheckTransition] = useTransition();
  const [, startTransition] = useTransition();
  const pendingPatches = useRef(new Map<string, { patch: Partial<Prospect>; at: number }>());
  const pendingDeletes = useRef(new Set<string>());
  const [now] = useState(() => new Date());
  const router = useRouter();

  // Junta o que veio do servidor com o que a tela já mudou e ainda não
  // voltou confirmado (status trocado, lead enviado, excluído).
  useEffect(() => {
    setProspects(() => {
      const serverIds = new Set(initialProspects.map((prospect) => prospect.id));
      for (const id of pendingDeletes.current) {
        if (!serverIds.has(id)) pendingDeletes.current.delete(id);
      }

      return initialProspects
        .filter((prospect) => !pendingDeletes.current.has(prospect.id))
        .map((prospect) => {
          const pending = pendingPatches.current.get(prospect.id);
          if (!pending) return prospect;
          const confirmed = Object.entries(pending.patch).every(
            ([key, value]) => prospect[key as keyof Prospect] === value,
          );
          if (confirmed || Date.now() - pending.at > PATCH_TTL_MS) {
            pendingPatches.current.delete(prospect.id);
            return prospect;
          }
          return { ...prospect, ...pending.patch };
        });
    });
  }, [initialProspects]);

  function patchLocal(id: string, patch: Partial<Prospect>) {
    const previous = pendingPatches.current.get(id)?.patch ?? {};
    pendingPatches.current.set(id, { patch: { ...previous, ...patch }, at: Date.now() });
    setProspects((current) =>
      current.map((prospect) => (prospect.id === id ? { ...prospect, ...patch } : prospect)),
    );
  }

  const rows: Row[] = useMemo(
    () =>
      prospects.map((p) => ({
        p,
        score: scoreProspect(p),
        followupDue: isFollowupDue(p, now),
      })),
    [prospects, now],
  );

  const stats = useMemo(() => {
    const contacted = rows.filter((row) => row.p.status !== "novo" && row.p.status !== "descartado");
    const replied = rows.filter((row) => row.p.status === "respondeu").length;
    return {
      total: rows.length,
      hot: rows.filter((row) => row.score.tier === "quente" && row.p.status === "novo").length,
      noSite: rows.filter(
        (row) =>
          !row.p.website || row.p.site_status === "offline" || row.p.site_status === "social",
      ).length,
      whatsapp: rows.filter((row) => row.p.has_whatsapp === true).length,
      followup: rows.filter((row) => row.followupDue).length,
      replyRate: contacted.length ? Math.round((replied / contacted.length) * 100) : 0,
      replied,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = query
      .trim()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
    const list = rows.filter(({ p, score, followupDue }) => {
      if (statusFilter !== "todos" && p.status !== statusFilter) return false;
      if (segmentFilter === "fora" && score.segment) return false;
      if (
        segmentFilter !== "todos" &&
        segmentFilter !== "fora" &&
        score.segment?.id !== segmentFilter
      ) {
        return false;
      }
      if (onlyNoSite && p.website && p.site_status !== "offline" && p.site_status !== "social") {
        return false;
      }
      if (onlyWhatsapp && p.has_whatsapp !== true) return false;
      if (onlyFollowup && !followupDue) return false;
      if (needle) {
        const haystack = [p.name, p.niche, p.city, p.category, p.phone, p.email]
          .filter(Boolean)
          .join(" ")
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      if (sort === "recentes") return b.p.created_at.localeCompare(a.p.created_at);
      if (sort === "avaliacoes") return (b.p.rating_count ?? 0) - (a.p.rating_count ?? 0);
      return b.score.score - a.score.score;
    });
  }, [rows, query, statusFilter, segmentFilter, onlyNoSite, onlyWhatsapp, onlyFollowup, sort]);

  const shown = filtered.slice(0, visible);
  const selectedRows = rows.filter((row) => selected.has(row.p.id));
  const hasPendingEnrichment = prospects.some((p) => p.enrich_job_id);
  const unscannedSites = prospects.filter((p) => p.website && !p.site_checked_at).length;
  const allShownSelected = shown.length > 0 && shown.every((row) => selected.has(row.p.id));

  function toggleSelected(id: string, value: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllShown(value: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const row of shown) {
        if (value) next.add(row.p.id);
        else next.delete(row.p.id);
      }
      return next;
    });
  }

  /* ---------------- enriquecimento ---------------- */

  async function runSiteScan(ids?: string[]) {
    // A action olha no máximo 150 ids por chamada.
    const chunks: (string[] | undefined)[] = ids
      ? Array.from({ length: Math.ceil(ids.length / 150) }, (_, i) =>
          ids.slice(i * 150, i * 150 + 150),
        )
      : [undefined];
    const totals = { scanned: 0, offline: 0, withIssues: 0, foundEmail: 0, foundWhatsapp: 0 };
    let total = 0;

    for (const idsChunk of chunks) {
      for (let guard = 0; guard < 50; guard += 1) {
        const result = await scanProspectSites({ ids: idsChunk, limit: 12 });
        if (!("scanned" in result)) {
          toast.error(result.error);
          return totals;
        }
        totals.scanned += result.scanned;
        totals.offline += result.offline;
        totals.withIssues += result.withIssues;
        totals.foundEmail += result.foundEmail;
        totals.foundWhatsapp += result.foundWhatsapp;
        total = Math.max(total, totals.scanned + result.remaining);
        setEnrichment({ label: "Analisando sites", done: totals.scanned, total });
        if (result.remaining === 0 || result.scanned === 0) break;
      }
    }
    return totals;
  }

  function enrichLeads(ids: string[] | undefined, { verifyWhatsapp = true } = {}) {
    startEnrichTransition(async () => {
      router.refresh();
      if (verifyWhatsapp && status.whatsapp && (!ids || ids.length > 0)) {
        setEnrichment({ label: "Verificando WhatsApp", done: 0, total: ids?.length ?? 0 });
        const check = await checkProspectsWhatsapp({ ids });
        if (check.error) toast.error(check.error);
      }
      const totals = await runSiteScan(ids);
      setEnrichment(null);
      router.refresh();
      if (totals.scanned > 0) {
        toast.success(
          `${totals.scanned} site(s) analisado(s): ${totals.offline} fora do ar/rede social, ${totals.withIssues} com problemas, ${totals.foundEmail} e-mail(s) e ${totals.foundWhatsapp} WhatsApp achado(s).`,
        );
      }
    });
  }

  function handleSearched(newIds: string[]) {
    if (newIds.length === 0) {
      router.refresh();
      return;
    }
    enrichLeads(newIds);
  }

  function handleCheckWhatsapp(ids?: string[]) {
    startCheckTransition(async () => {
      // Sem seleção, só quem nunca foi verificado: rodar de novo não repete
      // a base inteira. Com seleção, refaz os selecionados.
      const result = await checkProspectsWhatsapp(ids ? { ids, todos: true } : {});
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.verificados === 0) {
        toast.info("Nenhum número novo para verificar.");
        return;
      }
      toast.success(
        `${result.verificados} verificado(s): ${result.comWhatsapp} com WhatsApp, ${result.semWhatsapp} sem.`,
      );
      router.refresh();
    });
  }

  function handleRefreshEnrichment() {
    startEnrichTransition(async () => {
      const result = await refreshEnrichment();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      router.refresh();
      if (result.pendingJobs && result.pendingJobs > 0) {
        toast.info(
          `${result.updated ?? 0} lead(s) atualizado(s); ainda há enriquecimento em andamento. Tente de novo em alguns minutos.`,
        );
        return;
      }
      toast.success(`${result.updated ?? 0} lead(s) atualizado(s) com dados enriquecidos.`);
    });
  }

  /* ---------------- envio ---------------- */

  function openConversation(remoteJid: string) {
    router.push(`/crm?view=conversas&chat=${encodeURIComponent(remoteJid)}`);
  }

  function markSent(id: string, kind: MessageKind, count: number) {
    const stamp = new Date().toISOString();
    const lead = prospects.find((p) => p.id === id);
    patchLocal(
      id,
      kind === "followup"
        ? {
            last_followup_at: stamp,
            followup_count: (lead?.followup_count ?? 0) + 1,
          }
        : {
            status: lead?.status === "respondeu" ? "respondeu" : "contatado",
            contacted_at: lead?.contacted_at ?? stamp,
          },
    );
    if (count) setSentToday(count);
  }

  function handleQuickSend(p: Prospect) {
    if (!p.phone_e164) {
      toast.error("Este lead não tem telefone válido.");
      return;
    }
    setSendingId(p.id);
    startTransition(async () => {
      const result = await sendProspectToConversas(p.id, draftMessageFor(p, settings, "primeira"));
      setSendingId(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      markSent(p.id, "primeira", result.sentToday ?? 0);
      toast.success(`Mensagem enviada para ${p.name}`, {
        action: { label: "Abrir conversa", onClick: () => openConversation(result.remoteJid!) },
      });
    });
  }

  function handleOpenWaMe(p: Prospect, kind: MessageKind) {
    if (!p.phone_e164) return;
    window.open(buildWaMeUrl(p.phone_e164, draftMessageFor(p, settings, kind)), "_blank");
  }

  function handleCopyMessage(p: Prospect, kind: MessageKind) {
    navigator.clipboard.writeText(draftMessageFor(p, settings, kind));
    toast.success("Mensagem copiada!");
  }

  function openBatch(kind: MessageKind) {
    setBatch({ kind, ids: [...selected], key: Date.now() });
  }

  /* ---------------- status, CRM, exclusão ---------------- */

  function handleStatusChange(p: Prospect, next: ProspectStatus) {
    const previous = p.status;
    patchLocal(p.id, { status: next });

    startTransition(async () => {
      const result = await updateProspectStatus(p.id, next);
      if (result.error) {
        toast.error(result.error);
        pendingPatches.current.delete(p.id);
        setProspects((current) =>
          current.map((prospect) =>
            prospect.id === p.id ? { ...prospect, status: previous } : prospect,
          ),
        );
        return;
      }
      router.refresh();
    });
  }

  function handleBulkDiscard() {
    const ids = [...selected];
    for (const id of ids) patchLocal(id, { status: "descartado" });
    setSelected(new Set());
    startTransition(async () => {
      const result = await bulkUpdateProspectStatus(ids, "descartado");
      if (result.error) toast.error(result.error);
      else toast.success(`${result.updated} lead(s) descartado(s).`);
      router.refresh();
    });
  }

  function handlePromote(p: Prospect) {
    startTransition(async () => {
      const result = await promoteToCrm(p.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.crmClientId) patchLocal(p.id, { crm_client_id: result.crmClientId });
      toast.success("Lead enviado ao CRM!");
      router.refresh();
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const removed = deleteTarget;
    const id = removed.id;
    setDeleteTarget(null);
    pendingDeletes.current.add(id);
    setProspects((current) => current.filter((prospect) => prospect.id !== id));
    toggleSelected(id, false);

    startTransition(async () => {
      const result = await deleteProspect(id);
      if (result.error) {
        toast.error(result.error);
        pendingDeletes.current.delete(id);
        setProspects((current) =>
          current.some((prospect) => prospect.id === id) ? current : [removed, ...current],
        );
        return;
      }
      router.refresh();
    });
  }

  function handleExport() {
    const header = [
      "nome",
      "categoria",
      "nicho",
      "cidade",
      "telefone",
      "whatsapp",
      "tem_whatsapp",
      "email",
      "instagram",
      "site",
      "situacao_site",
      "problemas_site",
      "nota",
      "avaliacoes",
      "prioridade",
      "segmento",
      "status",
      "google_maps",
    ];
    const lines = filtered.map(({ p, score }) =>
      [
        p.name,
        p.category,
        p.niche,
        p.city,
        p.phone,
        p.phone_e164,
        p.has_whatsapp == null ? "" : p.has_whatsapp ? "sim" : "não",
        p.email,
        p.instagram,
        p.website,
        p.site_status,
        (p.site_issues ?? []).join(" | "),
        p.rating,
        p.rating_count,
        score.score,
        score.segment?.label,
        PROSPECT_STATUS_LABELS[p.status],
        p.google_maps_uri,
      ]
        .map(csvCell)
        .join(";"),
    );
    // BOM + ";" para o Excel em português abrir com acentos e colunas certas.
    const blob = new Blob([`﻿${[header.join(";"), ...lines].join("\n")}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const busy = isEnriching || isChecking;

  return (
    <div className="space-y-6">
      <ProspectingSearchPanel
        status={status}
        workerOnline={workerOnline}
        onSearched={handleSearched}
        onQueued={() => setQueuePoke((value) => value + 1)}
      />

      <ProspectingMapsQueue
        initial={initialMapsQueue}
        pokeKey={queuePoke}
        onChange={(state) => setWorkerOnline(state.workerOnline)}
        onJobFinished={(job) => {
          // O robô já gravou, analisou os sites e verificou o WhatsApp.
          if (job.status === "concluido") {
            toast.success(
              `Robô terminou "${job.niche}" em ${job.city}: ${job.imported} lead(s) novo(s), ${job.updated} atualizado(s).`,
            );
          } else if (job.status === "erro") {
            toast.error(job.error ?? "A busca do robô falhou.");
          }
          router.refresh();
        }}
      />

      {enrichment ? (
        <div className="insyt-card flex items-center gap-3 px-5 py-4 text-sm text-[var(--insyt-slate)]">
          <Loader2 className="size-4 animate-spin text-[var(--insyt-primary)]" />
          <span>
            {enrichment.label}
            {enrichment.total > 0 ? ` ${enrichment.done}/${enrichment.total}` : "…"}
          </span>
          <span className="text-xs text-[var(--insyt-muted)]">
            e-mail, WhatsApp, Instagram e problemas do site de cada lead
          </span>
        </div>
      ) : null}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatPill label="Leads" value={stats.total} />
        <StatPill
          label="Quentes p/ abordar"
          value={stats.hot}
          accent
          onClick={() => {
            setStatusFilter("novo");
            setSort("prioridade");
          }}
        />
        <StatPill
          label="Sem site / fora do ar"
          value={stats.noSite}
          onClick={() => setOnlyNoSite(true)}
        />
        <StatPill
          label="Follow-up pendente"
          value={stats.followup}
          onClick={() => setOnlyFollowup(true)}
        />
        <StatPill
          label={`Envios hoje · ${stats.replyRate}% responde`}
          value={`${sentToday}/${status.dailyLimit}`}
        />
      </div>

      {/* Ações gerais */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => handleCheckWhatsapp()}
          disabled={busy || !status.whatsapp}
          title={
            status.whatsapp
              ? "Consultar quais leads têm WhatsApp (não envia mensagem)"
              : "Conecte a Evolution para verificar números"
          }
        >
          {isChecking ? <Loader2 className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />}
          Verificar WhatsApp
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => enrichLeads(undefined, { verifyWhatsapp: false })}
          disabled={busy || unscannedSites === 0}
          title="Visita os sites ainda não analisados atrás de e-mail, WhatsApp e problemas"
        >
          <ScanSearch className="size-4" />
          Analisar sites{unscannedSites ? ` (${unscannedSites})` : ""}
        </Button>
        {hasPendingEnrichment ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleRefreshEnrichment}
            disabled={busy}
            title="Aplicar dados enriquecidos do LocalProspects (e-mail, celular)"
          >
            <RefreshCw className="size-4" />
            Atualizar dados
          </Button>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleExport} disabled={!filtered.length}>
            <Download className="size-4" />
            Exportar
          </Button>
          <ProspectingImportDialog onImported={(ids) => handleSearched(ids)} />
          <ProspectingSettingsDialog settings={settings} />
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--insyt-muted)]" />
          <Input
            placeholder="Buscar na lista"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisible(PAGE_SIZE);
            }}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "todos")}>
          <SelectTrigger className="w-40">
            <SelectValue>
              {(value: string | null) =>
                value === "todos" || !value
                  ? "Todos os status"
                  : PROSPECT_STATUS_LABELS[value as ProspectStatus]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {PROSPECT_STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {PROSPECT_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={segmentFilter} onValueChange={(v) => setSegmentFilter(v ?? "todos")}>
          <SelectTrigger className="w-56">
            <SelectValue>
              {(value: string | null) =>
                value === "fora"
                  ? "Fora do portfólio"
                  : (PROSPECT_SEGMENTS.find((s) => s.id === value)?.label ?? "Todos os nichos")
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os nichos</SelectItem>
            {PROSPECT_SEGMENTS.map((segment) => (
              <SelectItem key={segment.id} value={segment.id}>
                {segment.label}
              </SelectItem>
            ))}
            <SelectItem value="fora">Fora do portfólio</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort((v as SortKey) ?? "prioridade")}>
          <SelectTrigger className="w-44">
            <SelectValue>
              {(value: string | null) =>
                value === "recentes"
                  ? "Mais recentes"
                  : value === "avaliacoes"
                    ? "Mais avaliações"
                    : "Maior prioridade"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="prioridade">Maior prioridade</SelectItem>
            <SelectItem value="recentes">Mais recentes</SelectItem>
            <SelectItem value="avaliacoes">Mais avaliações</SelectItem>
          </SelectContent>
        </Select>
        <FilterChip active={onlyNoSite} onClick={() => setOnlyNoSite((v) => !v)}>
          Sem site
        </FilterChip>
        <FilterChip active={onlyWhatsapp} onClick={() => setOnlyWhatsapp((v) => !v)}>
          Com WhatsApp
        </FilterChip>
        <FilterChip active={onlyFollowup} onClick={() => setOnlyFollowup((v) => !v)}>
          Follow-up ({stats.followup})
        </FilterChip>
      </div>

      {/* Seleção */}
      {selected.size > 0 ? (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-2xl bg-[var(--insyt-black)] px-4 py-3 text-sm text-white shadow-lg">
          <span className="font-semibold">{selected.size} selecionado(s)</span>
          <Button type="button" size="sm" onClick={() => openBatch("primeira")}>
            <Send className="size-3.5" />
            Disparar WhatsApp
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => openBatch("followup")}
            disabled={!selectedRows.some((row) => row.followupDue)}
          >
            <Repeat2 className="size-3.5" />
            Follow-up
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => handleCheckWhatsapp([...selected])}
            disabled={busy || !status.whatsapp}
          >
            <BadgeCheck className="size-3.5" />
            Verificar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => enrichLeads([...selected], { verifyWhatsapp: false })}
            disabled={busy}
          >
            <ScanSearch className="size-3.5" />
            Analisar sites
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={handleBulkDiscard}>
            Descartar
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="ml-auto text-white hover:bg-white/10 hover:text-white"
            onClick={() => setSelected(new Set())}
            title="Limpar seleção"
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : null}

      {/* Tabela */}
      <div className="insyt-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
            <MapPin className="size-8 text-[var(--insyt-muted)]" />
            <p className="text-[var(--insyt-slate)]">
              {prospects.length === 0
                ? "Nenhum lead ainda. Escolha um nicho do portfólio e uma cidade para começar."
                : "Nenhum lead com esses filtros."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--insyt-border)] hover:bg-transparent">
                  <TableHead className="w-10 pl-6">
                    <Checkbox
                      checked={allShownSelected}
                      onCheckedChange={(value) => toggleAllShown(Boolean(value))}
                      aria-label="Selecionar todos"
                    />
                  </TableHead>
                  <TableHead>Negócio</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Avaliação</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10 pr-6" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map(({ p, score, followupDue }) => (
                  <TableRow
                    key={p.id}
                    data-state={selected.has(p.id) ? "selected" : undefined}
                    className="group border-[var(--insyt-border)] transition-colors hover:bg-[var(--insyt-canvas-alt)]/50 data-[state=selected]:bg-[#fff4f0]/60"
                  >
                    <TableCell className="py-4 pl-6 align-top">
                      <Checkbox
                        checked={selected.has(p.id)}
                        onCheckedChange={(value) => toggleSelected(p.id, Boolean(value))}
                        aria-label={`Selecionar ${p.name}`}
                      />
                    </TableCell>
                    <TableCell className="max-w-[320px] py-4 align-top">
                      <p className="flex items-center gap-1.5 truncate font-semibold text-[var(--insyt-black)]">
                        <span className="truncate">{p.name}</span>
                        {p.google_maps_uri ? (
                          <a
                            href={p.google_maps_uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir no Google Maps"
                            className="shrink-0 text-[var(--insyt-muted)] hover:text-[var(--insyt-primary)]"
                          >
                            <MapPin className="size-3.5" />
                          </a>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-[var(--insyt-muted)]">
                        {p.category ?? p.niche} · {p.city}
                      </p>
                      {score.segment ? (
                        <span className="mt-1 inline-block rounded-full bg-[var(--insyt-canvas-alt)] px-2 py-0.5 text-[10px] font-semibold text-[var(--insyt-slate)]">
                          {score.segment.label}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-4 align-top">
                      <ContactCell p={p} />
                    </TableCell>
                    <TableCell className="max-w-[220px] py-4 align-top">
                      <SiteCell p={p} />
                    </TableCell>
                    <TableCell className="py-4 align-top">
                      {p.rating ? (
                        <span className="flex items-center gap-1 text-sm text-[var(--insyt-black)]">
                          <Star className="size-3.5 fill-amber-400 text-amber-400" />
                          {p.rating}
                          <span className="text-xs text-[var(--insyt-muted)]">
                            ({p.rating_count ?? 0})
                          </span>
                        </span>
                      ) : (
                        <span className="text-sm text-[var(--insyt-muted)]">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-4 align-top">
                      <span
                        title={[scoreBreakdown(score), "", ...score.reasons].join("\n")}
                        className={cn(
                          "inline-flex cursor-help items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
                          TIER_STYLES[score.tier],
                        )}
                      >
                        {score.score}
                        <span className="font-semibold">{TIER_LABELS[score.tier]}</span>
                      </span>
                    </TableCell>
                    <TableCell className="py-4 align-top">
                      <Select
                        value={p.status}
                        onValueChange={(v) => {
                          if (v) handleStatusChange(p, v as ProspectStatus);
                        }}
                      >
                        <SelectTrigger className="h-8 w-36">
                          <SelectValue>
                            {(value: ProspectStatus | null) => (
                              <span className="flex items-center gap-2">
                                <span
                                  className={`size-1.5 rounded-full ${
                                    PROSPECT_STATUS_ACCENT[value ?? p.status].dot
                                  }`}
                                />
                                {PROSPECT_STATUS_LABELS[value ?? p.status]}
                              </span>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {PROSPECT_STATUS_ORDER.map((s) => (
                            <SelectItem key={s} value={s}>
                              {PROSPECT_STATUS_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {followupDue ? (
                        <p className="mt-1 text-[11px] font-semibold text-amber-700">
                          Follow-up pendente
                        </p>
                      ) : p.followup_count ? (
                        <p className="mt-1 text-[11px] text-[var(--insyt-muted)]">
                          {p.followup_count} follow-up(s)
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-4 pr-6 align-top">
                      <div className="flex items-center justify-end gap-1">
                        {followupDue ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!p.phone_e164}
                            onClick={() => setMessageTarget({ p, kind: "followup" })}
                          >
                            <Repeat2 className="size-4" />
                            <span className="hidden sm:inline">Follow-up</span>
                          </Button>
                        ) : p.status === "novo" ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={
                              !p.phone_e164 || p.has_whatsapp === false || sendingId === p.id
                            }
                            onClick={() => handleQuickSend(p)}
                            title="Enviar a mensagem do modelo pelo WhatsApp da INSYT"
                          >
                            {sendingId === p.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <MessageCircle className="size-4" />
                            )}
                            <span className="hidden sm:inline">Enviar</span>
                          </Button>
                        ) : null}
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button type="button" variant="ghost" size="icon-sm">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setMessageTarget({ p, kind: "primeira" })}>
                              <Sparkles className="size-4" />
                              Ver / personalizar mensagem
                            </DropdownMenuItem>
                            {p.status !== "novo" ? (
                              <DropdownMenuItem
                                disabled={!p.phone_e164}
                                onClick={() => setMessageTarget({ p, kind: "followup" })}
                              >
                                <Repeat2 className="size-4" />
                                Mandar follow-up
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem
                              disabled={!p.phone_e164}
                              onClick={() => handleOpenWaMe(p, followupDue ? "followup" : "primeira")}
                            >
                              <ExternalLink className="size-4" />
                              Abrir no wa.me
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleCopyMessage(p, followupDue ? "followup" : "primeira")}
                            >
                              Copiar mensagem
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {p.crm_client_id ? (
                              <>
                                <DropdownMenuItem
                                  render={<Link href={`/crm/${p.crm_client_id}`} />}
                                >
                                  <UserPlus className="size-4" />
                                  Ver no CRM
                                </DropdownMenuItem>
                                {p.phone_e164 ? (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      openConversation(
                                        p.whatsapp_jid ?? `${p.phone_e164}@s.whatsapp.net`,
                                      )
                                    }
                                  >
                                    <MessagesSquare className="size-4" />
                                    Abrir conversa
                                  </DropdownMenuItem>
                                ) : null}
                              </>
                            ) : (
                              <DropdownMenuItem onClick={() => handlePromote(p)}>
                                <UserPlus className="size-4" />
                                Enviar ao CRM
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleteTarget(p)}
                            >
                              <Trash2 className="size-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {filtered.length > shown.length ? (
          <div className="border-t border-[var(--insyt-border)] p-4 text-center">
            <Button type="button" variant="ghost" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
              Mostrar mais ({filtered.length - shown.length})
            </Button>
          </div>
        ) : null}
      </div>

      {messageTarget ? (
        <ProspectingMessageDialog
          key={`${messageTarget.p.id}-${messageTarget.kind}`}
          prospect={messageTarget.p}
          settings={settings}
          kind={messageTarget.kind}
          open
          onOpenChange={(open) => {
            if (!open) setMessageTarget(null);
          }}
          onSent={({ remoteJid, sentToday: count }) => {
            markSent(messageTarget.p.id, messageTarget.kind, count);
            toast.success(`Mensagem enviada para ${messageTarget.p.name}`, {
              action: { label: "Abrir conversa", onClick: () => openConversation(remoteJid) },
            });
          }}
        />
      ) : null}

      {batch ? (
        <ProspectingBatchSendDialog
          key={batch.key}
          open
          onOpenChange={(open) => {
            if (!open) setBatch(null);
          }}
          leads={rows.filter((row) => batch.ids.includes(row.p.id)).map((row) => row.p)}
          kind={batch.kind}
          settings={settings}
          sentToday={sentToday}
          whatsappReady={status.whatsapp}
          onLeadSent={(id, count) => markSent(id, batch.kind, count)}
          onLeadsChecked={(withIds, withoutIds) => {
            for (const id of withIds) patchLocal(id, { has_whatsapp: true });
            for (const id of withoutIds) patchLocal(id, { has_whatsapp: false });
          }}
          onFinished={() => {
            setSelected(new Set());
            router.refresh();
          }}
        />
      ) : null}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este lead?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} será removido da lista de prospecção. Essa ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ContactCell({ p }: { p: Prospect }) {
  if (!p.phone && !p.phone_e164 && !p.email && !p.instagram) {
    return <span className="text-sm text-[var(--insyt-muted)]">—</span>;
  }
  const fromSite = Boolean(p.site_whatsapp && p.site_whatsapp === p.phone_e164);

  return (
    <div className="space-y-1">
      {p.phone || p.phone_e164 ? (
        <>
          <p className="text-sm text-[var(--insyt-black)]">
            {fromSite || !p.phone ? formatBrPhone(p.phone_e164 ?? "") : p.phone}
          </p>
          {/* Verificado na Evolution ganha do palpite por dígitos:
              escritório com WhatsApp Business em linha fixa aparecia
              como "Fixo" e era pulado. */}
          <div className="flex flex-wrap gap-1">
            {p.has_whatsapp === true ? (
              <Badge className="bg-emerald-50 text-emerald-700">
                <BadgeCheck className="size-3" />
                Tem WhatsApp
              </Badge>
            ) : p.has_whatsapp === false ? (
              <Badge className="bg-rose-50 text-rose-700">Sem WhatsApp</Badge>
            ) : p.is_mobile ? (
              <Badge className="bg-emerald-50 text-emerald-700">
                <MessageCircle className="size-3" />
                WhatsApp provável
              </Badge>
            ) : (
              <Badge variant="secondary">Fixo</Badge>
            )}
            {fromSite ? (
              <Badge variant="secondary" title="Número achado no site do lead">
                do site
              </Badge>
            ) : null}
          </div>
        </>
      ) : null}
      {p.email ? (
        <p className="flex items-center gap-1 text-xs text-[var(--insyt-muted)]">
          <Mail className="size-3" />
          <a href={`mailto:${p.email}`} className="max-w-[180px] truncate hover:underline">
            {p.email}
          </a>
        </p>
      ) : null}
      {p.instagram ? (
        <a
          href={p.instagram}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-[var(--insyt-muted)] hover:text-[var(--insyt-primary)]"
        >
          <AtSign className="size-3" />
          <span className="max-w-[160px] truncate">
            {p.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, "")}
          </span>
        </a>
      ) : null}
    </div>
  );
}

function SiteCell({ p }: { p: Prospect }) {
  if (!p.website) {
    return (
      <Badge className="bg-[#fff4f0] font-semibold text-[var(--insyt-primary-dark)]">
        Sem site
      </Badge>
    );
  }
  const issues = p.site_issues ?? [];
  const siteScore = p.site_status === "ok" ? p.site_score : null;

  return (
    <div className="space-y-1">
      <a
        href={p.website}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm text-[var(--insyt-primary)] hover:underline"
      >
        <Globe className="size-3.5" />
        Ver site
        <ExternalLink className="size-3" />
      </a>
      {p.site_status === "offline" || p.site_status === "social" ? (
        <Badge className="bg-[#fff4f0] font-semibold text-[var(--insyt-primary-dark)]">
          {issues[0] ?? "Fora do ar"}
        </Badge>
      ) : issues.length > 0 ? (
        <p className="text-xs text-amber-700" title={issues.join("\n")}>
          {siteScore !== null ? (
            <span
              className={cn(
                "mr-1.5 inline-block rounded-full px-1.5 py-px text-[10px] font-bold",
                siteScore < 40
                  ? "bg-rose-50 text-rose-700"
                  : siteScore < 70
                    ? "bg-amber-50 text-amber-700"
                    : "bg-emerald-50 text-emerald-700",
              )}
            >
              Nota {siteScore}
            </span>
          ) : null}
          {issues[0]}
          {issues.length > 1 ? ` +${issues.length - 1}` : ""}
        </p>
      ) : p.site_checked_at ? (
        <p className="text-xs text-[var(--insyt-muted)]">Site ok</p>
      ) : (
        <p className="text-xs text-[var(--insyt-muted)]">Não analisado</p>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-[var(--insyt-black)] bg-[var(--insyt-black)] text-white"
          : "border-[var(--insyt-border)] bg-white text-[var(--insyt-slate)] hover:border-[var(--insyt-slate)]",
      )}
    >
      {children}
    </button>
  );
}

function StatPill({
  label,
  value,
  accent = false,
  onClick,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--insyt-muted)]">
        {label}
      </p>
      <p
        className={`text-3xl font-bold tracking-tight ${
          accent ? "text-[var(--insyt-primary)]" : "text-[var(--insyt-black)]"
        }`}
      >
        {value}
      </p>
    </>
  );

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="insyt-card flex flex-col items-start gap-2 p-5 text-left transition-colors hover:bg-[var(--insyt-canvas-alt)]/60"
    >
      {content}
    </button>
  ) : (
    <div className="insyt-card flex flex-col items-start gap-2 p-5">{content}</div>
  );
}
