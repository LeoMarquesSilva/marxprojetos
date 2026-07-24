"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { BR_STATES, fetchCitiesForState } from "@/lib/br-states";

// Estado -> Cidade com a lista de municípios carregada do IBGE por UF, para
// evitar campo de cidade em texto livre (fácil de digitar errado). Usado na
// busca da Prospecção e na importação de CSV.
export function StateCityPicker({
  stateUf,
  city,
  onStateChange,
  onCityChange,
  stateClassName,
  cityClassName,
}: {
  stateUf: string;
  city: string | null;
  onStateChange: (uf: string) => void;
  onCityChange: (city: string | null) => void;
  stateClassName?: string;
  cityClassName?: string;
}) {
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const citiesCache = useRef<Record<string, string[]>>({});
  const latestUf = useRef<string>("");

  function handleStateChange(value: string | null) {
    const uf = value ?? "";
    onStateChange(uf);
    onCityChange(null);

    if (!uf) {
      setCities([]);
      return;
    }

    const cached = citiesCache.current[uf];
    if (cached) {
      setCities(cached);
      return;
    }

    setCities([]);
    setLoadingCities(true);
    latestUf.current = uf;
    fetchCitiesForState(uf)
      .then((list) => {
        citiesCache.current[uf] = list;
        // Ignora respostas de um estado que o usuário já trocou.
        if (latestUf.current === uf) setCities(list);
      })
      .catch(() => {
        if (latestUf.current === uf) {
          toast.error("Não consegui carregar as cidades. Tente de novo.");
        }
      })
      .finally(() => {
        if (latestUf.current === uf) setLoadingCities(false);
      });
  }

  return (
    <>
      <div className={cn("space-y-2", stateClassName)}>
        <Label>Estado</Label>
        <Select value={stateUf || null} onValueChange={handleStateChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecionar...">
              {(value: string | null) =>
                BR_STATES.find((s) => s.uf === value)?.name ?? "Selecionar..."
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {BR_STATES.map((s) => (
              <SelectItem key={s.uf} value={s.uf}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={cn("space-y-2", cityClassName)}>
        <Label>Cidade</Label>
        <Combobox
          items={cities}
          value={city}
          onValueChange={onCityChange}
          disabled={!stateUf || loadingCities}
        >
          <ComboboxInput
            placeholder={
              !stateUf
                ? "Escolha o estado primeiro"
                : loadingCities
                  ? "Carregando cidades..."
                  : "Digite para buscar a cidade"
            }
          />
          <ComboboxContent emptyMessage="Nenhuma cidade encontrada.">
            <ComboboxList>
              {(item: string) => (
                <ComboboxItem key={item} value={item}>
                  {item}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
    </>
  );
}
