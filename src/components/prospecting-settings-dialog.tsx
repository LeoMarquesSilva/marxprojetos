"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProspectingDialogShell } from "@/components/prospecting-dialog-shell";
import { saveProspectingSettings } from "@/app/actions/prospecting";
import { renderProspectMessage, type MessageLead } from "@/lib/prospecting/message";
import type { ProspectingSettings } from "@/types/prospecting";

const PLACEHOLDERS: { token: string; hint: string }[] = [
  { token: "{{saudacao}}", hint: "Bom dia / Boa tarde / Boa noite" },
  { token: "{{vocativo}}", hint: '", Dra. Janaina" quando o nome é de uma pessoa; vazio quando é sociedade' },
  { token: "{{nome}}", hint: "nome do negócio, sem a palavra-chave do Google" },
  { token: "{{cidade}}", hint: "cidade" },
  { token: "{{nicho}}", hint: "nicho buscado" },
  { token: "{{site}}", hint: "a observação que abre a mensagem: sem site, fora do ar ou o problema mais forte do site" },
  { token: "{{momento}}", hint: "o que isso custa na área do lead (criminal, família, trabalhista…)" },
  { token: "{{problema}}", hint: "só o problema mais forte do site, em frase" },
  { token: "{{diagnostico}}", hint: "lista com até 3 problemas do site" },
  { token: "{{oferta}}", hint: "pergunta final: oferece a lista do que achou ou mostrar como ficaria" },
  { token: "{{gancho}}", hint: "follow-up: 1º traz um ponto novo; 2º se despede" },
  { token: "{{publico}}", hint: "escritórios de advocacia / clínicas…" },
  { token: "{{caso_nome}}", hint: "nome do projeto parecido do portfólio" },
  { token: "{{caso}}", hint: "projeto parecido, com o link" },
  { token: "{{caso_link}}", hint: "só o link do projeto parecido" },
  { token: "{{portfolio}}", hint: "site da INSYT" },
];

// Leads de exemplo: sem site, site fora do ar e site auditado — os jeitos
// mais comuns de {{site}} e {{diagnostico}} mudarem.
const SAMPLE_LEADS: { label: string; lead: MessageLead }[] = [
  {
    label: "Escritório com site ruim",
    lead: {
      id: "exemplo-3",
      name: "Dra. Paula Andrade - Advogada Trabalhista em Campinas",
      city: "Campinas",
      niche: "advogado trabalhista",
      website: "https://andradeadvocacia.com.br",
      site_status: "ok",
      site_audit: {
        status: "ok",
        score: 38,
        findings: [
          { code: "slow", value: 9 },
          { code: "no_whatsapp" },
          { code: "no_preview", value: "sem_descricao" },
          { code: "outdated", value: 2021 },
        ],
      },
    },
  },
  {
    label: "Escritório sem site",
    lead: {
      id: "exemplo-1",
      name: "Silva & Costa Advogados",
      city: "Campinas",
      niche: "advogado criminalista",
      website: null,
      rating: 4.8,
      rating_count: 64,
    },
  },
  {
    label: "Site fora do ar",
    lead: {
      id: "exemplo-2",
      name: "Moraes Advocacia Empresarial",
      city: "Campinas",
      niche: "advogado empresarial",
      website: "https://moraesadvocacia.com.br",
      site_status: "offline",
      site_issues: ["Site fora do ar"],
    },
  },
];

type TemplateTab = "primeira" | "site" | "followup";

const TABS: [TemplateTab, string][] = [
  ["primeira", "Sem site"],
  ["site", "Já tem site"],
  ["followup", "Follow-up"],
];

const TAB_HINTS: Record<TemplateTab, string> = {
  primeira: "Primeiro contato — sem site, site fora do ar ou rede social no lugar",
  site: "Primeiro contato com quem já tem site e a auditoria achou o que citar",
  followup: "Follow-up (para quem não respondeu em 3 dias)",
};

function templatesOf(settings: ProspectingSettings): Record<TemplateTab, string> {
  return {
    primeira: settings.template,
    site: settings.siteTemplate,
    followup: settings.followupTemplate,
  };
}

