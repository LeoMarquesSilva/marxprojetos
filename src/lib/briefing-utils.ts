import type { BriefingQuestion } from "@/types/briefing";

export function groupQuestionsBySection(questions: BriefingQuestion[]) {
  const sections = new Map<string, BriefingQuestion[]>();

  for (const question of questions) {
    const section = question.section ?? "Geral";
    const list = sections.get(section) ?? [];
    list.push(question);
    sections.set(section, list);
  }

  return Array.from(sections.entries());
}

export function getAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

export function getBriefingLink(token: string) {
  return `${getAppUrl()}/b/${token}`;
}

export function formatAnswer(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}
