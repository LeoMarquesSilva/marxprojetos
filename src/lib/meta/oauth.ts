import "server-only";

import { graphGet, graphGetAll, metaConfig } from "@/lib/meta/graph";
import { loadConnection, saveConnection } from "@/lib/meta/connection";
import type { MetaAdAccountOption, MetaPageOption } from "@/types/marketing";

// Login com o Facebook (conta pessoal que administra a Página/Instagram e a
// conta de anúncios da INSYT). O token curto do login vira um token longo
// (~60 dias); o token da Página tirado dele não expira.

export const META_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
  "ads_read",
  "ads_management",
];

export const OAUTH_STATE_COOKIE = "meta_oauth_state";

export function callbackUrl(origin: string) {
  return `${origin}/api/meta/oauth/callback`;
}

export function buildLoginUrl(origin: string, state: string) {
  const { appId, version, loginConfigId } = metaConfig();
  const url = new URL(`https://www.facebook.com/${version}/dialog/oauth`);
  url.searchParams.set("client_id", appId ?? "");
  url.searchParams.set("redirect_uri", callbackUrl(origin));
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  if (loginConfigId) {
    url.searchParams.set("config_id", loginConfigId);
  } else {
    url.searchParams.set("scope", META_SCOPES.join(","));
  }
  return url.toString();
}

async function exchangeCode(origin: string, code: string) {
  const { appId, appSecret } = metaConfig();
  const short = await graphGet<{ access_token: string }>("oauth/access_token", null, {
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: callbackUrl(origin),
    code,
  });
  const long = await graphGet<{ access_token: string; expires_in?: number }>(
    "oauth/access_token",
    null,
    {
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: short.access_token,
    },
  );
  return {
    token: long.access_token,
    expiresAt: long.expires_in
      ? new Date(Date.now() + long.expires_in * 1000).toISOString()
      : null,
  };
}

type PageRecord = {
  id: string;
  name: string;
  access_token?: string;
  instagram_business_account?: { id: string; username?: string; profile_picture_url?: string };
};

async function discoverPages(token: string) {
  const pages = await graphGetAll<PageRecord>("me/accounts", token, {
    fields:
      "id,name,access_token,instagram_business_account{id,username,profile_picture_url}",
    limit: 100,
  });
  return pages;
}

async function discoverAdAccounts(token: string): Promise<MetaAdAccountOption[]> {
  const accounts = await graphGetAll<{
    id: string;
    name?: string;
    currency?: string;
    account_status?: number;
  }>("me/adaccounts", token, { fields: "id,name,currency,account_status", limit: 100 });
  return accounts.map((account) => ({
    id: account.id,
    name: account.name ?? account.id,
    currency: account.currency ?? null,
    status: account.account_status ?? null,
  }));
}

function toPageOption(page: PageRecord): MetaPageOption {
  return {
    id: page.id,
    name: page.name,
    igUserId: page.instagram_business_account?.id ?? null,
    igUsername: page.instagram_business_account?.username ?? null,
    igPictureUrl: page.instagram_business_account?.profile_picture_url ?? null,
  };
}

function pageFields(page: PageRecord) {
  return {
    page_id: page.id,
    page_name: page.name,
    page_access_token: page.access_token ?? null,
    ig_user_id: page.instagram_business_account?.id ?? null,
    ig_username: page.instagram_business_account?.username ?? null,
    ig_profile_picture_url: page.instagram_business_account?.profile_picture_url ?? null,
  };
}

function adAccountFields(account: MetaAdAccountOption) {
  return {
    ad_account_id: account.id,
    ad_account_name: account.name,
    ad_account_currency: account.currency,
  };
}

/**
 * Troca o código pelo token longo, lista Páginas e contas de anúncio e já
 * escolhe sozinho quando só há uma opção (ou mantém a escolha anterior).
 */
export async function completeLogin(origin: string, code: string, userId: string) {
  const { token, expiresAt } = await exchangeCode(origin, code);
  const me = await graphGet<{ id: string; name?: string }>("me", token, { fields: "id,name" });
  const [pages, adAccounts, previous] = await Promise.all([
    discoverPages(token),
    discoverAdAccounts(token),
    loadConnection(),
  ]);

  const withInstagram = pages.filter((page) => page.instagram_business_account);
  const page =
    withInstagram.find((item) => item.id === previous?.page_id) ??
    (withInstagram.length === 1 ? withInstagram[0] : null);

  const activeAccounts = adAccounts.filter((account) => account.status === 1);
  const adAccount =
    adAccounts.find((item) => item.id === previous?.ad_account_id) ??
    (activeAccounts.length === 1 ? activeAccounts[0] : adAccounts.length === 1 ? adAccounts[0] : null);

  await saveConnection({
    meta_user_id: me.id,
    meta_user_name: me.name ?? null,
    user_access_token: token,
    token_expires_at: expiresAt,
    available_pages: pages.map(toPageOption),
    available_ad_accounts: adAccounts,
    connected_by: userId,
    connected_at: new Date().toISOString(),
    ...(page
      ? pageFields(page)
      : {
          page_id: null,
          page_name: null,
          page_access_token: null,
          ig_user_id: null,
          ig_username: null,
          ig_profile_picture_url: null,
        }),
    ...(adAccount
      ? adAccountFields(adAccount)
      : { ad_account_id: null, ad_account_name: null, ad_account_currency: null }),
  });

  return { pages: pages.length, withInstagram: withInstagram.length, adAccounts: adAccounts.length };
}

export async function selectPage(pageId: string) {
  const connection = await loadConnection();
  if (!connection?.user_access_token) throw new Error("Conecte a conta da Meta primeiro.");
  if (!(connection.available_pages ?? []).some((page) => page.id === pageId)) {
    throw new Error("Página não encontrada entre as liberadas no login.");
  }
  const page = await graphGet<PageRecord>(pageId, connection.user_access_token, {
    fields: "id,name,access_token,instagram_business_account{id,username,profile_picture_url}",
  });
  if (!page.instagram_business_account) {
    throw new Error("Essa Página não tem um Instagram profissional ligado.");
  }
  await saveConnection(pageFields(page));
}

export async function selectAdAccount(adAccountId: string) {
  const connection = await loadConnection();
  const account = (connection?.available_ad_accounts ?? []).find(
    (item) => item.id === adAccountId,
  );
  if (!account) throw new Error("Conta de anúncios não encontrada entre as liberadas no login.");
  await saveConnection(adAccountFields(account));
}
