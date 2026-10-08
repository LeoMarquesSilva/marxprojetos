"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireAuthenticatedUser } from "@/lib/supabase/require-authenticated-user";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Troca a senha de quem está logado. Pede a senha atual: uma sessão aberta
 * esquecida num computador não basta para trocar a senha de alguém.
 */
export async function changeMyPassword(input: {
  currentPassword: string;
  newPassword: string;
}) {
  const { supabase, user } = await requireAuthenticatedUser();

  if (!input.currentPassword) return { error: "Informe a senha atual." };
  if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
    return { error: `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` };
  }
  if (input.newPassword === input.currentPassword) {
    return { error: "A nova senha precisa ser diferente da atual." };
  }
  if (!user.email) return { error: "Usuário sem e-mail." };

  // Cliente avulso, sem cookies: só confere a senha atual, não mexe na sessão.
  const verifier = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: input.currentPassword,
  });
  if (verifyError) return { error: "A senha atual não confere." };
  await verifier.auth.signOut({ scope: "local" });

  const { error } = await supabase.auth.updateUser({ password: input.newPassword });
  if (error) return { error: error.message };

  return { success: true };
}
