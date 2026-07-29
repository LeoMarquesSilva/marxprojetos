"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { updatePortfolioSettings } from "@/app/actions/portfolio";
import type { Project } from "@/types/briefing";

export function PortfolioSettings({ project }: { project: Project }) {
  const [published, setPublished] = useState(project.portfolio_published);
  const [description, setDescription] = useState(project.portfolio_description ?? "");
  const [coverUrl, setCoverUrl] = useState(project.portfolio_cover_url ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await updatePortfolioSettings(project.id, {
        published,
        description,
        coverUrl,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Configurações do portfólio salvas!");
    });
  }

  return (
    <div className="space-y-5">
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-[var(--insyt-canvas)] p-4">
        <div>
          <p className="text-sm font-semibold text-[var(--insyt-black)]">
            Publicar no portfólio
          </p>
          <p className="text-xs text-[var(--insyt-muted)]">
            Aparece no link público, junto com os outros projetos publicados.
          </p>
        </div>
        <Switch checked={published} onCheckedChange={setPublished} />
      </label>

      <div className="space-y-2">
        <Label htmlFor="portfolio-description">Descrição curta</Label>
        <Textarea
          id="portfolio-description"
          placeholder="Ex: Site institucional com foco em captação de leads via WhatsApp."
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="portfolio-cover">URL da imagem de capa</Label>
        <Input
          id="portfolio-cover"
          placeholder="https://..."
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
        />
        <p className="text-xs text-[var(--insyt-muted)]">
          Link de uma imagem já hospedada (ex: print do site). Sem imagem, mostra um
          fundo com a cor da marca.
        </p>
      </div>

      <Button type="button" onClick={handleSave} disabled={isPending}>
        {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        Salvar
      </Button>

      {project.portfolio_published ? (
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm font-medium text-[var(--insyt-primary)] hover:underline"
        >
          Ver portfólio público ↗
        </a>
      ) : null}
    </div>
  );
}
