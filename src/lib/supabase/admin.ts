import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Client privilegiado (service-role) para a Admin API do Supabase Auth
// (criar/listar/excluir usuários). Sem sessão/cookies — nunca importar de
// um componente client. `server-only` garante isso em tempo de build.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
