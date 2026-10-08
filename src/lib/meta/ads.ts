import "server-only";

import { graphGet, graphGetAll, graphPost } from "@/lib/meta/graph";
import { MESSAGING_ACTION, actionValue, toNumber } from "@/lib/marketing";
import type { DailyPoint } from "@/types/marketing";

type Access = { token: string; adAccountId: string };
type Range = { since: string; until: string };

export type CampaignRecord = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective?: string;
  daily_budget?: string;
};

export type CampaignInsightRecord = {
  campaign_id?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  ctr?: string;
  cpm?: string;
  actions?: { action_type?: string; value?: string }[];
};

function timeRange(range: Range) {
  return JSON.stringify({ since: range.since, until: range.until });
}

export async function fetchCampaigns({ token, adAccountId }: Access) {
  return graphGetAll<CampaignRecord>(`${adAccountId}/campaigns`, token, {
    fields: "id,name,status,effective_status,objective,daily_budget",
    limit: 100,
  });
}

export async function fetchCampaignInsights({ token, adAccountId }: Access, range: Range) {
  return graphGetAll<CampaignInsightRecord>(`${adAccountId}/insights`, token, {
    level: "campaign",
    fields: "campaign_id,spend,impressions,reach,clicks,ctr,cpm,actions",
    time_range: timeRange(range),
    limit: 100,
  });
}

/** Anúncio → campanha, para atribuir os leads do CRM (que guardam o ad_id). */
export async function fetchCampaignByAd({ token, adAccountId }: Access) {
  const ads = await graphGetAll<{ id: string; campaign_id?: string }>(
    `${adAccountId}/ads`,
    token,
    { fields: "id,campaign_id", limit: 200 },
    2000,
  );
  return new Map(
    ads.filter((ad) => ad.campaign_id).map((ad) => [ad.id, ad.campaign_id as string]),
  );
}

export async function fetchDailySpend({ token, adAccountId }: Access, range: Range) {
  const rows = await graphGetAll<{
    date_start: string;
    spend?: string;
    actions?: { action_type?: string; value?: string }[];
  }>(`${adAccountId}/insights`, token, {
    level: "account",
    fields: "spend,actions",
    time_increment: 1,
    time_range: timeRange(range),
    limit: 100,
  });
  const spend: DailyPoint[] = [];
  const conversations: DailyPoint[] = [];
  for (const row of rows) {
    spend.push({ date: row.date_start, value: toNumber(row.spend) });
    conversations.push({
      date: row.date_start,
      value: actionValue(row.actions, [MESSAGING_ACTION]),
    });
  }
  return { spend, conversations };
}

export async function fetchAccountInfo({ token, adAccountId }: Access) {
  return graphGet<{ name?: string; currency?: string; amount_spent?: string; balance?: string }>(
    adAccountId,
    token,
    { fields: "name,currency,amount_spent,balance" },
  );
}

export async function setCampaignStatus(token: string, campaignId: string, active: boolean) {
  return graphPost<{ success?: boolean }>(campaignId, token, {
    status: active ? "ACTIVE" : "PAUSED",
  });
}
