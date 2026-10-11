"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StateCityPicker } from "@/components/state-city-picker";
import {
  queueMapsSearch,
  searchPlaces,
  type ProspectingStatus,
  type SearchMode,
  type SearchProvider,
} from "@/app/actions/prospecting";
import { BR_STATES } from "@/lib/br-states";
import { PROSPECT_SEGMENTS, findSegment } from "@/lib/prospecting/segments";
import { cn } from "@/lib/utils";

const PROVIDERS: { value: SearchProvider; label: string; env: string | null }[] = [
  { value: "maps", label: "Google Maps — robô próprio (grátis)", env: null },
  { value: "google", label: "Google Places API (oficial)", env: "GOOGLE_PLACES_API_KEY" },
  { value: "apify", label: "Apify (robô pago)", env: "APIFY_TOKEN" },
  { value: "localprospects", label: "LocalProspects", env: "LOCALPROSPECTS_API_KEY" },
];

const MODES: { value: SearchMode; label: string }[] = [
  { value: "padrao", label: "Padrão — só o termo digitado" },
  { value: "ampla", label: "Ampla — termo + sinônimos do nicho" },
  { value: "varredura", label: "Varredura — cidade inteira em quadrantes" },
];

function costHint(provider: SearchProvider, mode: SearchMode) {
  if (provider === "maps") {
    const reach =
      mode === "varredura"
        ? "Varre a cidade em 9 quadrantes (~3 min) e passa do limite da lista única do Maps."
        : mode === "ampla"
          ? "Busca até 4 termos do nicho, ~30s cada."
          : "Até ~120 empresas, em cerca de 30s.";
    return `O robô abre o Google Maps no seu computador, rola a lista e lê cada empresa — sem API e sem custo. ${reach} Depois ele mesmo analisa os sites e verifica o WhatsApp.`;
  }
  if (provider === "google") {
    if (mode === "varredura") {
      return "Divide a cidade em 9 áreas e busca até 60 em cada — centenas de leads, ~28 requisições.";
    }
    if (mode === "ampla") {
      return "Até 4 termos × 60 resultados (~12 requisições). O Google dá 1.000 requisições grátis por mês.";
    }
    return "Até 60 resultados (3 requisições). O Google dá 1.000 requisições grátis por mês.";
  }
  if (provider === "apify") {
    return "Passa do limite de 60 do Google e já traz e-mail e Instagram do site. Cobrado por resultado no Apify (há crédito grátis mensal).";
  }
  return "Usa créditos do LocalProspects; e-mail e celular chegam depois em \"Atualizar dados\".";
}

