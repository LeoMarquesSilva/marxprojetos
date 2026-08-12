import type { BriefingQuestion, QuestionType } from "../types/briefing";

const BRIEFING_QUESTION_TYPES = new Set<QuestionType>([
  "text",
  "textarea",
  "email",
  "url",
  "select",
  "multiselect",
  "file",
  "links",
  "boolean",
]);

export function isBriefingAnswerFilled(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(
      (item) => typeof item !== "string" || item.trim().length > 0,
    );
  }
  if (typeof value === "string") return value.trim().length > 0;
  return value !== undefined && value !== null;
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname.length > 0
    );
  } catch {
    return false;
  }
}

export function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function getBriefingAnswerValidationError(
  question: BriefingQuestion,
  value: unknown,
): string | null {
  if (!isBriefingAnswerFilled(value)) {
    return question.required ? `Preencha: ${question.label}` : null;
  }

  if (
    ["text", "textarea", "email", "url", "file", "select"].includes(
      question.type,
    ) &&
    typeof value !== "string"
  ) {
    return `Resposta inválida em: ${question.label}`;
  }

  if (question.type === "boolean" && typeof value !== "boolean") {
    return `Resposta inválida em: ${question.label}`;
  }

  if (question.type === "select" && !question.options?.includes(value as string)) {
    return `Selecione uma opção válida em: ${question.label}`;
  }

  if (question.type === "multiselect") {
    if (
      !Array.isArray(value) ||
      !value.every((item): item is string => typeof item === "string")
    ) {
      return `Resposta inválida em: ${question.label}`;
    }

    if (value.some((item) => !question.options?.includes(item))) {
      return `Selecione apenas opções válidas em: ${question.label}`;
    }
  }

  if (question.type === "file" || question.type === "url") {
    if (typeof value !== "string" || !isAbsoluteHttpUrl(value)) {
      return `Informe uma URL completa com http:// ou https:// em: ${question.label}`;
    }
  }

  if (question.type === "links") {
    if (
      (typeof value !== "string" && !Array.isArray(value)) ||
      (Array.isArray(value) && !value.every((item) => typeof item === "string"))
    ) {
      return `Resposta inválida em: ${question.label}`;
    }

    const links =
      typeof value === "string"
        ? value.split("\n")
        : Array.isArray(value)
          ? value.filter((item): item is string => typeof item === "string")
          : [];

    const invalidIndex = links.findIndex(
      (link) => link.trim().length > 0 && !isAbsoluteHttpUrl(link),
    );
    if (invalidIndex >= 0) {
      return `Informe apenas URLs completas com http:// ou https:// em: ${question.label} (linha ${invalidIndex + 1})`;
    }
  }

  if (
    question.type === "email" &&
    (typeof value !== "string" || !isValidEmailAddress(value))
  ) {
    return `Informe um e-mail válido em: ${question.label}`;
  }

  return null;
}

export function toggleMultiselectAnswer(
  value: unknown,
  option: string,
  checked: boolean,
): string[] {
  const current = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

  if (checked) {
    return current.includes(option) ? current : [...current, option];
  }

  return current.filter((item) => item !== option);
}

export function normalizeBriefingAnswers(
  questions: BriefingQuestion[],
  answers: Record<string, unknown>,
): Record<string, unknown> {
  const normalized = { ...answers };

  for (const question of questions) {
    if (question.type === "links" && typeof normalized[question.id] === "string") {
      normalized[question.id] = String(normalized[question.id])
        .split("\n")
        .map((link) => link.trim())
        .filter(Boolean);
    }
    const answer = normalized[question.id];
    if (
      (question.type === "file" ||
        question.type === "url" ||
        question.type === "email") &&
      typeof answer === "string"
    ) {
      normalized[question.id] = answer.trim();
    }
  }

  return normalized;
}

function isBriefingQuestion(value: unknown): value is BriefingQuestion {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const question = value as Record<string, unknown>;
  const type = question.type as QuestionType;
  const optionsAreValid =
    type !== "select" && type !== "multiselect"
      ? true
      : Array.isArray(question.options) &&
        question.options.length > 0 &&
        question.options.every(
          (option) => typeof option === "string" && option.trim().length > 0,
        ) &&
        new Set(question.options).size === question.options.length;

  return (
    typeof question.id === "string" &&
    question.id.trim().length > 0 &&
    typeof question.label === "string" &&
    question.label.trim().length > 0 &&
    typeof question.type === "string" &&
    BRIEFING_QUESTION_TYPES.has(type) &&
    (question.required === undefined || typeof question.required === "boolean") &&
    optionsAreValid
  );
}

export function validateAndNormalizeBriefingAnswers(
  questions: unknown,
  answers: unknown,
): { error: string } | { answers: Record<string, unknown> } {
  if (
    !Array.isArray(questions) ||
    !questions.every(isBriefingQuestion) ||
    new Set(questions.map((question) => question.id)).size !== questions.length
  ) {
    return { error: "Não foi possível validar as perguntas deste briefing." };
  }

  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return { error: "As respostas enviadas são inválidas." };
  }

  const answerRecord = answers as Record<string, unknown>;
  for (const question of questions) {
    const error = getBriefingAnswerValidationError(
      question,
      answerRecord[question.id],
    );
    if (error) return { error };
  }

  return {
    answers: normalizeBriefingAnswers(questions, answerRecord),
  };
}

export type NextStepTiming = "overdue" | "upcoming";

export function getBrasiliaCalendarDate(value: Date): string | null {
  if (Number.isNaN(value.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));
  const year = valueByType.get("year");
  const month = valueByType.get("month");
  const day = valueByType.get("day");

  return year && month && day ? `${year}-${month}-${day}` : null;
}

export function classifyNextStep(
  nextStepAt: string | null,
  now = new Date(),
): NextStepTiming | null {
  if (!nextStepAt) return null;
  const dueDate = new Date(nextStepAt);
  if (Number.isNaN(dueDate.getTime()) || Number.isNaN(now.getTime())) return null;

  const dueDay = getBrasiliaCalendarDate(dueDate);
  const currentDay = getBrasiliaCalendarDate(now);
  if (!dueDay || !currentDay) return null;

  return dueDay < currentDay ? "overdue" : "upcoming";
}
