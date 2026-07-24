"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PortfolioItem = {
  id: string;
  title: string;
  client_name: string | null;
  client_company: string | null;
  portfolio_description: string | null;
  portfolio_cover_url: string | null;
  site_path: string | null;
  created_at: string;
};

// Público — passa pela RPC security definer (list_portfolio_projects), que já
// restringe a allowlist de colunas e a projetos com portfolio_published=true.
// Não precisa checar autenticação: a própria RPC é a fronteira de segurança.
export async function getPublicPortfolio(): Promise<PortfolioItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_portfolio_projects");

  if (error) throw new Error(error.message);
  return (data ?? []) as PortfolioItem[];
}

export async function updatePortfolioSettings(
  projectId: string,
  input: { published: boolean; description: string; coverUrl: string },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const { error } = await supabase
    .from("projects")
    .update({
      portfolio_published: input.published,
      portfolio_description: input.description.trim() || null,
      portfolio_cover_url: input.coverUrl.trim() || null,
    })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/sites/${projectId}`);
  revalidatePath("/portfolio");
  return { success: true };
}