export function ProspectingSearchPanel({
  status,
  workerOnline,
  onSearched,
  onQueued,
}: {
  status: ProspectingStatus;
  workerOnline: boolean;
  onSearched: (newIds: string[]) => void;
  onQueued: () => void;
}) {
  const [provider, setProvider] = useState<SearchProvider>("maps");
  const [mode, setMode] = useState<SearchMode>("padrao");
  const [niche, setNiche] = useState("");
  const [segmentId, setSegmentId] = useState<string | null>(null);
  const [stateUf, setStateUf] = useState("");
  const [city, setCity] = useState<string | null>(null);
  const [isSearching, startSearchTransition] = useTransition();

  const selectedSegment = findSegment(segmentId);
  const providerReady = status.providers[provider];

  function pickSegment(id: string) {
    const segment = findSegment(id);
    if (!segment) return;
    if (segmentId === id) {
      setSegmentId(null);
      return;
    }
    setSegmentId(id);
    setNiche(segment.terms[0]);
    if (mode === "padrao") setMode("ampla");
  }

  function handleSearch() {
    const stateName = BR_STATES.find((s) => s.uf === stateUf)?.name;
    if (!niche.trim() || !city || !stateName) {
      toast.error("Informe o nicho, o estado e a cidade.");
      return;
    }

    if (provider === "maps") {
      startSearchTransition(async () => {
        const result = await queueMapsSearch({ niche, city, state: stateUf, mode, segmentId });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(
          workerOnline
            ? "Busca na fila — o robô já está abrindo o Google Maps."
            : "Busca na fila. Ligue o robô no computador (npm run maps:robo) para ela rodar.",
        );
        onQueued();
      });
      return;
    }

    startSearchTransition(async () => {
      const result = await searchPlaces({
        niche,
        city,
        state: stateName,
        provider,
        mode,
        segmentId,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (!result.total) {
        toast.info(
          result.closedSkipped
            ? `Só achei negócios fechados (${result.closedSkipped}).`
            : "Nenhum negócio encontrado para essa busca.",
        );
        return;
      }
      const parts = [
        `${result.imported} novo(s) de ${result.total} encontrado(s)`,
        result.updated ? `${result.updated} já existente(s) atualizado(s)` : null,
        result.closedSkipped ? `${result.closedSkipped} fechado(s) ignorado(s)` : null,
      ].filter(Boolean);
      toast.success(`${parts.join(" · ")}.`);
      onSearched(result.newIds ?? []);
    });
  }

  return (
    <div className="insyt-card space-y-5 p-6">
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--insyt-muted)]">
          <Sparkles className="size-3.5 text-[var(--insyt-primary)]" />
          Nichos em que já temos case
        </p>
        <div className="flex flex-wrap gap-2">
          {PROSPECT_SEGMENTS.map((segment) => (
            <button
              key={segment.id}
              type="button"
              onClick={() => pickSegment(segment.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                segmentId === segment.id
                  ? "border-[var(--insyt-primary)] bg-[#fff4f0] text-[var(--insyt-primary-dark)]"
                  : "border-[var(--insyt-border)] bg-white text-[var(--insyt-slate)] hover:border-[var(--insyt-slate)]",
              )}
            >
              {segment.label}
            </button>
          ))}
        </div>
        {selectedSegment ? (
          <p className="text-xs text-[var(--insyt-slate)]">
            {selectedSegment.angle} Termos:{" "}
            <span className="text-[var(--insyt-muted)]">{selectedSegment.terms.join(" · ")}</span>
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="prospect-niche">Nicho</Label>
          <Input
            id="prospect-niche"
            placeholder="Ex: advogado criminalista, clínica geriátrica..."
            value={niche}
            onChange={(e) => {
              setNiche(e.target.value);
              if (segmentId && !findSegment(segmentId)?.terms.includes(e.target.value)) {
                setSegmentId(null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
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
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="space-y-2 lg:w-72">
          <Label>Fonte</Label>
          <Select value={provider} onValueChange={(v) => v && setProvider(v as SearchProvider)}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {(value: string | null) =>
                  PROVIDERS.find((item) => item.value === value)?.label ?? "Fonte"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                  {status.providers[item.value] ? "" : " (não configurado)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 lg:w-80">
          <Label>Abrangência</Label>
          <Select value={mode} onValueChange={(v) => v && setMode(v as SearchMode)}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {(value: string | null) =>
                  MODES.find((item) => item.value === value)?.label.split(" — ")[0] ?? "Padrão"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MODES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          onClick={handleSearch}
          disabled={isSearching || !providerReady}
          className="lg:ml-auto"
        >
          {isSearching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          {isSearching ? "Buscando…" : provider === "maps" ? "Buscar no Maps" : "Buscar leads"}
        </Button>
      </div>

      <p className="text-xs text-[var(--insyt-muted)]">
        {providerReady ? (
          costHint(provider, mode)
        ) : (
          <>
            Fonte não configurada: defina{" "}
            <code className="rounded bg-[var(--insyt-canvas-alt)] px-1">
              {PROVIDERS.find((item) => item.value === provider)?.env}
            </code>{" "}
            no .env e na Vercel — ou use o robô próprio, que não precisa de chave.
          </>
        )}
        {provider === "maps" && !workerOnline ? (
          <span className="mt-1 block font-medium text-amber-700">
            O robô está desligado. No computador, rode{" "}
            <code className="rounded bg-[var(--insyt-canvas-alt)] px-1">npm run maps:robo</code> —
            a busca espera na fila até ele ligar.
          </span>
        ) : null}
      </p>
    </div>
  );
}
