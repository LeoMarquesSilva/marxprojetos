"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProspectingDialogShell } from "@/components/prospecting-dialog-shell";
import { StateCityPicker } from "@/components/state-city-picker";
import { importProspectsCsv } from "@/app/actions/prospecting";
import { BR_STATES } from "@/lib/br-states";

export function ProspectingImportDialog({
  onImported,
}: {
  onImported: (newIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [niche, setNiche] = useState("");
  const [stateUf, setStateUf] = useState("");
  const [city, setCity] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setNiche("");
    setStateUf("");
    setCity(null);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleImport() {
    const stateName = BR_STATES.find((s) => s.uf === stateUf)?.name;
    if (!niche.trim() || !stateName || !city || !file) {
      toast.error("Selecione o arquivo, o nicho, o estado e a cidade.");
      return;
    }

    startTransition(async () => {
      const csvText = await file.text();
      const result = await importProspectsCsv(csvText, niche, city);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `${result.imported} novo(s) lead(s) de ${result.total} linha(s) (${result.noSite} sem site).`,
      );
      reset();
      setOpen(false);
      onImported(result.newIds ?? []);
    });
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Upload className="size-4" />
        Importar CSV
      </Button>

      <ProspectingDialogShell
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
        title="Importar leads de um CSV"
        description="Aceita o export do LocalProspects, do Apify, do Outscraper ou uma planilha sua (separada por vírgula ou ponto e vírgula). Colunas reconhecidas: nome/title/business_name, telefone/phone, site/website, email, endereço/address, rating, reviews, place_id."
        footer={
          <Button type="button" className="w-full" onClick={handleImport} disabled={isImporting}>
            {isImporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Importar
          </Button>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="import-niche">Nicho</Label>
          <Input
            id="import-niche"
            placeholder="Ex: advocacia"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <StateCityPicker
            stateUf={stateUf}
            city={city}
            onStateChange={setStateUf}
            onCityChange={setCity}
            stateClassName="sm:w-48"
            cityClassName="flex-1"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="import-file">Arquivo CSV</Label>
          <input
            ref={fileInputRef}
            id="import-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-transparent bg-[var(--insyt-canvas)] px-4 py-3 text-sm text-[var(--insyt-black)] transition-all duration-300 ease-fluid file:mr-3 file:rounded-full file:border-0 file:bg-[var(--insyt-primary)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:border-[var(--insyt-border)] hover:bg-white"
          />
          {file ? <p className="text-xs text-[var(--insyt-muted)]">{file.name}</p> : null}
        </div>
      </ProspectingDialogShell>
    </>
  );
}
