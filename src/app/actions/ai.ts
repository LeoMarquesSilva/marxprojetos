"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { BriefingQuestion, QuestionType } from "@/types/briefing";

const questionSchema = z.object({
  id: z.string().min(2).max(80),
  type: z.enum([
    "text",
    "textarea",
    "email",
    "url",
    "select",
    "multiselect",
    "file",
    "links",
    "boolean",
  ]),
  label: z.string().min(5).max(180),
  required: z.boolean().nullish(),
  section: z.string().max(80).nullish(),
  placeholder: z.string().max(180).nullish(),
  options: z.array(z.string().min(1).max(80)).max(12).nullish(),
});

const payloadSchema = z.object({
  questions: z.array(questionSchema).min(8).max(24),
});

type RawQuestion = {
  id?: unknown;
  type?: unknown;
  label?: unknown;
  required?: unknown;
  section?: unknown;
  placeholder?: unknown;
  options?: unknown;
  accept?: unknown;
  multiple?: unknown;
};

function sanitizeId(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function normalizeType(rawType: unknown, hasOptions: boolean, hasFileHints: boolean): QuestionType {
  const t = String(rawType ?? "")
    .trim()
    .toLowerCase();

  const directMap: Record<string, QuestionType> = {
    text: "text",
    short_text: "text",
    input: "text",
    textarea: "textarea",
    long_text: "textarea",
    paragraph: "textarea",
    email: "email",
    mail: "email",
    url: "url",
    link: "url",
    select: "select",
    dropdown: "select",
    choice: "select",
    multiselect: "multiselect",
    multiple_choice: "multiselect",
    checkbox_group: "multiselect",
    file: "url",
    upload: "url",
    links: "links",
    urls: "links",
    boolean: "boolean",
    yes_no: "boolean",
    sim_nao: "boolean",
  };

  if (directMap[t]) return directMap[t];
  // Assets de marca (logo, imagens, PDFs) são coletados via link do Google Drive.
  if (hasFileHints) return "url";
  if (hasOptions) return "select";
  return "text";
}

function extractQuestionCandidates(parsed: unknown): RawQuestion[] {
  if (Array.isArray(parsed)) return parsed as RawQuestion[];
  if (!parsed || typeof parsed !== "object") return [];

  const obj = parsed as Record<string, unknown>;
  const possibleKeys = [
    "questions",
    "perguntas",
    "items",
    "briefing_questions",
    "questionnaire",
  ];

  for (const key of possibleKeys) {
    if (Array.isArray(obj[key])) return obj[key] as RawQuestion[];
  }

  return [];
}

function toBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "sim", "yes", "y", "1"].includes(normalized)) return true;
    if (["false", "nao", "não", "no", "n", "0"].includes(normalized)) return false;
  }
  return fallback;
}

function coerceQuestion(raw: RawQuestion, index: number): BriefingQuestion {
  const options =
    Array.isArray(raw.options) && raw.options.length > 0
      ? raw.options.map((o) => String(o).trim()).filter(Boolean).slice(0, 10)
      : undefined;

  const label = String(raw.label ?? "").trim() || `Pergunta ${index + 1}`;
  const hasFileHints =
    /arquivo|upload|anexo|logo|pdf|imagem/i.test(label) ||
    typeof raw.accept === "string";
  const type = normalizeType(raw.type, Boolean(options?.length), hasFileHints);

  return {
    id: sanitizeId(String(raw.id ?? label)) || `pergunta_${index + 1}`,
    type,
    label,
    required: toBoolean(raw.required, true),
    section: String(raw.section ?? "Geral").trim() || "Geral",
    placeholder: raw.placeholder ? String(raw.placeholder).trim().slice(0, 180) : undefined,
    options: type === "select" || type === "multiselect" ? options : undefined,
  };
}

function normalizeQuestion(q: z.infer<typeof questionSchema>, index: number): BriefingQuestion {
  // Não usamos upload de arquivos: assets são coletados por link (Google Drive).
  const type: QuestionType = q.type === "file" ? "url" : (q.type as QuestionType);
  const id = sanitizeId(q.id || `pergunta_${index + 1}`) || `pergunta_${index + 1}`;
  const isSelectLike = type === "select" || type === "multiselect";
  const options = isSelectLike
    ? (q.options ?? []).filter(Boolean).slice(0, 10)
    : undefined;

  return {
    id,
    type,
    label: q.label.trim(),
    required: q.required ?? true,
    section: q.section?.trim() || "Geral",
    placeholder: q.placeholder?.trim() || undefined,
    options: isSelectLike && options && options.length > 0 ? options : undefined,
  };
}

