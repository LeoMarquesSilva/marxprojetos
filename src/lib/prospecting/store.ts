// Gravação de leads e da análise de sites, compartilhada entre as Server
// Actions (client do usuário, com RLS) e o robô do Maps (service role). Sem
// "use server" e sem server-only: o robô roda fora do Next.

import type { SupabaseClient } from "@supabase/supabase-js";
import { brPhoneMatchKey, normalizeBrPhone } from "@/lib/phone";
import type { FoundLead, LeadSource } from "@/lib/prospecting/providers";
import { scanWebsite, type SiteScanResult } from "@/lib/prospecting/site-scan";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

export const ID_CHUNK = 150;

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
) {
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

// Campos que uma busca nova pode preencher num lead que já existe — só se
// estiverem vazios. Nota e número de avaliações mudam com o tempo e são
// sempre atualizados. Status, mensagem e vínculo com o CRM nunca são tocados.
const FILLABLE_FIELDS = [
  "website",
  "address",
  "email",
  "instagram",
  "facebook",
  "linkedin",
  "category",
  "google_maps_uri",
] as const;

export type SaveLeadsResult =
  | { newIds: string[]; updated: number; total: number; closedSkipped: number }
  | { error: string };

/**
 * Grava o resultado de uma busca. O lugar pode já estar na base de outra
 * pessoa do workspace (o select é compartilhado, o insert não): quem já
 * existe é só completado, em vez de virar um segundo lead do mesmo
 * escritório.
 */
export async function saveFoundLeads(
  supabase: AnySupabase,
  {
    ownerId,
    leads,
    niche,
    city,
    source,
    jobByPlaceId,
  }: {
    ownerId: string;
    leads: FoundLead[];
    niche: string;
    city: string;
    source: LeadSource | "maps";
    jobByPlaceId?: Map<string, string>;
  },
): Promise<SaveLeadsResult> {
  const open = leads.filter((lead) => !lead.closed);
  const closedSkipped = leads.length - open.length;
  if (open.length === 0) return { newIds: [], updated: 0, total: 0, closedSkipped };

  const now = new Date().toISOString();
  const rows = open.map((lead) => {
    const { e164, isMobile } = lead.phone
      ? normalizeBrPhone(lead.phone)
      : { e164: null, isMobile: false };
    return {
      owner_id: ownerId,
      google_place_id: lead.placeId,
      name: lead.name,
      phone: lead.phone,
      phone_e164: e164,
      is_mobile: isMobile,
      website: lead.website,
      address: lead.address,
      rating: lead.rating,
      rating_count: lead.ratingCount,
      google_maps_uri: lead.mapsUri,
      category: lead.category,
      email: lead.email,
      instagram: lead.instagram,
      facebook: lead.facebook,
      linkedin: lead.linkedin,
      niche,
      city,
      source,
      enrich_job_id: jobByPlaceId?.get(lead.placeId) ?? null,
      updated_at: now,
    };
  });

  const existingByPlace = new Map<string, Record<string, unknown>>();
  for (const ids of chunk(rows.map((row) => row.google_place_id), ID_CHUNK)) {
    const { data, error } = await supabase
      .from("prospects")
      .select(
        "id, google_place_id, phone, phone_e164, website, address, email, instagram, facebook, linkedin, category, google_maps_uri",
      )
      .in("google_place_id", ids);
    if (error) return { error: error.message };
    for (const row of data ?? []) existingByPlace.set(row.google_place_id, row);
  }

  const newRows = rows.filter((row) => !existingByPlace.has(row.google_place_id));
  const newIds: string[] = [];
  for (const batch of chunk(newRows, 200)) {
    const { data, error } = await supabase
      .from("prospects")
      .upsert(batch, { onConflict: "owner_id,google_place_id", ignoreDuplicates: true })
      .select("id");
    if (error) return { error: error.message };
    newIds.push(...(data ?? []).map((row: { id: string }) => row.id));
  }

  let updated = 0;
  const toUpdate = rows.filter((row) => existingByPlace.has(row.google_place_id));
  await mapWithConcurrency(toUpdate, 5, async (row) => {
    const existing = existingByPlace.get(row.google_place_id)!;
    const patch: Record<string, unknown> = {};
    for (const field of FILLABLE_FIELDS) {
      if (existing[field] == null && row[field] != null) patch[field] = row[field];
    }
    if (existing.phone_e164 == null && row.phone_e164) {
      patch.phone = row.phone;
      patch.phone_e164 = row.phone_e164;
      patch.is_mobile = row.is_mobile;
    }
    if (row.rating != null) patch.rating = row.rating;
    if (row.rating_count != null) patch.rating_count = row.rating_count;
    if (Object.keys(patch).length === 0) return;

    const { error } = await supabase
      .from("prospects")
      .update({ ...patch, updated_at: now })
      .eq("id", existing.id as string);
    if (!error) updated += 1;
  });

  return { newIds, updated, total: rows.length, closedSkipped };
}

type ScanTarget = {
  id: string;
  website: string;
  phone_e164: string | null;
  is_mobile: boolean;
  has_whatsapp: boolean | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
};

/**
 * O que a análise do site muda no lead. Contato só completa o que está
 * vazio; o WhatsApp do site substitui o telefone do Maps quando o do Maps é
 * fraco (ausente, fixo não confirmado ou já reprovado na verificação).
 */
export function buildSiteScanPatch(lead: ScanTarget, scan: SiteScanResult, now: Date) {
  const patch: Record<string, unknown> = {
    site_status: scan.status,
    site_issues: scan.issues,
    site_checked_at: now.toISOString(),
    site_whatsapp: scan.whatsapp,
    updated_at: now.toISOString(),
  };
  let foundEmail = false;
  let foundWhatsapp = false;

  if (!lead.email && scan.emails[0]) {
    patch.email = scan.emails[0];
    foundEmail = true;
  }
  if (!lead.instagram && scan.instagram) patch.instagram = scan.instagram;
  if (!lead.facebook && scan.facebook) patch.facebook = scan.facebook;
  if (!lead.linkedin && scan.linkedin) patch.linkedin = scan.linkedin;

  if (
    scan.whatsapp &&
    brPhoneMatchKey(scan.whatsapp) !== brPhoneMatchKey(lead.phone_e164 ?? "")
  ) {
    const weak =
      !lead.phone_e164 ||
      lead.has_whatsapp === false ||
      (!lead.is_mobile && lead.has_whatsapp !== true);
    if (weak) {
      patch.phone_e164 = scan.whatsapp;
      patch.is_mobile = normalizeBrPhone(scan.whatsapp).isMobile;
      patch.has_whatsapp = null;
      patch.whatsapp_checked_at = null;
      patch.whatsapp_jid = null;
      foundWhatsapp = true;
    }
  }

  return { patch, foundEmail, foundWhatsapp };
}

export type WhatsAppNumberVerdict = { exists: boolean; jid: string | null };

/**
 * Pergunta ao WhatsApp quais leads têm conta e grava o veredito. A consulta
 * em si vem por parâmetro (checkWhatsAppNumbers da Evolution) para este
 * módulo não depender do client server-only. Erro da consulta sobe.
 *
 * Por padrão só quem nunca foi verificado; `todos` refaz; `ids` restringe.
 */
export async function verifyAndSaveWhatsapp(
  supabase: AnySupabase,
  { ids, todos = false }: { ids?: string[]; todos?: boolean },
  checkNumbers: (numbers: string[]) => Promise<Map<string, WhatsAppNumberVerdict>>,
) {
  // Os ids vão na URL do PostgREST: em lotes, senão a URL estoura e a
  // consulta falha com "fetch failed".
  const idChunks: (string[] | null)[] = ids?.length ? chunk(ids, ID_CHUNK) : [null];
  const leads: { id: string; phone_e164: string }[] = [];
  for (const idsChunk of idChunks) {
    let query = supabase
      .from("prospects")
      .select("id, phone_e164")
      .not("phone_e164", "is", null);
    if (!todos) query = query.is("whatsapp_checked_at", null);
    if (idsChunk) query = query.in("id", idsChunk);

    const { data, error } = await query;
    if (error) return { error: error.message };
    leads.push(...((data ?? []) as { id: string; phone_e164: string }[]));
  }

  const empty = {
    verificados: 0,
    comWhatsapp: 0,
    semWhatsapp: 0,
    naoSalvos: 0,
    comIds: [] as string[],
    semIds: [] as string[],
  };
  if (!leads || leads.length === 0) return empty;

  // Números repetidos entre leads viram uma pergunta só.
  const existencia = await checkNumbers([
    ...new Set((leads as { phone_e164: string }[]).map((lead) => lead.phone_e164)),
  ]);

  const agora = new Date().toISOString();
  const comIds: string[] = [];
  const semIds: string[] = [];
  const jidFixes: { id: string; jid: string }[] = [];

  for (const lead of leads as { id: string; phone_e164: string }[]) {
    const check =
      existencia.get(lead.phone_e164) ?? existencia.get(brPhoneMatchKey(lead.phone_e164) ?? "");
    // Número que a Evolution não respondeu fica sem veredito em vez de
    // virar "não tem" — marcar errado esconderia um lead bom.
    if (!check) continue;
    if (check.exists) {
      comIds.push(lead.id);
      if (check.jid) jidFixes.push({ id: lead.id, jid: check.jid });
    } else {
      semIds.push(lead.id);
    }
  }

  let naoSalvos = 0;
  for (const [verdict, verdictIds] of [
    [true, comIds],
    [false, semIds],
  ] as const) {
    for (const idsChunk of chunk(verdictIds, ID_CHUNK)) {
      const { error: updateError } = await supabase
        .from("prospects")
        .update({ has_whatsapp: verdict, whatsapp_checked_at: agora, updated_at: agora })
        .in("id", idsChunk);
      if (updateError) naoSalvos += idsChunk.length;
    }
  }

  // JID real (às vezes sem o nono dígito): o envio vai direto para ele e a
  // resposta cai na mesma conversa.
  await mapWithConcurrency(jidFixes, 5, async ({ id, jid }) => {
    await supabase.from("prospects").update({ whatsapp_jid: jid }).eq("id", id);
  });

  return {
    verificados: comIds.length + semIds.length - naoSalvos,
    comWhatsapp: comIds.length,
    semWhatsapp: semIds.length,
    naoSalvos,
    comIds,
    semIds,
  };
}

export type SiteScanStats = {
  scanned: number;
  offline: number;
  withIssues: number;
  foundEmail: number;
  foundWhatsapp: number;
};

/** Analisa e grava os sites dos leads ainda não analisados (em lote). */
export async function scanAndSaveSites(
  supabase: AnySupabase,
  { ids, limit = 12, concurrency = 6 }: { ids?: string[]; limit?: number; concurrency?: number },
): Promise<(SiteScanStats & { remaining: number }) | { error: string }> {
  let query = supabase
    .from("prospects")
    .select("id, website, phone_e164, is_mobile, has_whatsapp, email, instagram, facebook, linkedin")
    .not("website", "is", null)
    .is("site_checked_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (ids?.length) query = query.in("id", ids.slice(0, ID_CHUNK));

  const { data: leads, error } = await query;
  if (error) return { error: error.message };

  const now = new Date();
  const stats: SiteScanStats = {
    scanned: 0,
    offline: 0,
    withIssues: 0,
    foundEmail: 0,
    foundWhatsapp: 0,
  };

  await mapWithConcurrency((leads ?? []) as ScanTarget[], concurrency, async (lead) => {
    const scan = await scanWebsite(lead.website, { now });
    const { patch, foundEmail, foundWhatsapp } = buildSiteScanPatch(lead, scan, now);
    const { error: updateError } = await supabase.from("prospects").update(patch).eq("id", lead.id);
    if (updateError) return;

    stats.scanned += 1;
    if (foundEmail) stats.foundEmail += 1;
    if (foundWhatsapp) stats.foundWhatsapp += 1;
    if (scan.status !== "ok") stats.offline += 1;
    else if (scan.issues.length > 0) stats.withIssues += 1;
  });

  let remainingQuery = supabase
    .from("prospects")
    .select("id", { count: "exact", head: true })
    .not("website", "is", null)
    .is("site_checked_at", null);
  if (ids?.length) remainingQuery = remainingQuery.in("id", ids.slice(0, ID_CHUNK));
  const { count: remaining } = await remainingQuery;

  return { ...stats, remaining: remaining ?? 0 };
}
