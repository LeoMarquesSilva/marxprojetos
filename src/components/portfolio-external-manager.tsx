"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ExternalLink,
  ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  createExternalProject,
  deleteExternalProject,
  moveExternalProject,
  updateExternalProject,
  type PortfolioExternalAdminItem,
} from "@/app/actions/portfolio";
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

type EditorState =
  | { mode: "create" }
  | { mode: "edit"; project: PortfolioExternalAdminItem };

export function PortfolioExternalManager({
  projects,
}: {
  projects: PortfolioExternalAdminItem[];
}) {
  const router = useRouter();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<PortfolioExternalAdminItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function move(project: PortfolioExternalAdminItem, direction: "up" | "down") {
    setBusyId(project.id);
    startTransition(async () => {
      const result = await moveExternalProject(project.id, direction);
      setBusyId(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function togglePublished(
    project: PortfolioExternalAdminItem,
    published: boolean,
  ) {
    setBusyId(project.id);
    startTransition(async () => {
      const result = await updateExternalProject(project.id, {
        title: project.title,
        clientLabel: project.client_label,
        description: project.description ?? "",
        url: project.url ?? "",
        coverUrl: project.cover_url ?? "",
        imageAlt: project.image_alt ?? "",
        highlights: project.highlights ?? [],
        published,
      });
      setBusyId(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(published ? "Projeto publicado." : "Projeto ocultado.");
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deleteExternalProject(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Projeto removido.");
      router.refresh();
    });
  }

  return (
    <>
      <section className="insyt-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[var(--insyt-border)] px-6 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--insyt-primary)]">
              Projetos externos
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[var(--insyt-black)]">
              Trabalhos fora do Briefing Studio
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--insyt-muted)]">
              Sites que você entregou mas que não passaram por briefing aqui.
              Aparecem na página pública depois dos cases.
            </p>
          </div>
          <Button type="button" onClick={() => setEditor({ mode: "create" })}>
            <Plus className="size-4" />
            Novo projeto
          </Button>
        </div>

        {projects.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <ExternalLink className="mx-auto size-7 text-[var(--insyt-muted)]" />
            <h3 className="mt-4 text-lg font-semibold">
              Nenhum projeto externo
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--insyt-muted)]">
              Cadastre sites entregues para reforçar seu portfólio.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--insyt-border)]">
            {projects.map((project, index) => {
              const isBusy = isPending && busyId === project.id;

              return (
                <article
                  key={project.id}
                  className="grid gap-5 px-6 py-6 transition-colors hover:bg-[var(--insyt-canvas)]/70 sm:grid-cols-[112px_1fr_auto] sm:items-center sm:px-8"
                >
                  <div
                    className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[var(--insyt-canvas-alt)] bg-cover bg-center"
                    style={
                      project.cover_url
                        ? { backgroundImage: `url("${project.cover_url}")` }
                        : undefined
                    }
                  >
                    {!project.cover_url ? (
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
                      {project.published ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                          <Check className="size-3" />
                          Publicado
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Rascunho</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-[var(--insyt-muted)]">
                      {project.client_label}
                    </p>
                    <p className="mt-2 line-clamp-1 text-sm text-[var(--insyt-slate)]">
                      {project.description ||
                        "Sem descrição — adicione uma frase sobre o projeto."}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 sm:justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === 0 || isBusy}
                      onClick={() => move(project, "up")}
                      aria-label={`Mover ${project.title} para cima`}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === projects.length - 1 || isBusy}
                      onClick={() => move(project, "down")}
                      aria-label={`Mover ${project.title} para baixo`}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    {project.url ? (
                      <a
                        href={project.url}
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
                      onClick={() => setEditor({ mode: "edit", project })}
                    >
                      <Pencil className="size-3.5" />
                      Editar
                    </Button>
                    <Switch
                      checked={project.published}
                      disabled={isBusy}
                      onCheckedChange={(checked) =>
                        togglePublished(project, checked)
                      }
                      aria-label={`Publicar ${project.title}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleteTarget(project)}
                      aria-label={`Excluir ${project.title}`}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                    {isBusy ? (
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
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {editor ? (
            <ExternalProjectEditor
              key={editor.mode === "edit" ? editor.project.id : "create"}
              project={editor.mode === "edit" ? editor.project : null}
              onSaved={() => {
                setEditor(null);
                router.refresh();
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.title} será removido do portfólio. Essa ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ExternalProjectEditor({
  project,
  onSaved,
}: {
  project: PortfolioExternalAdminItem | null;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(project?.title ?? "");
  const [clientLabel, setClientLabel] = useState(project?.client_label ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [url, setUrl] = useState(project?.url ?? "");
  const [coverUrl, setCoverUrl] = useState(project?.cover_url ?? "");
  const [imageAlt, setImageAlt] = useState(project?.image_alt ?? "");
  const [highlights, setHighlights] = useState(
    (project?.highlights ?? []).join("\n"),
  );
  const [published, setPublished] = useState(project?.published ?? false);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const payload = {
        title,
        clientLabel,
        description,
        url,
        coverUrl,
        imageAlt,
        highlights: highlights.split("\n"),
        published,
      };

      const result = project
        ? await updateExternalProject(project.id, payload)
        : await createExternalProject(payload);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(project ? "Projeto atualizado." : "Projeto criado.");
      onSaved();
    });
  }

  return (
    <>
      <SheetHeader className="border-b border-[var(--insyt-border)] px-6 py-6">
        <SheetTitle className="text-2xl font-bold">
          {project ? "Editar projeto" : "Novo projeto externo"}
        </SheetTitle>
        <SheetDescription>
          {project
            ? project.title
            : "Um site entregue que não passou por briefing aqui."}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-6 px-6 py-4">
        <div
          className="aspect-video overflow-hidden rounded-2xl bg-[var(--insyt-canvas-alt)] bg-cover bg-center"
          style={coverUrl ? { backgroundImage: `url("${coverUrl}")` } : undefined}
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
          <Label htmlFor="external-title">Título</Label>
          <Input
            id="external-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex: Site Institucional — Nome do Cliente"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="external-client">Cliente</Label>
          <Input
            id="external-client"
            value={clientLabel}
            onChange={(event) => setClientLabel(event.target.value)}
            placeholder="Ex: Bismarchi | Pires"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="external-description">História em uma frase</Label>
          <Textarea
            id="external-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            maxLength={280}
            placeholder="Ex: Um site institucional para apresentar a atuação do escritório."
          />
          <p className="text-right text-xs text-[var(--insyt-muted)]">
            {description.length}/280
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="external-highlights">Diferenciais</Label>
          <Textarea
            id="external-highlights"
            value={highlights}
            onChange={(event) => setHighlights(event.target.value)}
            rows={4}
            placeholder={"Diagnóstico de riscos psicossociais (NR-1)\nCanal de denúncias com protocolo rastreável"}
          />
          <p className="text-xs leading-relaxed text-[var(--insyt-muted)]">
            Um diferencial por linha. Útil para projetos que são mais que um
            site — um sistema, um SaaS — e merecem destaque extra. Aparecem
            como etiquetas abaixo da descrição.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="external-url">Endereço do site</Label>
          <Input
            id="external-url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://..."
          />
          <p className="text-xs leading-relaxed text-[var(--insyt-muted)]">
            Deixe vazio para exibir o card como “Case reservado”, sem link.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="external-cover">Imagem de capa</Label>
          <Input
            id="external-cover"
            value={coverUrl}
            onChange={(event) => setCoverUrl(event.target.value)}
            placeholder="https://... ou /portfolio/covers/arquivo.webp"
          />
          <p className="text-xs leading-relaxed text-[var(--insyt-muted)]">
            Print horizontal do site (16:10). Sem capa, o card usa um fundo com
            a cor da marca.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="external-alt">Descrição da imagem</Label>
          <Input
            id="external-alt"
            value={imageAlt}
            onChange={(event) => setImageAlt(event.target.value)}
            placeholder="Ex: Hero do site, com posicionamento e chamada principal"
          />
          <p className="text-xs leading-relaxed text-[var(--insyt-muted)]">
            Lida por leitores de tela e exibida se a imagem não carregar.
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
          {project ? "Salvar projeto" : "Criar projeto"}
        </Button>
      </div>
    </>
  );
}
