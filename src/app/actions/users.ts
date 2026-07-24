"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppUser, UserRole } from "@/types/users";

async function getCurrentUserAndRole() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, role: null as UserRole | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return { user, role: (profile?.role as UserRole | undefined) ?? "member" };
}

export async function getMyRole() {
  const { role } = await getCurrentUserAndRole();
  return role;
}

async function requireAdmin() {
  const { user, role } = await getCurrentUserAndRole();
  if (!user) redirect("/login");
  if (role !== "admin") {
    return { error: "Apenas administradores podem fazer isso." as const, user: null };
  }
  return { error: null, user };
}

export async function listUsers(): Promise<{ error: string } | { users: AppUser[] }> {
  const guard = await requireAdmin();
  if (guard.error) return { error: guard.error };

  const admin = createAdminClient();

  const [{ data: authList, error: authError }, { data: profiles, error: profilesError }] =
    await Promise.all([
      admin.auth.admin.listUsers({ perPage: 1000 }),
      admin.from("profiles").select("id, role"),
    ]);

  if (authError) return { error: authError.message };
  if (profilesError) return { error: profilesError.message };

  const roleById = new Map((profiles ?? []).map((p) => [p.id, p.role as UserRole]));

  const users: AppUser[] = authList.users
    .map((u) => ({
      id: u.id,
      email: u.email ?? "",
      role: roleById.get(u.id) ?? "member",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
    }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  return { users };
}

export async function createUser(input: { email: string; password: string; role: UserRole }) {
  const guard = await requireAdmin();
  if (guard.error) return { error: guard.error };

  const email = input.email.trim();
  const password = input.password;

  if (!email || !email.includes("@")) {
    return { error: "Informe um e-mail válido." };
  }
  if (password.length < 8) {
    return { error: "A senha precisa ter pelo menos 8 caracteres." };
  }

  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) return { error: error.message };

  if (input.role === "admin") {
    const { error: roleError } = await admin
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", data.user.id);
    if (roleError) return { error: roleError.message };
  }

  revalidatePath("/configuracoes");
  return { id: data.user.id };
}

export async function updateUserRole(userId: string, role: UserRole) {
  const guard = await requireAdmin();
  if (guard.error) return { error: guard.error };

  const admin = createAdminClient();

  if (role !== "admin") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");

    const { data: current } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (current?.role === "admin" && (count ?? 0) <= 1) {
      return { error: "Não é possível rebaixar o último administrador." };
    }
  }

  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/configuracoes");
  return { success: true };
}

export async function deleteUser(userId: string) {
  const guard = await requireAdmin();
  if (guard.error) return { error: guard.error };

  if (guard.user!.id === userId) {
    return { error: "Você não pode excluir sua própria conta." };
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (target?.role === "admin") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return { error: "Não é possível excluir o último administrador." };
    }
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  revalidatePath("/configuracoes");
  return { success: true };
}
