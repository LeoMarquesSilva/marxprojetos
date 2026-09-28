import { absoluteUrl } from "@/lib/site-url";
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

// Os links vão para o cliente e são montados em componentes client-side.
// VERCEL_URL não chega ao navegador (sem prefixo NEXT_PUBLIC_), então o
// fallback antigo gerava um link no SSR e "http://localhost:3000" na
// hidratação — e um NEXT_PUBLIC_APP_URL malformado saía copiado como veio.
// SITE_URL valida a variável e cai para o domínio de produção.
export function getBriefingLink(token: string) {
  return absoluteUrl(`/b/${token}`);
}

export function getReviewLink(token: string) {
  return absoluteUrl(`/r/${token}`);
}

export function formatAnswer(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}
