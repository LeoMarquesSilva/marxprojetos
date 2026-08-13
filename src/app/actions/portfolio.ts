"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/types/briefing";

export type PortfolioItem = {
  id: string;
  title: string;
  client_name: string | null;
  client_company: string | null;
  portfolio_description: string | null;
  portfolio_cover_url: string | null;
  site_path: string | null;
  /** Site publicado do cliente; tem precedência sobre o preview interno. */
  portfolio_live_url: string | null;
  portfolio_case_id: string | null;
  portfolio_eyebrow: string | null;
  portfolio_objective: string | null;
  portfolio_solution: string | null;
  portfolio_deliverables: string[];
  portfolio_image_alt: string | null;
  portfolio_sort_order: number;
  created_at: string;
};

export type PortfolioCaseRecord = {
  id: string;
  client: string;
  summary: string | null;
  services: string[];
  sort_order: number;
};

export type PortfolioExternalProject = {
  id: string;
  title: string;
  client_label: string;
  description: string | null;
  url: string | null;
  cover_url: string | null;
  image_alt: string | null;
  highlights: string[];
  sort_order: number;
};

export type PortfolioExternalAdminItem = PortfolioExternalProject & {
  published: boolean;
  created_at: string;
};

export type PortfolioSiteSettings = {
  about_enabled: boolean;
  about_name: string | null;
  about_role: string | null;
  about_bio: string | null;
  about_photo_url: string | null;
  about_linkedin_url: string | null;
  whatsapp_number: string | null;
  whatsapp_message: string | null;
  cta_label: string | null;
};

export type PortfolioAdminItem = Pick<
  Project,
  | "id"
  | "title"
  | "client_name"
  | "client_company"
  | "review_enabled"
  | "review_site_path"
  | "portfolio_published"
  | "portfolio_description"
  | "portfolio_cover_url"
  | "portfolio_live_url"
  | "portfolio_case_id"
  | "portfolio_eyebrow"
  | "portfolio_objective"
  | "portfolio_solution"
  | "portfolio_deliverables"
  | "portfolio_image_alt"
  | "portfolio_sort_order"
  | "created_at"
>;

// A RPC é a fronteira pública: retorna somente a allowlist definida no SQL,
// sem e-mail, token de revisão, briefing ou qualquer outro dado do cliente.
export async function getPublicPortfolio(): Promise<PortfolioItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_portfolio_projects");

  if (error) throw new Error(error.message);
  return (data ?? []) as PortfolioItem[];
}

export async function getPublicPortfolioCases(): Promise<PortfolioCaseRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_portfolio_cases");

  if (error) throw new Error(error.message);
  return (data ?? []) as PortfolioCaseRecord[];
}

export async function getPublicSiteSettings(): Promise<PortfolioSiteSettings | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_portfolio_site_settings");

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as PortfolioSiteSettings[];
  return rows[0] ?? null;
}

export async function getPublicExternalProjects(): Promise<
  PortfolioExternalProject[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_portfolio_external_projects");

  if (error) throw new Error(error.message);
  return ((data ?? []) as PortfolioExternalProject[]).map((project) => ({
    ...project,
    highlights: project.highlights ?? [],
  }));
}

export async function getPortfolioProjects(): Promise<PortfolioAdminItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, title, client_name, client_company, review_enabled, review_site_path, portfolio_published, portfolio_description, portfolio_cover_url, portfolio_live_url, portfolio_case_id, portfolio_eyebrow, portfolio_objective, portfolio_solution, portfolio_deliverables, portfolio_image_alt, portfolio_sort_order, created_at",
    )
    .order("portfolio_published", { ascending: false })
    .order("portfolio_sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as PortfolioAdminItem[];
}

export async function getPortfolioCases(): Promise<PortfolioCaseRecord[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("portfolio_cases")
    .select("id, client, summary, services, sort_order")
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as PortfolioCaseRecord[];
}

export async function getExternalProjects(): Promise<
  PortfolioExternalAdminItem[]
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("portfolio_external_projects")
    .select(
      "id, title, client_label, description, url, cover_url, image_alt, highlights, published, sort_order, created_at",
    )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as PortfolioExternalAdminItem[]).map((project) => ({
    ...project,
    highlights: project.highlights ?? [],
  }));
}

