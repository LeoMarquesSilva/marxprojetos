"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Send } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BriefingQuestion } from "@/types/briefing";
import { groupQuestionsBySection } from "@/lib/briefing-utils";
import { submitBriefing, type PublicBriefing } from "@/app/actions/briefing";

type Props = {
  token: string;
  briefing: PublicBriefing;
};

export function PublicBriefingForm({ token, briefing }: Props) {
  const questions = briefing.questions as BriefingQuestion[];
  const sections = useMemo(() => groupQuestionsBySection(questions), [questions]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [clientName, setClientName] = useState(briefing.client_name ?? "");
  const [clientEmail, setClientEmail] = useState(briefing.client_email ?? "");
  const [done, setDone] = useState(briefing.already_submitted);
  const [isPending, startTransition] = useTransition();
  const requiredQuestions = useMemo(
    () => questions.filter((q) => q.required),
    [questions],
  );
  const filledRequired = useMemo(() => {
    return requiredQuestions.filter((q) => {
      const value = answers[q.id];
      return value !== undefined && value !== null && value !== "";
    }).length;
  }, [answers, requiredQuestions]);
  const progress = requiredQuestions.length
    ? Math.round((filledRequired / requiredQuestions.length) * 100)
    : 100;

  function setField(id: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function validate(): boolean {
    for (const q of questions) {
      if (!q.required) continue;
      const value = answers[q.id];
      if (value === undefined || value === "" || value === null) {
        toast.error(`Preencha: ${q.label}`);
        return false;
      }
    }
    return true;
  }

  function handleSubmit() {
    if (!validate()) return;

    startTransition(async () => {
      const normalized = { ...answers };
      for (const q of questions) {
        if (q.type === "links" && typeof normalized[q.id] === "string") {
          normalized[q.id] = String(normalized[q.id])
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);
        }
      }

      const result = await submitBriefing({
        token,
        answers: normalized,
        clientName: clientName || undefined,
        clientEmail: clientEmail || undefined,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setDone(true);
      toast.success("Briefing enviado com sucesso!");
    });
  }

  if (done) {
    return (
      <Card className="insyt-card border-emerald-200 bg-emerald-50/60 shadow-none">
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <CheckCircle2 className="size-12 text-emerald-600" />
          <div>
            <h2 className="text-xl font-semibold text-stone-900">
              Obrigado!
            </h2>
            <p className="mt-2 max-w-md text-stone-600">
              Seu briefing foi recebido. Em breve entraremos em contato com os
              próximos passos.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {briefing.welcome_message ? (
        <p className="max-w-2xl text-lg leading-relaxed text-[var(--insyt-slate)]">
          {briefing.welcome_message}
        </p>
      ) : (
        <p className="max-w-2xl text-lg leading-relaxed text-[var(--insyt-slate)]">
          Preencha as informações abaixo para iniciarmos seu projeto com clareza
          e agilidade.
        </p>
      )}

      <Card className="insyt-card border-none shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Seus dados</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="client_name">Nome</Label>
            <Input
              id="client_name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client_email">E-mail</Label>
            <Input
              id="client_email"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="insyt-card border-none shadow-none">
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-center justify-between text-sm">
            <p className="font-medium text-[var(--insyt-black)]">
              Progresso do briefing
            </p>
            <p className="text-[var(--insyt-muted)]">
              {filledRequired}/{requiredQuestions.length} obrigatórias
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--insyt-canvas-alt)]">
            <div
              className="h-full rounded-full bg-[var(--insyt-primary)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {sections.map(([section, sectionQuestions]) => (
        <Card key={section} className="insyt-card border-none shadow-none">
          <CardHeader>
            <CardTitle className="text-base">{section}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {sectionQuestions.map((q) => (
              <QuestionField
                key={q.id}
                question={q}
                value={answers[q.id]}
                onChange={(v) => setField(q.id, v)}
              />
            ))}
          </CardContent>
        </Card>
      ))}

      <div className="sticky bottom-3 z-20 flex justify-end pb-2">
        <Button size="lg" onClick={handleSubmit} disabled={isPending} className="h-12 px-6 shadow-lg shadow-[rgba(247,66,17,0.28)]">
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Enviar briefing
        </Button>
      </div>
    </div>
  );
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: BriefingQuestion;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const id = question.id;

  if (question.type === "textarea" || question.type === "links") {
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>
          {question.label}
          {question.required ? " *" : ""}
        </Label>
        <Textarea
          id={id}
          rows={question.type === "links" ? 3 : 4}
          placeholder={question.placeholder}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (question.type === "select") {
    return (
      <div className="space-y-2">
        <Label>
          {question.label}
          {question.required ? " *" : ""}
        </Label>
        <Select
          value={String(value ?? "")}
          onValueChange={(v) => v && onChange(v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {(question.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (question.type === "boolean") {
    return (
      <div className="flex items-center gap-3">
        <Checkbox
          id={id}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(Boolean(checked))}
        />
        <Label htmlFor={id}>{question.label}</Label>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {question.label}
        {question.required ? " *" : ""}
      </Label>
      <Input
        id={id}
        type={
          question.type === "email"
            ? "email"
            : question.type === "url"
              ? "url"
              : "text"
        }
        placeholder={question.placeholder}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
