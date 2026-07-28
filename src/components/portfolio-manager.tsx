"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  ExternalLink,
  Globe2,
  ImageIcon,
  Loader2,
  Pencil,
  Rocket,
} from "lucide-react";
import { toast } from "sonner";
import {
  updatePortfolioSettings,
  updateProjectEditorial,
} from "@/app/actions/portfolio";
import type {
  PortfolioAdminItem,
  PortfolioCaseRecord,
} from "@/app/actions/portfolio";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export function PortfolioManager({
  initialProjects,
  cases = [],
}: {
  initialProjects: PortfolioAdminItem[];
  cases?: PortfolioCaseRecord[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<PortfolioAdminItem | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const publishedCount = initialProjects.filter(
    (project) => project.portfolio_published,
  ).length;

  function togglePublished(project: PortfolioAdminItem, published: boolean) {
    setUpdatingId(project.id);
    startTransition(async () => {
      const result = await updatePortfolioSettings(project.id, {
        published,
        description: project.portfolio_description ?? "",
        coverUrl: project.portfolio_cover_url ?? "",
      });
      setUpdatingId(null);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(published ? "Projeto publicado." : "Projeto ocultado.");
      router.refresh();
    });
  }

  async function copyPublicLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/portfolio`);
    toast.success("Link público copiado.");
  }

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        <Metric
          value={initialProjects.length}
          label="projetos disponíveis"
          icon={Globe2}
        />
        <Metric value={publishedCount} label="cases publicados" icon={Rocket} />
        <button
          type="button"
          onClick={copyPublicLink}
          className="group insyt-card flex min-h-32 items-center justify-between gap-5 p-6 text-left transition-transform duration-300 hover:-translate-y-1"
        >
          <div>
            <p className="text-sm text-[var(--insyt-muted)]">Link de prospecção</p>
            <p className="mt-2 font-semibold text-[var(--insyt-black)]">
              Copiar portfólio
            </p>
          </div>
          <span className="flex size-11 items-center justify-center rounded-full bg-[var(--insyt-black)] text-white transition-colors group-hover:bg-[var(--insyt-primary)]">
            <Copy className="size-4" />
          </span>
        </button>
      </section>

      <section className="insyt-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[var(--insyt-border)] px-6 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--insyt-primary)]">
              Curadoria
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[var(--insyt-black)]">
              Selecione seus melhores trabalhos
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-[var(--insyt-muted)]">
            Publique apenas os projetos que reforçam o tipo de cliente que você
            deseja conquistar.
          </p>
        </div>

        {initialProjects.length === 0 ? (
          <div className="px-6 py-24 text-center">
            <Globe2 className="mx-auto size-8 text-[var(--insyt-muted)]" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum projeto disponível</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--insyt-muted)]">
              Crie um briefing e vincule o site para começar a montar o
              portfólio.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--insyt-border)]">
            {initialProjects.map((project, index) => {
              const canVisit = project.review_enabled && project.review_site_path;
              const isUpdating = isPending && updatingId === project.id;

              return (
                <article
                  key={project.id}
                  className="group grid gap-5 px-6 py-6 transition-colors hover:bg-[var(--insyt-canvas)]/70 sm:grid-cols-[112px_1fr_auto] sm:items-center sm:px-8"
                >
                  <div
                    className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[var(--insyt-canvas-alt)] bg-cover bg-center"
                    style={
                      project.portfolio_cover_url
                        ? {
                            backgroundImage: `url("${project.portfolio_cover_url}")`,
                          }
                        : undefined
                    }
                  >
                    {!project.portfolio_cover_url ? (
                      <div className="flex h-full items-center justify-center">
                        <ImageIcon className="size-5 text-[var(--insyt-muted)]" />
                      </div>
                    ) : null}
                    <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold tracking-wider text-white backdrop-blur">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-bold text-[var(--insyt-black)]">
                        {project.title}
                      </h3>
                      {project.portfolio_published ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                          <Check className="size-3" />
                          Publicado
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Rascunho</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-[var(--insyt-muted)]">
                      {project.client_company ||
                        project.client_name ||
                        "Cliente não informado"}
                    </p>
                    <p className="mt-2 line-clamp-1 text-sm text-[var(--insyt-slate)]">
                      {project.portfolio_description ||
                        "Adicione uma descrição curta para transformar o projeto em case."}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 sm:justify-end">
                    {canVisit ? (
                      <a
                        href={`/sites/${project.review_site_path}/index.html`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex size-9 items-center justify-center rounded-full text-[var(--insyt-muted)] transition-colors hover:bg-white hover:text-[var(--insyt-black)]"
                        aria-label={`Abrir ${project.title}`}
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelected(project)}
                    >
                      <Pencil className="size-3.5" />
                      Editar
                    </Button>
                    <Switch
                      checked={project.portfolio_published}
                      disabled={isUpdating}
                      onCheckedChange={(checked) =>
                        togglePublished(project, checked)
                      }
                      aria-label={`Publicar ${project.title}`}
                    />
                    {isUpdating ? (
                      <Loader2 className="size-4 animate-spin text-[var(--insyt-primary)]" />
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected ? (
            <PortfolioEditor
              key={selected.id}
              project={selected}
              cases={cases}
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

function Metric({
  value,
  label,
  icon: Icon,
}: {
  value: number;
  label: string;
  icon: typeof Globe2;
}) {
  return (
    <div className="insyt-card flex min-h-32 items-center justify-between gap-5 p-6">
      <div>
        <p className="text-3xl font-bold text-[var(--insyt-black)]">{value}</p>
        <p className="mt-1 text-sm text-[var(--insyt-muted)]">{label}</p>
      </div>
      <span className="flex size-11 items-center justify-center rounded-full bg-[#fff1ec] text-[var(--insyt-primary)]">
        <Icon className="size-4" />
      </span>
    </div>
  );
}

function PortfolioEditor({
  project,
  cases,
  onSaved,
}: {
  project: PortfolioAdminItem;
  cases: PortfolioCaseRecord[];
  onSaved: () => void;
}) {
  const [published, setPublished] = useState(project.portfolio_published);
  const [description, setDescription] = useState(
    project.portfolio_description ?? "",
  );
  const [coverUrl, setCoverUrl] = useState(project.portfolio_cover_url ?? "");
  const [caseId, setCaseId] = useState(project.portfolio_case_id);
  const [eyebrow, setEyebrow] = useState(project.portfolio_eyebrow ?? "");
  const [objective, setObjective] = useState(project.portfolio_objective ?? "");
  const [solution, setSolution] = useState(project.portfolio_solution ?? "");
  const [deliverables, setDeliverables] = useState(
    (project.portfolio_deliverables ?? []).join("\n"),
  );
  const [imageAlt, setImageAlt] = useState(project.portfolio_image_alt ?? "");
  const [isPending, startTransition] = useTransition();

  const belongsToCase = Boolean(caseId);

  function save() {
    startTransition(async () => {
      const settings = await updatePortfolioSettings(project.id, {
        published,
        description,
        coverUrl,
      });

      if (settings.error) {
        toast.error(settings.error);
        return;
      }

      const editorial = await updateProjectEditorial(project.id, {
        eyebrow,
        objective,
        solution,
        deliverables: deliverables.split("\n"),
        imageAlt,
        caseId,
      });

      if (editorial.error) {
        toast.error(editorial.error);
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
        <SheetDescription>{project.title}</SheetDescription>
      </SheetHeader>

      <div className="space-y-6 px-6 py-4">
        <div
          className="aspect-video overflow-hidden rounded-2xl bg-[var(--insyt-canvas-alt)] bg-cover bg-center"
          style={
            coverUrl
              ? { backgroundImage: `url("${coverUrl}")` }
              : undefined
          }
        >
          {!coverUrl ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--insyt-muted)]">
              <ImageIcon className="size-6" />
              <span className="text-xs">Prévia da capa</span>
            </div>
          ) : null}
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-[var(--insyt-canvas)] p-4">
          <div>
            <p className="text-sm font-semibold">Publicar no portfólio</p>
            <p className="mt-1 text-xs text-[var(--insyt-muted)]">
              O projeto ficará visível no link público.
            </p>
          </div>
          <Switch checked={published} onCheckedChange={setPublished} />
        </label>

        <div className="space-y-2">
          <Label htmlFor="manager-portfolio-description">
            História em uma frase
          </Label>
          <Textarea
            id="manager-portfolio-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Ex: Reposicionamos a presença digital do escritório com uma experiência sóbria e focada em novos contatos."
            rows={5}
            maxLength={280}
          />
          <p className="text-right text-xs text-[var(--insyt-muted)]">
            {description.length}/280
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="manager-portfolio-cover">Imagem de capa</Label>
          <Input
            id="manager-portfolio-cover"
            type="url"
            value={coverUrl}
            onChange={(event) => setCoverUrl(event.target.value)}
            placeholder="https://..."
          />
          <p className="text-xs leading-relaxed text-[var(--insyt-muted)]">
            Use um print horizontal do site, de preferência com proporção 16:10.
          </p>
        </div>

        {cases.length > 0 ? (
          <div className="space-y-2">
            <Label htmlFor="manager-case">Agrupar em um case</Label>
            <select
              id="manager-case"
              value={caseId ?? ""}
              onChange={(event) => setCaseId(event.target.value || null)}
              className="w-full rounded-xl border border-transparent bg-[var(--insyt-canvas)] px-4 py-3 text-sm font-medium text-[var(--insyt-black)] outline-none transition-all duration-300 hover:border-[var(--insyt-border)] hover:bg-white focus:border-[var(--insyt-primary)]/50 focus:bg-white focus:ring-4 focus:ring-[var(--insyt-primary)]/10"
            >
              <option value="">Sem case (card simples)</option>
              {cases.map((portfolioCase) => (
                <option key={portfolioCase.id} value={portfolioCase.id}>
                  {portfolioCase.client}
                </option>
              ))}
            </select>
            <p className="text-xs leading-relaxed text-[var(--insyt-muted)]">
              Projetos em um case aparecem juntos, em destaque no topo da
              página, com os textos editoriais abaixo.
            </p>
          </div>
        ) : null}

        {belongsToCase ? (
          <div className="space-y-6 rounded-2xl border border-[var(--insyt-border)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--insyt-primary)]">
              Conteúdo do case
            </p>

            <div className="space-y-2">
              <Label htmlFor="manager-eyebrow">Etiqueta</Label>
              <Input
                id="manager-eyebrow"
                value={eyebrow}
                onChange={(event) => setEyebrow(event.target.value)}
                placeholder="Ex: Site institucional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manager-objective">Objetivo</Label>
              <Textarea
                id="manager-objective"
                value={objective}
                onChange={(event) => setObjective(event.target.value)}
                rows={3}
                placeholder="Qual problema o projeto precisava resolver?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manager-solution">Solução</Label>
              <Textarea
                id="manager-solution"
                value={solution}
                onChange={(event) => setSolution(event.target.value)}
                rows={3}
                placeholder="O que foi entregue para resolver isso?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manager-deliverables">Entregas</Label>
              <Textarea
                id="manager-deliverables"
                value={deliverables}
                onChange={(event) => setDeliverables(event.target.value)}
                rows={5}
                placeholder={"UX/UI\nDesenvolvimento responsivo\nSEO local"}
              />
              <p className="text-xs leading-relaxed text-[var(--insyt-muted)]">
                Uma entrega por linha. Aparecem como etiquetas no card.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manager-image-alt">Descrição da imagem</Label>
              <Input
                id="manager-image-alt"
                value={imageAlt}
                onChange={(event) => setImageAlt(event.target.value)}
                placeholder="Ex: Hero do site, com navegação e chamada principal"
              />
            </div>
          </div>
        ) : null}

        {!project.review_enabled || !project.review_site_path ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
            Este briefing ainda não tem um site vinculado. O case pode ser
            publicado, mas o botão para visitar o projeto não aparecerá.
          </div>
        ) : null}

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
