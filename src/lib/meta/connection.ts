import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { metaConfig } from "@/lib/meta/graph";
import type {
  MarketingConnectionSummary,
  MetaAdAccountOption,
  MetaPageOption,
} from "@/types/marketing";

// A linha de marketing_connection tem tokens: só o service-role lê (RLS sem
// policy). Quem chama daqui já passou pelo requireAuthenticatedUser.

export type MarketingConnectionRow = {
  meta_user_id: string | null;
  meta_user_name: string | null;
  user_access_token: string | null;
  token_expires_at: string | null;
  available_pages: MetaPageOption[] | null;
  available_ad_accounts: MetaAdAccountOption[] | null;
  page_id: string | null;
  page_name: string | null;
  page_access_token: string | null;
  ig_user_id: string | null;
  ig_username: string | null;
  ig_profile_picture_url: string | null;
  ad_account_id: string | null;
  ad_account_name: string | null;
  ad_account_currency: string | null;
  connected_by: string | null;
  connected_at: string | null;
};

export async function loadConnection(): Promise<MarketingConnectionRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("marketing_connection").select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MarketingConnectionRow | null) ?? null;
}

export async function saveConnection(fields: Partial<MarketingConnectionRow>) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("marketing_connection")
    .upsert({ id: true, ...fields, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

export async function clearConnection() {
  const admin = createAdminClient();
  const { error } = await admin.from("marketing_connection").delete().eq("id", true);
  if (error) throw new Error(error.message);
}

export function summarizeConnection(row: MarketingConnectionRow | null): MarketingConnectionSummary {
  const { configured } = metaConfig();
  return {
    configured,
    connected: Boolean(row?.user_access_token),
    metaUserName: row?.meta_user_name ?? null,
    tokenExpiresAt: row?.token_expires_at ?? null,
    connectedAt: row?.connected_at ?? null,
    page: row?.page_id ? { id: row.page_id, name: row.page_name } : null,
    instagram: row?.ig_user_id
      ? {
          id: row.ig_user_id,
          username: row.ig_username,
          pictureUrl: row.ig_profile_picture_url,
        }
      : null,
    adAccount: row?.ad_account_id
      ? {
          id: row.ad_account_id,
          name: row.ad_account_name,
          currency: row.ad_account_currency,
        }
      : null,
    availablePages: row?.available_pages ?? [],
    availableAdAccounts: row?.available_ad_accounts ?? [],
  };
}

export class MarketingNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketingNotReadyError";
  }
}

/** Token e conta do Instagram, ou erro dizendo o que falta conectar. */
export function instagramAccess(row: MarketingConnectionRow | null) {
  if (!row?.user_access_token) {
    throw new MarketingNotReadyError("Conecte a conta da Meta em Marketing → Conexão.");
  }
  if (!row.ig_user_id) {
    throw new MarketingNotReadyError(
      "Escolha a Página com o Instagram da INSYT em Marketing → Conexão.",
    );
  }
  // Token da Página derivado de um token longo não expira; o do usuário dura
  // ~60 dias. Para o Instagram, o da Página é o mais estável.
  return {
    token: row.page_access_token ?? row.user_access_token,
    igUserId: row.ig_user_id,
  };
}

export function adsAccess(row: MarketingConnectionRow | null) {
  if (!row?.user_access_token) {
    throw new MarketingNotReadyError("Conecte a conta da Meta em Marketing → Conexão.");
  }
  if (!row.ad_account_id) {
    throw new MarketingNotReadyError("Escolha a conta de anúncios em Marketing → Conexão.");
  }
  return {
    token: row.user_access_token,
    adAccountId: row.ad_account_id,
    currency: row.ad_account_currency ?? "BRL",
  };
}