export function ProspectingSettingsDialog({ settings }: { settings: ProspectingSettings }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TemplateTab>("primeira");
  const [templates, setTemplates] = useState(() => templatesOf(settings));
  const [dailyLimit, setDailyLimit] = useState(String(settings.dailyLimit));
  const [sampleIndex, setSampleIndex] = useState(1);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setTemplates(templatesOf(settings));
      setDailyLimit(String(settings.dailyLimit));
    }
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveProspectingSettings({
        template: templates.primeira,
        siteTemplate: templates.site,
        followupTemplate: templates.followup,
        dailyLimit: Number(dailyLimit),
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Mensagens salvas!");
      setOpen(false);
      router.refresh();
    });
  }

  const current = templates[tab];
  const setCurrent = (update: (value: string) => string) =>
    setTemplates((all) => ({ ...all, [tab]: update(all[tab]) }));
  const sample = SAMPLE_LEADS[sampleIndex];
  const preview = current.trim() ? renderProspectMessage(current, sample.lead) : "";

  return (
    <>
      <Button type="button" variant="outline" onClick={() => handleOpenChange(true)}>
        <FileText className="size-4" />
        Mensagens
      </Button>

      <ProspectingDialogShell
        open={open}
        onOpenChange={handleOpenChange}
        wide
        title="Mensagens da prospecção"
        description="O modelo é usado como está — nada é acrescentado por fora. Variações entre chaves, como {Oi|Olá|Tudo bem?}, sorteiam uma opção por lead: o WhatsApp vê mensagens diferentes e o risco de bloqueio cai."
        footer={
          <Button type="button" className="w-full" disabled={isPending} onClick={handleSave}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Salvar mensagens
          </Button>
        }
      >
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[var(--insyt-canvas)] p-1">
          {TABS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setTab(value);
                // Prévia com o lead que combina com a aba.
                if (value === "site") setSampleIndex(0);
                if (value === "primeira") setSampleIndex(1);
              }}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                tab === value
                  ? "bg-white text-[var(--insyt-black)] shadow-sm"
                  : "text-[var(--insyt-muted)] hover:text-[var(--insyt-black)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="prospecting-template">
            {TAB_HINTS[tab]}
          </Label>
          <Textarea
            id="prospecting-template"
            rows={8}
            value={current}
            onChange={(e) => {
              const value = e.target.value;
              setCurrent(() => value);
            }}
          />
          <div className="flex flex-wrap gap-1.5">
            {PLACEHOLDERS.map((item) => (
              <button
                key={item.token}
                type="button"
                title={item.hint}
                onClick={() => setCurrent((value) => `${value}${item.token}`)}
                className="rounded-full bg-[var(--insyt-canvas-alt)] px-2.5 py-1 font-mono text-[11px] text-[var(--insyt-slate)] transition-colors hover:bg-[var(--insyt-border)]"
              >
                {item.token}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--insyt-muted)]">
              Prévia
            </p>
            <div className="flex gap-1">
              {SAMPLE_LEADS.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setSampleIndex(index)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    sampleIndex === index
                      ? "bg-[var(--insyt-black)] text-white"
                      : "bg-[var(--insyt-canvas-alt)] text-[var(--insyt-slate)]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-[#e7f8ef] p-4 text-sm whitespace-pre-wrap text-[var(--insyt-black)]">
            {preview || "—"}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="prospecting-daily-limit">Limite de envios por dia</Label>
          <Input
            id="prospecting-daily-limit"
            type="number"
            min={1}
            max={500}
            value={dailyLimit}
            onChange={(e) => setDailyLimit(e.target.value)}
            className="w-32"
          />
          <p className="text-xs text-[var(--insyt-muted)]">
            Primeiras mensagens + follow-ups, contados no horário de Brasília. Número
            novo no WhatsApp deve começar com 20–30 por dia e subir aos poucos.
          </p>
        </div>
      </ProspectingDialogShell>
    </>
  );
}