export async function generateBriefingQuestionsWithAI(input: {
  niche: string;
  productType: string;
  goal?: string;
  tone?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const apiKey =
    process.env.OPENAI_API_KEY ||
    process.env.NEXT_OPENAI_API_KEY ||
    process.env.OPENAI_KEY;

  if (!apiKey) {
    return { error: "Configure OPENAI_API_KEY (ou NEXT_OPENAI_API_KEY) no ambiente." };
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const prompt = `
Gere perguntas de briefing em português para um projeto web.

Contexto:
- Nicho do cliente: ${input.niche}
- Tipo de produto: ${input.productType}
- Objetivo do projeto: ${input.goal || "Não informado"}
- Tom desejado: ${input.tone || "Profissional e claro"}

Requisitos:
1) Retorne APENAS JSON válido no formato { "questions": [...] }.
2) Crie entre 10 e 16 perguntas.
3) Misture tipos: text, textarea, select, url, links, boolean.
4) Inclua seções úteis (ex: Negócio, Público, Oferta, Visual, Conteúdo, Técnico).
5) Para "select", sempre inclua "options".
6) NÃO use upload de arquivo. Para coletar logo, imagens, PDFs ou qualquer material de marca, peça um LINK do Google Drive usando o tipo "url" (ex.: "Link do Google Drive com o logo e materiais visuais").
7) IDs devem ser curtos, sem espaços, em snake_case.
8) Perguntas devem ser objetivas e úteis para criação de site/LP.
9) Se o cliente for um negócio de serviços/profissional (ex.: advocacia, clínica, consultoria, contabilidade, agência), SEMPRE inclua uma pergunta sobre as áreas de atuação / especialidades / serviços oferecidos (id sugerido "areas_atuacao").
10) SEMPRE inclua um campo do tipo "links" (id "referencias_visuais", seção "Visual") para o cliente colar sites/LPs de referência visual que admira.
11) Não inclua markdown, comentários ou texto fora do JSON.
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "briefing_questions_response",
          strict: true,
          schema: {
            type: "object",
            properties: {
              questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    type: {
                      type: "string",
                      enum: [
                        "text",
                        "textarea",
                        "email",
                        "url",
                        "select",
                        "multiselect",
                        "links",
                        "boolean",
                      ],
                    },
                    label: { type: "string" },
                    required: { type: ["boolean", "null"] },
                    section: { type: ["string", "null"] },
                    placeholder: { type: ["string", "null"] },
                    options: {
                      type: ["array", "null"],
                      items: { type: "string" },
                    },
                  },
                  required: [
                    "id",
                    "type",
                    "label",
                    "required",
                    "section",
                    "placeholder",
                    "options",
                  ],
                  additionalProperties: false,
                },
              },
            },
            required: ["questions"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "system",
          content:
            "Você é especialista em briefing para criação de sites e landing pages. Responda só JSON.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return { error: `Falha ao gerar perguntas (${response.status}): ${text.slice(0, 180)}` };
  }

  const data = await response.json();
  const raw = data?.choices?.[0]?.message?.content;

  if (!raw || typeof raw !== "string") {
    return { error: "Resposta inválida da IA." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return { error: "Não foi possível interpretar o JSON da IA." };
    }
    parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1));
  }

  // Primeiro tenta validar diretamente; se falhar, aplica coerção tolerante.
  let validated = payloadSchema.safeParse(parsed);
  if (!validated.success) {
    const candidates = extractQuestionCandidates(parsed);
    if (candidates.length > 0) {
      const coerced = candidates.slice(0, 24).map(coerceQuestion);
      validated = payloadSchema.safeParse({ questions: coerced });
    }
  }

  if (!validated.success || !validated.data.questions.length) {
    return {
      error:
        "A IA retornou perguntas em formato inválido. Tente novamente ou ajuste o nicho/tipo de produto.",
    };
  }

  const questions = ensureVisualReferences(
    validated.data.questions.map(normalizeQuestion),
  );
  return {
    questions,
    message: `${questions.length} perguntas geradas com sucesso.`,
  };
}

// Garante que todo briefing tenha um campo de sites de referência visual.
function ensureVisualReferences(
  questions: BriefingQuestion[],
): BriefingQuestion[] {
  const hasReferences = questions.some(
    (q) =>
      q.type === "links" &&
      /refer|inspir|benchmark|exemplo/i.test(`${q.id} ${q.label}`),
  );
  if (hasReferences) return questions;

  return [
    ...questions,
    {
      id: "referencias_visuais",
      type: "links",
      label: "Sites de referência visual (links)",
      required: false,
      section: "Visual",
      placeholder: "Cole links de sites/LPs que você admira (um por linha)",
    },
  ];
}