export async function updatePortfolioSettings(
  projectId: string,
  input: {
    published: boolean;
    description: string;
    coverUrl: string;
    liveUrl: string;
  },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  // O link vai para uma página pública: recusa esquemas que não sejam http(s).
  const liveUrl = input.liveUrl.trim();
  if (liveUrl) {
    try {
      const parsed = new URL(liveUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return { error: "O endereço do site precisa começar com http:// ou https://." };
      }
    } catch {
      return { error: "O endereço do site não é uma URL válida." };
    }
  }

  const { error } = await supabase
    .from("projects")
    .update({
      portfolio_published: input.published,
      portfolio_description: input.description.trim() || null,
      portfolio_cover_url: input.coverUrl.trim() || null,
      portfolio_live_url: liveUrl || null,
    })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/sites/${projectId}`);
  revalidatePath("/portfolio/gerenciar");
  revalidatePath("/");
  return { success: true };
}

// O portfólio é a página inicial do domínio, então a rota pública a
// revalidar é "/".
function revalidatePortfolio() {
  revalidatePath("/portfolio/gerenciar");
  revalidatePath("/");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// Conteúdo editorial que o case usa na página pública (Objetivo, Solução e
// etiquetas de Entregas). Só faz efeito visual em projetos vinculados a um case.
export async function updateProjectEditorial(
  projectId: string,
  input: {
    eyebrow: string;
    objective: string;
    solution: string;
    deliverables: string[];
    imageAlt: string;
    caseId: string | null;
  },
) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const { error } = await supabase
    .from("projects")
    .update({
      portfolio_eyebrow: input.eyebrow.trim() || null,
      portfolio_objective: input.objective.trim() || null,
      portfolio_solution: input.solution.trim() || null,
      portfolio_deliverables: input.deliverables
        .map((item) => item.trim())
        .filter(Boolean),
      portfolio_image_alt: input.imageAlt.trim() || null,
      portfolio_case_id: input.caseId,
    })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePortfolio();
  return { success: true };
}

export async function updatePortfolioCase(
  caseId: string,
  input: { client: string; summary: string; services: string[] },
) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  if (!input.client.trim()) return { error: "Informe o nome do cliente." };

  const { error } = await supabase
    .from("portfolio_cases")
    .update({
      client: input.client.trim(),
      summary: input.summary.trim() || null,
      services: input.services.map((s) => s.trim()).filter(Boolean),
      updated_at: new Date().toISOString(),
    })
    .eq("id", caseId);

  if (error) return { error: error.message };

  revalidatePortfolio();
  return { success: true };
}

type ExternalProjectInput = {
  title: string;
  clientLabel: string;
  description: string;
  url: string;
  coverUrl: string;
  imageAlt: string;
  highlights: string[];
  published: boolean;
};

function validateExternalInput(input: ExternalProjectInput) {
  if (!input.title.trim()) return "Informe o título do projeto.";
  if (!input.clientLabel.trim()) return "Informe o nome do cliente.";

  // URL vazia é válida (vira "Case reservado" na página pública), mas se
  // preenchida precisa ser http(s) — evita javascript:/data: em link público.
  for (const [value, label] of [
    [input.url, "do site"],
    [input.coverUrl, "da capa"],
  ] as const) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (label === "da capa" && trimmed.startsWith("/")) continue;
    try {
      const parsed = new URL(trimmed);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return `O endereço ${label} precisa começar com http:// ou https://.`;
      }
    } catch {
      return `O endereço ${label} não é uma URL válida.`;
    }
  }

  return null;
}

