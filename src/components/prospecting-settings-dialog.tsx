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
  { token: "{{nome}}", hint: "nome do negócio" },
  { token: "{{cidade}}", hint: "cidade" },
  { token: "{{nicho}}", hint: "nicho buscado" },
  { token: "{{site}}", hint: "frase sobre o site (ou a falta dele)" },
  { token: "{{caso}}", hint: "projeto parecido do portfólio" },
  { token: "{{caso_link}}", hint: "só o link do projeto parecido" },
  { token: "{{portfolio}}", hint: "site da INSYT" },
];

// Dois leads de exemplo: um sem site e um com o site fora do ar — os dois
// jeitos mais comuns de a frase de {{site}} mudar.
const SAMPLE_LEADS: { label: string; lead: MessageLead }[] = [
  {
    label: "Escritório sem site",
    lead: {
      id: "exemplo-1",
      name: "Silva & Costa Advogados",
      city: "Campinas",
      niche: "advogado criminalista",
      website: null,
    },
  },
  {
    label: "Clínica com site fora do ar",
    lead: {
      id: "exemplo-2",
      name: "Clínica Bem Viver",
      city: "Campinas",
      niche: "clínica geriátrica",
      website: "https://bemviver.com.br",
      site_status: "offline",
      site_issues: ["Site fora do ar"],
    },
  },
];

export function ProspectingSettingsDialog({ settings }: { settings: ProspectingSettings }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"primeira" | "followup">("primeira");
  const [template, setTemplate] = useState(settings.template);
  const [followupTemplate, setFollowupTemplate] = useState(settings.followupTemplate);
  const [dailyLimit, setDailyLimit] = useState(String(settings.dailyLimit));
  const [sampleIndex, setSampleIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setTemplate(settings.template);
      setFollowupTemplate(settings.followupTemplate);
      setDailyLimit(String(settings.dailyLimit));
    }
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveProspectingSettings({
        template,
        followupTemplate,
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

  const current = tab === "primeira" ? template : followupTemplate;
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
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[var(--insyt-canvas)] p-1">
          {(
            [
              ["primeira", "Primeira mensagem"],
              ["followup", "Follow-up"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
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
            {tab === "primeira"
              ? "Primeiro contato"
              : "Follow-up (para quem não respondeu em 3 dias)"}
          </Label>
          <Textarea
            id="prospecting-template"
            rows={8}
            value={current}
            onChange={(e) =>
              tab === "primeira"
                ? setTemplate(e.target.value)
                : setFollowupTemplate(e.target.value)
            }
          />
          <div className="flex flex-wrap gap-1.5">
            {PLACEHOLDERS.map((item) => (
              <button
                key={item.token}
                type="button"
                title={item.hint}
                onClick={() =>
                  tab === "primeira"
                    ? setTemplate((value) => `${value}${item.token}`)
                    : setFollowupTemplate((value) => `${value}${item.token}`)
                }
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
