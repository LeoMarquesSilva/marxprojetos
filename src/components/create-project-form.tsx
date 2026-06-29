"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createProject } from "@/app/actions/projects";
import { generateBriefingQuestionsWithAI } from "@/app/actions/ai";
import type { BriefingQuestion, BriefingTemplate } from "@/types/briefing";

const QUESTION_TYPE_LABELS: Record<string, string> = {
  text: "Texto curto",
  textarea: "Texto longo",
  email: "E-mail",
  url: "Link",
  select: "Seleção única",
  multiselect: "Múltipla escolha",
  file: "Arquivo",
  links: "Lista de links",
  boolean: "Sim ou não",
};

export function CreateProjectForm({
  templates,
}: {
  templates: BriefingTemplate[];
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [questions, setQuestions] = useState<BriefingQuestion[]>(
    templates[0]?.questions ?? [],
  );
  const [niche, setNiche] = useState("");
  const [productType, setProductType] = useState("");
  const [goal, setGoal] = useState("");
  const [tone, setTone] = useState("");
  const [defaultLabels, setDefaultLabels] = useState<Record<string, string>>(() =>
    Object.fromEntries((templates[0]?.questions ?? []).map((q) => [q.id, q.label])),
  );
  const [touchedLabelIds, setTouchedLabelIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [isAiPending, startAiTransition] = useTransition();

  const selected = useMemo(
    () => templates.find((t) => t.id === templateId),
    [templateId, templates],
  );
  const requiredCount = useMemo(
    () => questions.filter((q) => q.required).length,
    [questions],
  );
  const sectionCount = useMemo(
    () => new Set(questions.map((q) => q.section ?? "Geral")).size,
    [questions],
  );

  function applyQuestions(nextQuestions: BriefingQuestion[]) {
    setDefaultLabels(
      Object.fromEntries(nextQuestions.map((q) => [q.id, q.label])),
    );
    setTouchedLabelIds(new Set());
    setQuestions(nextQuestions);
  }

  function onTemplateChange(id: string | null) {
    if (!id) return;
    setTemplateId(id);
    const template = templates.find((t) => t.id === id);
    applyQuestions(template?.questions ?? []);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await createProject({
        title: String(formData.get("title")),
        templateId,
        clientName: String(formData.get("client_name") || ""),
        clientEmail: String(formData.get("client_email") || ""),
        clientCompany: String(formData.get("client_company") || ""),
        welcomeMessage: String(formData.get("welcome_message") || ""),
        questions,
      });
    });
  }

  function handleGenerateWithAI() {
    if (!niche.trim() || !productType.trim()) {
      toast.error("Informe nicho e tipo de produto para gerar as perguntas.");
      return;
    }

    startAiTransition(async () => {
      const result = await generateBriefingQuestionsWithAI({
        niche,
        productType,
        goal,
        tone,
      });

      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }

      if (!("questions" in result) || !result.questions?.length) {
        toast.error("A IA não retornou perguntas válidas.");
        return;
      }

      applyQuestions(result.questions);
      toast.success(result.message || "Perguntas geradas com sucesso.");
    });
  }

  return (
    <form action={handleSubmit} className="space-y-8">
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="insyt-card p-8 h-full flex flex-col justify-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--insyt-muted)]">
              Template
            </p>
            <p className="mt-3 text-2xl font-bold tracking-tight text-[var(--insyt-black)]">
              {selected?.name ?? "Selecione"}
            </p>
        </div>
        <div className="insyt-card p-8 h-full flex flex-col justify-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--insyt-muted)]">
              Perguntas
            </p>
            <p className="mt-3 text-4xl font-bold tracking-tight text-[var(--insyt-black)]">
              {questions.length}
            </p>
        </div>
        <div className="insyt-card p-8 h-full flex flex-col justify-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--insyt-muted)]">
              Obrigatórias
            </p>
            <p className="mt-3 text-4xl font-bold tracking-tight text-[var(--insyt-black)]">
              {requiredCount} <span className="text-lg font-medium text-[var(--insyt-slate)] tracking-normal">em {sectionCount} seções</span>
            </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-[var(--insyt-primary)]" />
            Gerar perguntas com IA
          </CardTitle>
          <CardDescription>
            Informe o contexto do cliente para a IA montar o briefing automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-3">
            <Label htmlFor="ai_niche" className="text-xs font-semibold uppercase tracking-wider text-[var(--insyt-slate)]">Nicho do cliente *</Label>
            <Input
              id="ai_niche"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="Ex: clínica estética, imobiliária, advocacia..."
              className="h-12 rounded-xl bg-[var(--insyt-canvas)] border-transparent focus-visible:bg-white transition-colors duration-300"
            />
          </div>
          <div className="space-y-3">
            <Label htmlFor="ai_product" className="text-xs font-semibold uppercase tracking-wider text-[var(--insyt-slate)]">Tipo de produto *</Label>
            <Input
              id="ai_product"
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              placeholder="Ex: landing page de captação, site institucional..."
              className="h-12 rounded-xl bg-[var(--insyt-canvas)] border-transparent focus-visible:bg-white transition-colors duration-300"
            />
          </div>
          <div className="space-y-3">
            <Label htmlFor="ai_goal" className="text-xs font-semibold uppercase tracking-wider text-[var(--insyt-slate)]">Objetivo (opcional)</Label>
            <Input
              id="ai_goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Ex: gerar leads, agendamento no WhatsApp..."
              className="h-12 rounded-xl bg-[var(--insyt-canvas)] border-transparent focus-visible:bg-white transition-colors duration-300"
            />
          </div>
          <div className="space-y-3">
            <Label htmlFor="ai_tone" className="text-xs font-semibold uppercase tracking-wider text-[var(--insyt-slate)]">Tom (opcional)</Label>
            <Input
              id="ai_tone"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="Ex: premium, direto, técnico, humanizado..."
              className="h-12 rounded-xl bg-[var(--insyt-canvas)] border-transparent focus-visible:bg-white transition-colors duration-300"
            />
          </div>
          <div className="sm:col-span-2 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerateWithAI}
              disabled={isAiPending}
              className="w-full rounded-2xl border-[var(--insyt-border)] bg-[var(--insyt-canvas)] hover:bg-white hover:border-[var(--insyt-primary)]/30 hover:text-[var(--insyt-primary)] transition-all duration-300 ease-fluid"
            >
              {isAiPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Gerar perguntas automaticamente
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informações do projeto</CardTitle>
          <CardDescription>
            Defina o briefing e os dados do cliente para gerar o link.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-3 sm:col-span-2">
            <Label htmlFor="title" className="text-xs font-semibold uppercase tracking-wider text-[var(--insyt-slate)]">Título do projeto *</Label>
            <Input
              id="title"
              name="title"
              required
              placeholder="Ex: Site institucional — Clínica Saúde+"
              className="h-12 rounded-xl bg-[var(--insyt-canvas)] border-transparent focus-visible:bg-white transition-colors duration-300"
            />
          </div>
          <div className="space-y-3 sm:col-span-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--insyt-slate)]">Template base</Label>
            <Select value={templateId} onValueChange={onTemplateChange} items={templates.map((t) => ({ value: t.id, label: t.name }))}>
              <SelectTrigger className="h-12 rounded-xl bg-[var(--insyt-canvas)] border-transparent focus:bg-white transition-colors duration-300">
                <SelectValue placeholder="Selecione um template" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="rounded-lg cursor-pointer">
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected?.description ? (
              <p className="text-sm text-[var(--insyt-muted)] mt-2">{selected.description}</p>
            ) : null}
          </div>
          <div className="space-y-3">
            <Label htmlFor="client_name" className="text-xs font-semibold uppercase tracking-wider text-[var(--insyt-slate)]">Nome do cliente</Label>
            <Input id="client_name" name="client_name" className="h-12 rounded-xl bg-[var(--insyt-canvas)] border-transparent focus-visible:bg-white transition-colors duration-300" />
          </div>
          <div className="space-y-3">
            <Label htmlFor="client_email" className="text-xs font-semibold uppercase tracking-wider text-[var(--insyt-slate)]">E-mail do cliente</Label>
            <Input id="client_email" name="client_email" type="email" className="h-12 rounded-xl bg-[var(--insyt-canvas)] border-transparent focus-visible:bg-white transition-colors duration-300" />
          </div>
          <div className="space-y-3 sm:col-span-2">
            <Label htmlFor="client_company" className="text-xs font-semibold uppercase tracking-wider text-[var(--insyt-slate)]">Empresa</Label>
            <Input id="client_company" name="client_company" className="h-12 rounded-xl bg-[var(--insyt-canvas)] border-transparent focus-visible:bg-white transition-colors duration-300" />
          </div>
          <div className="space-y-3 sm:col-span-2">
            <Label htmlFor="welcome_message" className="text-xs font-semibold uppercase tracking-wider text-[var(--insyt-slate)]">Mensagem de boas-vindas</Label>
            <Textarea
              id="welcome_message"
              name="welcome_message"
              rows={4}
              placeholder="Olá! Preencha este briefing para darmos início ao seu projeto..."
              className="rounded-xl bg-[var(--insyt-canvas)] border-transparent focus-visible:bg-white transition-colors duration-300 resize-none"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Perguntas ({questions.length})</CardTitle>
          <CardDescription>
            Personalize as perguntas antes de enviar ao cliente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {questions.map((q, index) => (
            <div
              key={q.id}
              className="rounded-2xl border border-[var(--insyt-border)] bg-[var(--insyt-canvas)] p-6 transition-all duration-300 hover:shadow-md hover:bg-white"
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <span className="inline-flex items-center rounded-full bg-[var(--insyt-black)]/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--insyt-slate)]">
                  {q.section ?? "Geral"} ·{" "}
                  {QUESTION_TYPE_LABELS[q.type] ?? q.type}
                  {q.required ? " · obrigatório" : ""}
                </span>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-3 sm:col-span-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--insyt-slate)]">Pergunta</Label>
                  <Input
                    value={touchedLabelIds.has(q.id) ? q.label : ""}
                    placeholder={defaultLabels[q.id] ?? q.label}
                    className="h-12 rounded-xl bg-white border-[var(--insyt-border)] focus-visible:border-[var(--insyt-primary)]/50 transition-colors duration-300"
                    onFocus={() => {
                      if (touchedLabelIds.has(q.id)) return;
                      setTouchedLabelIds((prev) => new Set(prev).add(q.id));
                      const next = [...questions];
                      next[index] = { ...q, label: "" };
                      setQuestions(next);
                    }}
                    onChange={(e) => {
                      const next = [...questions];
                      next[index] = { ...q, label: e.target.value };
                      setQuestions(next);
                    }}
                    onBlur={() => {
                      if (q.label.trim()) return;
                      const restored = defaultLabels[q.id] ?? "";
                      const next = [...questions];
                      next[index] = { ...q, label: restored };
                      setQuestions(next);
                      setTouchedLabelIds((prev) => {
                        const nextIds = new Set(prev);
                        nextIds.delete(q.id);
                        return nextIds;
                      });
                    }}
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--insyt-slate)]">Obrigatório</Label>
                  <Select
                    value={q.required ? "yes" : "no"}
                    onValueChange={(v) => {
                      if (!v) return;
                      const next = [...questions];
                      next[index] = { ...q, required: v === "yes" };
                      setQuestions(next);
                    }}
                    items={[
                      { value: "yes", label: "Sim" },
                      { value: "no", label: "Não" },
                    ]}
                  >
                    <SelectTrigger className="h-12 rounded-xl bg-white border-[var(--insyt-border)] transition-colors duration-300">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="yes" className="rounded-lg cursor-pointer">Sim</SelectItem>
                      <SelectItem value="no" className="rounded-lg cursor-pointer">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end pt-4">
        <Button 
          type="submit" 
          size="lg" 
          className="h-14 px-10 text-base shadow-xl shadow-[var(--insyt-primary)]/20 transition-all duration-500 ease-fluid hover:scale-[1.02] hover:shadow-2xl hover:shadow-[var(--insyt-primary)]/30" 
          disabled={isPending || !templateId}
        >
          {isPending ? <Loader2 className="size-5 animate-spin mr-2" /> : null}
          Criar e gerar link
        </Button>
      </div>
    </form>
  );
}