export async function createExternalProject(input: ExternalProjectInput) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const validationError = validateExternalInput(input);
  if (validationError) return { error: validationError };

  const { data: last } = await supabase
    .from("portfolio_external_projects")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("portfolio_external_projects")
    .insert({
      owner_id: user.id,
      title: input.title.trim(),
      client_label: input.clientLabel.trim(),
      description: input.description.trim() || null,
      url: input.url.trim() || null,
      cover_url: input.coverUrl.trim() || null,
      image_alt: input.imageAlt.trim() || null,
      highlights: input.highlights.map((h) => h.trim()).filter(Boolean),
      published: input.published,
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePortfolio();
  return { id: data.id as string };
}

export async function updateExternalProject(
  id: string,
  input: ExternalProjectInput,
) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const validationError = validateExternalInput(input);
  if (validationError) return { error: validationError };

  const { error } = await supabase
    .from("portfolio_external_projects")
    .update({
      title: input.title.trim(),
      client_label: input.clientLabel.trim(),
      description: input.description.trim() || null,
      url: input.url.trim() || null,
      cover_url: input.coverUrl.trim() || null,
      image_alt: input.imageAlt.trim() || null,
      highlights: input.highlights.map((h) => h.trim()).filter(Boolean),
      published: input.published,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePortfolio();
  return { success: true };
}

export async function deleteExternalProject(id: string) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const { error } = await supabase
    .from("portfolio_external_projects")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePortfolio();
  return { success: true };
}

// Troca a posição com o vizinho, para reordenar sem drag-and-drop.
export async function moveExternalProject(id: string, direction: "up" | "down") {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const { data: all, error: listError } = await supabase
    .from("portfolio_external_projects")
    .select("id, sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (listError) return { error: listError.message };

  const items = all ?? [];
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return { error: "Projeto não encontrado." };

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= items.length) return { success: true };

  // Reescreve a sequência inteira: os sort_order originais podem ter empates
  // ou buracos, e trocar só os dois valores não garantiria a nova ordem.
  const reordered = [...items];
  [reordered[index], reordered[swapIndex]] = [
    reordered[swapIndex],
    reordered[index],
  ];

  for (const [position, item] of reordered.entries()) {
    const { error } = await supabase
      .from("portfolio_external_projects")
      .update({ sort_order: position })
      .eq("id", item.id);
    if (error) return { error: error.message };
  }

  revalidatePortfolio();
  return { success: true };
}

export async function getSiteSettings(): Promise<PortfolioSiteSettings | null> {
  const { supabase, user } = await requireUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("portfolio_site_settings")
    .select(
      "about_enabled, about_name, about_role, about_bio, about_photo_url, about_linkedin_url, whatsapp_number, whatsapp_message, cta_label",
    )
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as PortfolioSiteSettings | null) ?? null;
}

export async function updateSiteSettings(input: {
  aboutEnabled: boolean;
  aboutName: string;
  aboutRole: string;
  aboutBio: string;
  aboutPhotoUrl: string;
  aboutLinkedinUrl: string;
  whatsappNumber: string;
  whatsappMessage: string;
  ctaLabel: string;
}) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  // Links vão para uma página pública: recusa esquemas que não sejam http(s).
  for (const [value, label] of [
    [input.aboutLinkedinUrl, "do LinkedIn"],
    [input.aboutPhotoUrl, "da foto"],
  ] as const) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (label === "da foto" && trimmed.startsWith("/")) continue;
    try {
      const parsed = new URL(trimmed);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return { error: `O endereço ${label} precisa começar com http:// ou https://.` };
      }
    } catch {
      return { error: `O endereço ${label} não é uma URL válida.` };
    }
  }

  const digits = input.whatsappNumber.replace(/\D/g, "");
  if (digits && digits.length < 12) {
    return {
      error:
        "Informe o WhatsApp com DDI e DDD (ex: 5535988754584) ou deixe vazio.",
    };
  }

  const payload = {
    about_enabled: input.aboutEnabled,
    about_name: input.aboutName.trim() || null,
    about_role: input.aboutRole.trim() || null,
    about_bio: input.aboutBio.trim() || null,
    about_photo_url: input.aboutPhotoUrl.trim() || null,
    about_linkedin_url: input.aboutLinkedinUrl.trim() || null,
    whatsapp_number: digits || null,
    whatsapp_message: input.whatsappMessage.trim() || null,
    cta_label: input.ctaLabel.trim() || null,
    updated_at: new Date().toISOString(),
  };

  // Singleton por owner: cria na primeira gravação, atualiza depois.
  const { data: existing } = await supabase
    .from("portfolio_site_settings")
    .select("owner_id")
    .limit(1)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("portfolio_site_settings")
        .update(payload)
        .eq("owner_id", existing.owner_id)
    : await supabase
        .from("portfolio_site_settings")
        .insert({ ...payload, owner_id: user.id });

  if (error) return { error: error.message };

  revalidatePortfolio();
  return { success: true };
}
