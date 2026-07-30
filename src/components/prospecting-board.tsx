"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { BR_STATES } from "@/lib/br-states";
import { StateCityPicker } from "@/components/state-city-picker";
import { ProspectingTemplateSheet } from "@/components/prospecting-template-sheet";
import { ProspectingMessageSheet } from "@/components/prospecting-message-sheet";
import { ProspectingImportSheet } from "@/components/prospecting-import-sheet";
import {
  deleteProspect,
  promoteToCrm,
  refreshEnrichment,
  searchPlaces,
  sendProspectToConversas,
  updateProspectStatus,
} from "@/app/actions/prospecting";
import { buildWaMeUrl, fillTemplate } from "@/lib/phone";
import { INSYT_STUDIO_URL } from "@/types/prospecting";
import {
  PROSPECT_STATUS_ACCENT,
  PROSPECT_STATUS_LABELS,
  PROSPECT_STATUS_ORDER,
  type Prospect,
  type ProspectStatus,
} from "@/types/prospecting";

export function ProspectingBoard({
  initialProspects,
  template,
}: {
  initialProspects: Prospect[];
  template: string;
}) {
  const [niche, setNiche] = useState("");
  const [stateUf, setStateUf] = useState<string>("");
  const [city, setCity] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [onlyNoSite, setOnlyNoSite] = useState(false);
  const [messageProspect, setMessageProspect] = useState<Prospect | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Prospect | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [isSearching, startSearchTransition] = useTransition();
  const [isEnriching, startEnrichTransition] = useTransition();
  const [, startTransition] = useTransition();
  const router = useRouter();

  const prospects = initialProspects;
  const hasPendingEnrichment = prospects.some((p) => p.enrich_job_id);

  const stats = useMemo(
    () => ({
      total: prospects.length,
      noSite: prospects.filter((p) => !p.website).length,
      contacted: prospects.filter((p) => p.status !== "novo").length,
    }),
    [prospects],
  );

  const filtered = useMemo(
    () =>
      prospects.filter((p) => {
        if (statusFilter !== "todos" && p.status !== statusFilter) return false;
        if (onlyNoSite && p.website) return false;
        return true;
      }),
    [prospects, statusFilter, onlyNoSite],
  );

  function handleSearch() {
    const stateName = BR_STATES.find((s) => s.uf === stateUf)?.name;
    if (!niche.trim() || !city || !stateName) {
      toast.error("Informe o nicho, o estado e a cidade.");
      return;
    }

    startSearchTransition(async () => {
      const result = await searchPlaces(niche, city, stateName);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.total === 0) {
        toast.info("Nenhum negócio encontrado para essa busca.");
        return;
      }
      toast.success(
        `${result.imported} novo(s) lead(s) importado(s) de ${result.total} encontrado(s). O enriquecimento (e-mail, celular) roda em segundo plano — use "Atualizar dados" em alguns minutos.`,
      );
    });
  }

  function handleRefreshEnrichment() {
    startEnrichTransition(async () => {
      const result = await refreshEnrichment();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.pendingJobs && result.pendingJobs > 0) {
        toast.info(
          `${result.updated ?? 0} lead(s) atualizado(s); ainda há enriquecimento em andamento. Tente de novo em alguns minutos.`,
        );
        return;
      }
      toast.success(`${result.updated ?? 0} lead(s) atualizado(s) com dados enriquecidos.`);
    });
  }

  function messageFor(p: Prospect) {
    const base =
      p.custom_message ??
      fillTemplate(template, {
        nome: p.name,
        cidade: p.city,
        hasSite: Boolean(p.website),
        portfolioUrl: INSYT_STUDIO_URL,
      });
    if (base.includes("insytstudio.com.br")) return base;
    return `${base.trim()}\n\nAlguns projetos nossos: ${INSYT_STUDIO_URL}`;
  }

  function handleOpenWhatsApp(p: Prospect) {
    if (!p.phone_e164) return;
    window.open(buildWaMeUrl(p.phone_e164, messageFor(p)), "_blank");
  }

  function handleSendWhatsApp(p: Prospect) {
    if (!p.phone_e164) {
      toast.error("Este lead não tem telefone válido.");
      return;
    }

    setSendingId(p.id);
    startTransition(async () => {
      const result = await sendProspectToConversas(p.id, messageFor(p));
      setSendingId(null);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Mensagem enviada pelo WhatsApp da INSYT");
      router.push(
        `/crm?view=conversas&chat=${encodeURIComponent(result.remoteJid!)}`,
      );
      router.refresh();
    });
  }

  function handleCopyMessage(p: Prospect) {
    navigator.clipboard.writeText(messageFor(p));
    toast.success("Mensagem copiada!");
  }

  function handleStatusChange(p: Prospect, status: ProspectStatus) {
    startTransition(async () => {
      const result = await updateProspectStatus(p.id, status);
      if (result.error) toast.error(result.error);
    });
  }

  function handlePromote(p: Prospect) {
    startTransition(async () => {
      const result = await promoteToCrm(p.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Lead enviado ao CRM!");
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deleteProspect(id);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-6">
      {/* Busca */}
      <div className="insyt-card p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="prospect-niche">Nicho</Label>
            <Input
              id="prospect-niche"
              placeholder="Ex: advocacia, clínica odontológica, imobiliária..."
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
            />
          </div>
          <StateCityPicker
            stateUf={stateUf}
            city={city}
            onStateChange={setStateUf}
            onCityChange={setCity}
            stateClassName="w-full lg:w-48"
            cityClassName="flex-1"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleSearch} disabled={isSearching}>
              {isSearching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              Buscar leads
            </Button>
            {hasPendingEnrichment ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleRefreshEnrichment}
                disabled={isEnriching}
                title="Aplicar dados enriquecidos (e-mail, celular)"
              >
                {isEnriching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Atualizar dados
              </Button>
            ) : null}
            <ProspectingImportSheet />
            <ProspectingTemplateSheet template={template} />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatPill label="Leads captados" value={stats.total} />
        <StatPill label="Sem site" value={stats.noSite} accent />
        <StatPill label="Já abordados" value={stats.contacted} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-4">
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
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--insyt-slate)]">
          <Switch checked={onlyNoSite} onCheckedChange={setOnlyNoSite} />
          Só sem site
        </label>
      </div>

      {/* Tabela */}
      <div className="insyt-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
            <MapPin className="size-8 text-[var(--insyt-muted)]" />
            <p className="text-[var(--insyt-slate)]">
              {prospects.length === 0
                ? "Nenhum lead ainda. Busque um nicho e uma cidade para começar."
                : "Nenhum lead com esses filtros."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--insyt-border)] hover:bg-transparent">
                <TableHead className="pl-6">Negócio</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Avaliação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10 pr-6" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow
                  key={p.id}
                  className="group border-[var(--insyt-border)] transition-colors hover:bg-[var(--insyt-canvas-alt)]/50"
                >
                  <TableCell className="max-w-[280px] py-4 pl-6">
                    <p className="truncate font-semibold text-[var(--insyt-black)]">
                      {p.name}
                    </p>
                    <p className="truncate text-xs text-[var(--insyt-muted)]">
                      {p.address ?? `${p.niche} · ${p.city}`}
                    </p>
                  </TableCell>
                  <TableCell className="py-4">
                    {p.phone || p.email ? (
                      <div className="space-y-1">
                        {p.phone ? (
                          <>
                            <p className="text-sm text-[var(--insyt-black)]">{p.phone}</p>
                            {p.is_mobile ? (
                              <Badge className="bg-emerald-50 text-emerald-700">
                                <MessageCircle className="size-3" />
                                WhatsApp provável
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Fixo</Badge>
                            )}
                          </>
                        ) : null}
                        {p.email ? (
                          <p className="flex items-center gap-1 text-xs text-[var(--insyt-muted)]">
                            <Mail className="size-3" />
                            <span className="max-w-[180px] truncate">{p.email}</span>
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-sm text-[var(--insyt-muted)]">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-4">
                    {p.website ? (
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
                    ) : (
                      <Badge className="bg-[#fff4f0] font-semibold text-[var(--insyt-primary-dark)]">
                        Sem site
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-4">
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
                  <TableCell className="py-4">
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
                  </TableCell>
                  <TableCell className="py-4 pr-6">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        disabled={!p.phone_e164 || sendingId === p.id}
                        onClick={() => handleSendWhatsApp(p)}
                        title="Enviar pelo WhatsApp da INSYT"
                      >
                        {sendingId === p.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <MessageCircle className="size-4" />
                        )}
                        <span className="hidden sm:inline">Enviar</span>
                      </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button type="button" variant="ghost" size="icon-sm">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={!p.phone_e164 || sendingId === p.id}
                          onClick={() => handleSendWhatsApp(p)}
                        >
                          <MessageCircle className="size-4" />
                          Enviar pelo WhatsApp
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!p.phone_e164}
                          onClick={() => handleOpenWhatsApp(p)}
                        >
                          Abrir no wa.me
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCopyMessage(p)}>
                          Copiar mensagem
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setMessageProspect(p)}>
                          <Sparkles className="size-4" />
                          Editar / personalizar mensagem
                        </DropdownMenuItem>
                        {p.crm_client_id ? (
                          <DropdownMenuItem
                            render={<Link href={`/crm/${p.crm_client_id}`} />}
                          >
                            <UserPlus className="size-4" />
                            Ver no CRM
                          </DropdownMenuItem>
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
        )}
      </div>

      {messageProspect ? (
        <ProspectingMessageSheet
          prospect={messageProspect}
          template={template}
          open
          onOpenChange={(open) => {
            if (!open) setMessageProspect(null);
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

function StatPill({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="insyt-card flex items-center justify-between p-5">
      <p className="text-sm font-medium uppercase tracking-wider text-[var(--insyt-muted)]">
        {label}
      </p>
      <p
        className={`text-3xl font-bold tracking-tight ${
          accent ? "text-[var(--insyt-primary)]" : "text-[var(--insyt-black)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
