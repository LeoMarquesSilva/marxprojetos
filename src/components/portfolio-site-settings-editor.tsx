"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle, Pencil, UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  updateSiteSettings,
  type PortfolioSiteSettings,
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { buildWaMeUrl } from "@/lib/phone";

export function PortfolioSiteSettingsEditor({
  settings,
}: {
  settings: PortfolioSiteSettings | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const whatsappPreview = settings?.whatsapp_number
    ? buildWaMeUrl(settings.whatsapp_number, settings.whatsapp_message ?? undefined)
    : null;

  return (
    <>
      <section className="insyt-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[var(--insyt-border)] px-6 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--insyt-primary)]">
              Apresentação e contato
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[var(--insyt-black)]">
              Quem fala com o lead
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--insyt-muted)]">
              Aparece no fim da página pública, logo antes da chamada para
              contato — quando o lead já viu o trabalho e quer saber quem fez.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => setOpen(true)}>
            <Pencil className="size-3.5" />
            Editar
          </Button>
        </div>

        <div className="grid gap-5 px-6 py-6 sm:grid-cols-[auto_1fr] sm:items-center sm:px-8">
          {settings?.about_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.about_photo_url}
              alt={settings.about_name ?? "Foto"}
              className="size-14 rounded-full object-cover"
            />
          ) : (
            <span className="flex size-14 items-center justify-center rounded-full bg-[#fff1ec] text-[var(--insyt-primary)]">
              <UserRound className="size-5" />
            </span>
          )}
          <div className="min-w-0">
            <p className="font-bold text-[var(--insyt-black)]">
              {settings?.about_name || "Sem apresentação configurada"}
            </p>
            <p className="mt-1 line-clamp-1 text-sm text-[var(--insyt-muted)]">
              {settings?.about_role || "Adicione sua especialização."}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <span
                className={
                  settings?.about_enabled
                    ? "font-semibold text-emerald-700"
                    : "font-semibold text-[var(--insyt-muted)]"
                }
              >
                {settings?.about_enabled ? "Visível na página" : "Oculta"}
              </span>
              {whatsappPreview ? (
                <a
                  href={whatsappPreview}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[var(--insyt-primary)] hover:underline"
                >
                  <MessageCircle className="size-3" />
                  Testar o botão de WhatsApp
                </a>
              ) : (
                <span className="text-amber-700">
                  Sem WhatsApp — a página fica sem botão de contato.
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SettingsForm
            settings={settings}
            onSaved={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

function SettingsForm({
  settings,
  onSaved,
}: {
  settings: PortfolioSiteSettings | null;
  onSaved: () => void;
}) {
  const [aboutEnabled, setAboutEnabled] = useState(
    settings?.about_enabled ?? true,
  );
  const [aboutName, setAboutName] = useState(settings?.about_name ?? "");
  const [aboutRole, setAboutRole] = useState(settings?.about_role ?? "");
  const [aboutBio, setAboutBio] = useState(settings?.about_bio ?? "");
  const [aboutPhotoUrl, setAboutPhotoUrl] = useState(
    settings?.about_photo_url ?? "",
  );
  const [aboutLinkedinUrl, setAboutLinkedinUrl] = useState(
    settings?.about_linkedin_url ?? "",
  );
  const [whatsappNumber, setWhatsappNumber] = useState(
    settings?.whatsapp_number ?? "",
  );
  const [whatsappMessage, setWhatsappMessage] = useState(
    settings?.whatsapp_message ?? "",
  );
  const [ctaLabel, setCtaLabel] = useState(settings?.cta_label ?? "");
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updateSiteSettings({
        aboutEnabled,
        aboutName,
        aboutRole,
        aboutBio,
        aboutPhotoUrl,
        aboutLinkedinUrl,
        whatsappNumber,
        whatsappMessage,
        ctaLabel,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Apresentação atualizada.");
      onSaved();
    });
  }

  return (
    <>
      <SheetHeader className="border-b border-[var(--insyt-border)] px-6 py-6">
        <SheetTitle className="text-2xl font-bold">
          Apresentação e contato
        </SheetTitle>
        <SheetDescription>
          Textos da página pública de portfólio.
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-6 px-6 py-4">
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-[var(--insyt-canvas)] p-4">
          <div>
            <p className="text-sm font-semibold">Mostrar apresentação</p>
            <p className="mt-1 text-xs text-[var(--insyt-muted)]">
              Quem é você, para o lead que ainda não te conhece.
            </p>
          </div>
          <Switch checked={aboutEnabled} onCheckedChange={setAboutEnabled} />
        </label>

        <div className="space-y-2">
          <Label htmlFor="settings-name">Nome</Label>
          <Input
            id="settings-name"
            value={aboutName}
            onChange={(event) => setAboutName(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-role">Especialização</Label>
          <Input
            id="settings-role"
            value={aboutRole}
            onChange={(event) => setAboutRole(event.target.value)}
            placeholder="Ex: Marketing jurídico para escritórios de advocacia"
          />
          <p className="text-xs leading-relaxed text-[var(--insyt-muted)]">
            Dizer o nicho vale mais que dizer que faz de tudo.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-bio">Apresentação</Label>
          <Textarea
            id="settings-bio"
            value={aboutBio}
            onChange={(event) => setAboutBio(event.target.value)}
            rows={6}
            maxLength={600}
          />
          <p className="text-right text-xs text-[var(--insyt-muted)]">
            {aboutBio.length}/600
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-photo">Foto (URL)</Label>
          <Input
            id="settings-photo"
            value={aboutPhotoUrl}
            onChange={(event) => setAboutPhotoUrl(event.target.value)}
            placeholder="https://..."
          />
          <p className="text-xs leading-relaxed text-[var(--insyt-muted)]">
            Uma foto real aumenta a confiança de quem não te conhece. Sem foto,
            aparecem suas iniciais.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-linkedin">LinkedIn</Label>
          <Input
            id="settings-linkedin"
            type="url"
            value={aboutLinkedinUrl}
            onChange={(event) => setAboutLinkedinUrl(event.target.value)}
            placeholder="https://www.linkedin.com/in/..."
          />
          <p className="text-xs leading-relaxed text-[var(--insyt-muted)]">
            Perfil verificável — o lead confere que você existe de verdade.
          </p>
        </div>

        <div className="space-y-2 border-t border-[var(--insyt-border)] pt-6">
          <Label htmlFor="settings-whatsapp">WhatsApp</Label>
          <Input
            id="settings-whatsapp"
            value={whatsappNumber}
            onChange={(event) => setWhatsappNumber(event.target.value)}
            placeholder="5535988754584"
          />
          <p className="text-xs leading-relaxed text-[var(--insyt-muted)]">
            Com DDI e DDD, só números. Vazio remove o botão de contato da
            página.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-whatsapp-message">Mensagem automática</Label>
          <Textarea
            id="settings-whatsapp-message"
            value={whatsappMessage}
            onChange={(event) => setWhatsappMessage(event.target.value)}
            rows={3}
            maxLength={280}
          />
          <p className="text-xs leading-relaxed text-[var(--insyt-muted)]">
            Já vem digitada na conversa. Mensagem pronta reduz o atrito de
            iniciar o contato.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-cta">Texto do botão</Label>
          <Input
            id="settings-cta"
            value={ctaLabel}
            onChange={(event) => setCtaLabel(event.target.value)}
            placeholder="Solicitar orçamento"
          />
          <p className="text-xs leading-relaxed text-[var(--insyt-muted)]">
            Botões específicos convertem bem mais que genéricos — vale testar
            variações aqui.
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
          Salvar
        </Button>
      </div>
    </>
  );
}
