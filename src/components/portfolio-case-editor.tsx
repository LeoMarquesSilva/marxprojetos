"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Layers3, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  updatePortfolioCase,
  type PortfolioCaseRecord,
} from "@/app/actions/portfolio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

// Serviços e entregas são listas curtas: uma por linha evita ambiguidade com
// vírgulas dentro do próprio texto.
function toLines(values: string[]) {
  return values.join("\n");
}
function fromLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function PortfolioCaseEditor({
  cases,
  chapterCountByCase,
}: {
  cases: PortfolioCaseRecord[];
  chapterCountByCase: Record<string, number>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<PortfolioCaseRecord | null>(null);

  if (cases.length === 0) return null;

  return (
    <>
      <section className="insyt-card overflow-hidden">
        <div className="border-b border-[var(--insyt-border)] px-6 py-6 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--insyt-primary)]">
            Cases
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[var(--insyt-black)]">
            Clientes com mais de um projeto
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--insyt-muted)]">
            O case agrupa projetos do mesmo cliente num bloco de destaque no
            topo da página pública.
          </p>
        </div>

        <div className="divide-y divide-[var(--insyt-border)]">
          {cases.map((portfolioCase) => {
            const count = chapterCountByCase[portfolioCase.id] ?? 0;

            return (
              <article
                key={portfolioCase.id}
                className="grid gap-4 px-6 py-6 transition-colors hover:bg-[var(--insyt-canvas)]/70 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:px-8"
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-[#fff1ec] text-[var(--insyt-primary)]">
                  <Layers3 className="size-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold text-[var(--insyt-black)]">
                    {portfolioCase.client}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--insyt-muted)]">
                    {count === 0
                      ? "Nenhum projeto publicado — o case não aparece na página."
                      : `${count} ${count === 1 ? "projeto publicado" : "projetos publicados"}`}
                  </p>
                  <p className="mt-2 line-clamp-1 text-sm text-[var(--insyt-slate)]">
                    {portfolioCase.summary || "Sem resumo."}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(portfolioCase)}
                >
                  <Pencil className="size-3.5" />
                  Editar
                </Button>
              </article>
            );
          })}
        </div>
      </section>

      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected ? (
            <CaseEditorForm
              key={selected.id}
              portfolioCase={selected}
              onSaved={() => {
                setSelected(null);
                router.refresh();
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function CaseEditorForm({
  portfolioCase,
  onSaved,
}: {
  portfolioCase: PortfolioCaseRecord;
  onSaved: () => void;
}) {
  const [client, setClient] = useState(portfolioCase.client);
  const [summary, setSummary] = useState(portfolioCase.summary ?? "");
  const [services, setServices] = useState(toLines(portfolioCase.services ?? []));
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updatePortfolioCase(portfolioCase.id, {
        client,
        summary,
        services: fromLines(services),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Case atualizado.");
      onSaved();
    });
  }

  return (
    <>
      <SheetHeader className="border-b border-[var(--insyt-border)] px-6 py-6">
        <SheetTitle className="text-2xl font-bold">Editar case</SheetTitle>
        <SheetDescription>{portfolioCase.client}</SheetDescription>
      </SheetHeader>

      <div className="space-y-6 px-6 py-4">
        <div className="space-y-2">
          <Label htmlFor="case-client">Cliente</Label>
          <Input
            id="case-client"
            value={client}
            onChange={(event) => setClient(event.target.value)}
          />
          <p className="text-xs text-[var(--insyt-muted)]">
            Aparece como título do bloco de case.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="case-summary">Resumo</Label>
          <Textarea
            id="case-summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={5}
            maxLength={400}
            placeholder="Ex: Uma presença digital construída para traduzir décadas de experiência em autoridade."
          />
          <p className="text-right text-xs text-[var(--insyt-muted)]">
            {summary.length}/400
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="case-services">Serviços</Label>
          <Textarea
            id="case-services"
            value={services}
            onChange={(event) => setServices(event.target.value)}
            rows={5}
            placeholder={"Estratégia\nConteúdo\nUX/UI"}
          />
          <p className="text-xs leading-relaxed text-[var(--insyt-muted)]">
            Um serviço por linha. Aparecem como etiquetas ao lado do resumo.
          </p>
        </div>

        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={save}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Salvar case
        </Button>
      </div>
    </>
  );
}
