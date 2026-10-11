"use server";

import { revalidatePath } from "next/cache";
import {
  brPhoneMatchKey,
  formatBrPhone,
  normalizeBrPhone,
  phoneToRemoteJid,
} from "@/lib/phone";
import { inferWebsiteFromRow, parseCsv, pickColumn, slugify } from "@/lib/csv";
import { requireAuthenticatedUser } from "@/lib/supabase/require-authenticated-user";
import { sendCrmWhatsappChatMessage } from "@/app/actions/crm-whatsapp";
import { checkWhatsAppNumbers } from "@/lib/evolution";
import {
  DEFAULT_APIFY_ACTOR,
  LP_BASE,
  ProviderError,
  dedupeLeads,
  fetchGoogleCityViewport,
  lpBusinessId,
  runApifyGoogleMaps,
  searchGooglePlaces,
  searchLocalProspects,
  splitViewport,
  type FoundLead,
  type LeadSource,
  type LpEnrichedBusiness,
} from "@/lib/prospecting/providers";
import {
  ID_CHUNK,
  chunk,
  mapWithConcurrency,
  saveFoundLeads,
  scanAndSaveSites,
  verifyAndSaveWhatsapp,
} from "@/lib/prospecting/store";
import { matchSegment, searchTermsFor } from "@/lib/prospecting/segments";
import { renderProspectMessage, siteDiagnosis, templateFor } from "@/lib/prospecting/message";
import {
  DEFAULT_DAILY_LIMIT,
  DEFAULT_FOLLOWUP_TEMPLATE,
  DEFAULT_SITE_TEMPLATE,
  DEFAULT_PROSPECTING_TEMPLATE,
  type Prospect,
  type ProspectStatus,
  type ProspectingSettings,
} from "@/types/prospecting";

type AuthenticatedContext = Awaited<ReturnType<typeof requireAuthenticatedUser>>;
type Supabase = AuthenticatedContext["supabase"];
type PromoteToCrmResult =
  | { crmClientId: string; error?: never }
  | { error: string; crmClientId?: never };

export type SearchProvider = Exclude<LeadSource, "csv">;
export type SearchMode = "padrao" | "ampla" | "varredura";

export type ProspectSearchInput = {
  niche: string;
  city: string;
  /** Nome do estado por extenso ("São Paulo"). */
  state?: string;
  provider: SearchProvider;
  mode?: SearchMode;
  segmentId?: string | null;
};

export type ProspectingStatus = {
  providers: Record<SearchProvider, boolean>;
  whatsapp: boolean;
  ai: boolean;
  sentToday: number;
  dailyLimit: number;
};

export type WhatsappCheckSummary = {
  error?: string;
  verificados: number;
  comWhatsapp: number;
  semWhatsapp: number;
  naoSalvos: number;
  /** O disparo em lote usa os ids para tirar da fila quem não tem WhatsApp. */
  comIds: string[];
  semIds: string[];
};

export type MapsSearchJob = {
  id: string;
  niche: string;
  city: string;
  state: string | null;
  mode: SearchMode;
  status: "pendente" | "rodando" | "concluido" | "erro" | "cancelado";
  progress: string | null;
  found: number;
  imported: number;
  updated: number;
  new_ids: string[];
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

// Início do dia em Brasília (sem horário de verão desde 2019). É a régua do
// limite diário de envios.
function startOfTodayInSaoPaulo(now = new Date()) {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(`${date}T00:00:00-03:00`).toISOString();
}

function apifyToken() {
  return process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN || null;
}

function googleKey() {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || null;
}

function openAiKey() {
  return (
    process.env.OPENAI_API_KEY || process.env.NEXT_OPENAI_API_KEY || process.env.OPENAI_KEY
  );
}

/* ------------------------------------------------------------------ */
/* Leitura                                                             */
/* ------------------------------------------------------------------ */

export async function getProspects() {
  const { supabase } = await requireAuthenticatedUser();
  const { data, error } = await supabase
    .from("prospects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data as Prospect[];
}

// O select é compartilhado no workspace: vale o modelo salvo mais recente,
// de quem quer que seja. select("*") de propósito — antes da migration as
// colunas novas não existem e o modelo ainda precisa carregar.
async function loadSettings(supabase: Supabase): Promise<ProspectingSettings> {
  const { data, error } = await supabase
    .from("prospecting_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  // Devolve o que está salvo, sem tocar em nada: o modelo é usado como está.
  return {
    template: data?.template?.trim() || DEFAULT_PROSPECTING_TEMPLATE,
    siteTemplate: data?.site_template?.trim() || DEFAULT_SITE_TEMPLATE,
    followupTemplate: data?.followup_template?.trim() || DEFAULT_FOLLOWUP_TEMPLATE,
    dailyLimit:
      typeof data?.daily_limit === "number" && data.daily_limit > 0
        ? data.daily_limit
        : DEFAULT_DAILY_LIMIT,
  };
}

export async function getProspectingSettings() {
  const { supabase } = await requireAuthenticatedUser();
  return loadSettings(supabase);
}

async function countSentToday(supabase: Supabase) {
  const since = startOfTodayInSaoPaulo();
  const [first, followups] = await Promise.all([
    supabase
      .from("prospects")
      .select("id", { count: "exact", head: true })
      .gte("contacted_at", since),
    supabase
      .from("prospects")
      .select("id", { count: "exact", head: true })
      .gte("last_followup_at", since),
  ]);
  return (first.count ?? 0) + (followups.count ?? 0);
}

export async function getProspectingStatus(): Promise<ProspectingStatus> {
  const { supabase } = await requireAuthenticatedUser();
  const [settings, sentToday] = await Promise.all([
    loadSettings(supabase),
    countSentToday(supabase),
  ]);

  return {
    providers: {
      // O robô próprio não precisa de chave; precisa estar ligado no
      // computador (o painel da fila mostra se está).
      maps: true,
      google: Boolean(googleKey()),
      apify: Boolean(apifyToken()),
      localprospects: Boolean(process.env.LOCALPROSPECTS_API_KEY),
    },
    whatsapp: Boolean(
      process.env.EVOLUTION_API_URL &&
        process.env.EVOLUTION_API_KEY &&
        process.env.EVOLUTION_INSTANCE,
    ),
    ai: Boolean(openAiKey()),
    sentToday,
    dailyLimit: settings.dailyLimit,
  };
}

export async function saveProspectingSettings(input: {
  template: string;
  siteTemplate: string;
  followupTemplate: string;
  dailyLimit: number;
}) {
  const { supabase, user } = await requireAuthenticatedUser();

  const template = input.template.trim();
  const siteTemplate = input.siteTemplate.trim();
  const followupTemplate = input.followupTemplate.trim();
  const dailyLimit = Math.round(input.dailyLimit);
  if (!template) return { error: "A primeira mensagem não pode ficar vazia." };
  if (!siteTemplate) return { error: "A mensagem para quem já tem site não pode ficar vazia." };
  if (!followupTemplate) return { error: "O follow-up não pode ficar vazio." };
  if (!Number.isFinite(dailyLimit) || dailyLimit < 1 || dailyLimit > 500) {
    return { error: "O limite diário precisa ficar entre 1 e 500 envios." };
  }

  const { error } = await supabase.from("prospecting_settings").upsert(
    {
      owner_id: user.id,
      template,
      site_template: siteTemplate,
      followup_template: followupTemplate,
      daily_limit: dailyLimit,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id" },
  );

  if (error) return { error: error.message };
  revalidatePath("/prospeccao");
  return { success: true };
}

/* ------------------------------------------------------------------ */
/* Busca                                                               */
/* ------------------------------------------------------------------ */

async function collectLeads(
  input: Required<Pick<ProspectSearchInput, "provider" | "mode">> & {
    terms: string[];
    city: string;
    stateName?: string;
  },
): Promise<{ leads: FoundLead[]; jobByPlaceId: Map<string, string>; requests: number }> {
  const place = input.stateName ? `${input.city}, ${input.stateName}` : input.city;
  const jobByPlaceId = new Map<string, string>();

  if (input.provider === "google") {
    const apiKey = googleKey();
    if (!apiKey) {
      throw new ProviderError(
        "Configure GOOGLE_PLACES_API_KEY (Places API New) no ambiente (.env e Vercel).",
      );
    }

    const leads: FoundLead[] = [];
    let requests = 0;

    if (input.mode === "varredura") {
      // O Google para em 60 resultados por busca. Dividindo a cidade em 9
      // quadrantes, cada um devolve os seus 60 — é assim que a lista passa
      // de algumas dezenas para centenas.
      const viewport = await fetchGoogleCityViewport({ apiKey, city: `${place}, Brasil` });
      requests += 1;
      if (!viewport) {
        throw new ProviderError(`Não achei os limites de ${input.city} no Google Maps.`);
      }
      await mapWithConcurrency(splitViewport(viewport, 3), 3, async (tile) => {
        const result = await searchGooglePlaces({
          apiKey,
          textQuery: input.terms[0],
          locationRestriction: tile,
        });
        leads.push(...result.leads);
        requests += result.requests;
      });
    } else {
      await mapWithConcurrency(input.terms, 3, async (term) => {
        const result = await searchGooglePlaces({
          apiKey,
          textQuery: `${term} em ${place}`,
        });
        leads.push(...result.leads);
        requests += result.requests;
      });
    }

    return { leads, jobByPlaceId, requests };
  }

  if (input.provider === "apify") {
    const token = apifyToken();
    if (!token) {
      throw new ProviderError("Configure APIFY_TOKEN no ambiente (.env e Vercel).");
    }
    const maxPerTerm =
      input.mode === "varredura" ? 300 : input.mode === "ampla" ? 50 : 80;
    const leads = await runApifyGoogleMaps({
      token,
      terms: input.terms,
      locationQuery: `${place}, Brasil`,
      maxPerTerm,
      actor: process.env.APIFY_MAPS_ACTOR || DEFAULT_APIFY_ACTOR,
    });
    return { leads, jobByPlaceId, requests: 1 };
  }

  const apiKey = process.env.LOCALPROSPECTS_API_KEY;
  if (!apiKey) {
    throw new ProviderError(
      "Configure LOCALPROSPECTS_API_KEY no ambiente (.env local e variáveis do Vercel).",
    );
  }
  const leads: FoundLead[] = [];
  for (const term of input.terms) {
    const result = await searchLocalProspects({
      apiKey,
      keyword: term,
      city: input.city,
      stateName: input.stateName,
    });
    for (const lead of result.leads) {
      leads.push(lead);
      if (result.jobId) jobByPlaceId.set(lead.placeId, result.jobId);
    }
  }
  return { leads, jobByPlaceId, requests: input.terms.length };
}

export async function searchPlaces(input: ProspectSearchInput) {
  const { supabase, user } = await requireAuthenticatedUser();

  const niche = input.niche?.trim() ?? "";
  const city = input.city?.trim() ?? "";
  if (!niche || !city) return { error: "Informe o nicho e a cidade." };

  const mode: SearchMode =
    input.mode === "ampla" || input.mode === "varredura" ? input.mode : "padrao";
  if (input.provider === "maps") {
    return { error: "O robô do Maps trabalha pela fila — use queueMapsSearch." };
  }
  const provider: SearchProvider =
    input.provider === "apify" || input.provider === "localprospects"
      ? input.provider
      : "google";
  const terms = searchTermsFor(niche, mode, input.segmentId);

  let collected: Awaited<ReturnType<typeof collectLeads>>;
  try {
    collected = await collectLeads({
      provider,
      mode,
      terms,
      city,
      stateName: input.state?.trim() || undefined,
    });
  } catch (searchError) {
    if (searchError instanceof ProviderError) return { error: searchError.message };
    console.error("[prospecção] falha na busca:", searchError);
    return { error: "A busca falhou. Tente de novo em instantes." };
  }

  const saved = await saveFoundLeads(supabase, {
    ownerId: user.id,
    leads: dedupeLeads(collected.leads),
    niche,
    city,
    source: provider,
    jobByPlaceId: collected.jobByPlaceId,
  });
  if ("error" in saved) return { error: saved.error };

  revalidatePath("/prospeccao");
  return {
    imported: saved.newIds.length,
    updated: saved.updated,
    total: saved.total,
    closedSkipped: saved.closedSkipped,
    newIds: saved.newIds,
    terms,
    requests: collected.requests,
  };
}

/* ------------------------------------------------------------------ */
/* Robô próprio do Maps (fila)                                         */
/* ------------------------------------------------------------------ */

// O robô roda no computador (npm run maps:robo) e avisa que está vivo a
// cada poucos segundos. Mais de 1 minuto sem sinal = desligado.
const WORKER_ONLINE_MS = 60_000;

/**
 * Coloca uma busca na fila do robô. Nada de API: o robô abre o Google Maps
 * num navegador, rola a lista e lê cada empresa. A Vercel não tem navegador,
 * por isso a busca não roda aqui — o robô pega o pedido e grava os leads.
 */
export async function queueMapsSearch(input: Omit<ProspectSearchInput, "provider">) {
  const { supabase, user } = await requireAuthenticatedUser();

  const niche = input.niche?.trim() ?? "";
  const city = input.city?.trim() ?? "";
  if (!niche || !city) return { error: "Informe o nicho e a cidade." };

  const mode: SearchMode =
    input.mode === "ampla" || input.mode === "varredura" ? input.mode : "padrao";

  const { data, error } = await supabase
    .from("prospect_search_jobs")
    .insert({
      owner_id: user.id,
      niche,
      city,
      state: input.state?.trim() || null,
      mode,
      terms: searchTermsFor(niche, mode, input.segmentId),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { jobId: data.id as string };
}

export type MapsQueueSnapshot = {
  jobs: MapsSearchJob[];
  workerOnline: boolean;
  workerSeenAt: string | null;
};

export async function getMapsSearchJobs(): Promise<MapsQueueSnapshot> {
  const { supabase } = await requireAuthenticatedUser();

  const [jobsResult, heartbeatResult] = await Promise.all([
    supabase
      .from("prospect_search_jobs")
      .select(
        "id, niche, city, state, mode, status, progress, found, imported, updated, new_ids, error, created_at, started_at, finished_at",
      )
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("prospect_worker_heartbeats")
      .select("last_seen_at")
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Antes da migration as tabelas não existem: a tela segue sem a fila.
  const workerSeenAt = (heartbeatResult.data?.last_seen_at as string | undefined) ?? null;
  return {
    jobs: (jobsResult.data ?? []) as MapsSearchJob[],
    workerOnline: Boolean(
      workerSeenAt && Date.now() - new Date(workerSeenAt).getTime() < WORKER_ONLINE_MS,
    ),
    workerSeenAt,
  };
}

export async function cancelMapsSearch(jobId: string) {
  const { supabase } = await requireAuthenticatedUser();
  // Pendente sai da fila na hora; em andamento, o robô confere entre uma
  // busca e outra e para.
  const { error } = await supabase
    .from("prospect_search_jobs")
    .update({ status: "cancelado", finished_at: new Date().toISOString() })
    .eq("id", jobId)
    .in("status", ["pendente", "rodando"]);

  if (error) return { error: error.message };
  return { success: true };
}

/* ------------------------------------------------------------------ */
/* Enriquecimento                                                      */
/* ------------------------------------------------------------------ */

/**
 * Visita o site de cada lead atrás de e-mail, WhatsApp e redes, e anota os
 * problemas do site (argumento de venda). Em lotes pequenos para caber no
 * tempo de uma requisição — a tela chama de novo enquanto houver pendentes.
 */
export async function scanProspectSites({
  ids,
  limit = 12,
}: { ids?: string[]; limit?: number } = {}) {
  const { supabase } = await requireAuthenticatedUser();
  const result = await scanAndSaveSites(supabase, {
    ids,
    limit: Math.max(1, Math.min(20, Math.round(limit))),
  });
  if ("error" in result) return { error: result.error };

  revalidatePath("/prospeccao");
  return result;
}

/**
 * Pergunta à Evolution quais leads realmente têm WhatsApp.
 *
 * Nenhuma mensagem é enviada: é só a consulta de existência. Serve para
 * parar de descobrir isso no erro de um envio — `is_mobile` é palpite pela
 * contagem de dígitos, e escritório com WhatsApp Business em linha fixa
 * quebra esse palpite nos dois sentidos.
 *
 * Por padrão verifica só quem nunca foi verificado, para uma segunda rodada
 * não pagar de novo pela base inteira. `todos` refaz tudo; `ids` restringe
 * aos leads recém-buscados ou selecionados.
 */
export async function checkProspectsWhatsapp({
  todos = false,
  ids,
}: { todos?: boolean; ids?: string[] } = {}): Promise<WhatsappCheckSummary> {
  const { supabase } = await requireAuthenticatedUser();
  const nada = {
    verificados: 0,
    comWhatsapp: 0,
    semWhatsapp: 0,
    naoSalvos: 0,
    comIds: [],
    semIds: [],
  };

  try {
    const result = await verifyAndSaveWhatsapp(supabase, { ids, todos }, checkWhatsAppNumbers);
    if ("error" in result) return { ...nada, error: result.error };
    revalidatePath("/prospeccao");
    return result;
  } catch (checkError) {
    console.error("[prospecção] falha ao verificar números:", checkError);
    return {
      ...nada,
      error:
        "Não consegui consultar o WhatsApp agora. Verifique a conexão da instância e tente de novo.",
    };
  }
}

// Aplica o enriquecimento assíncrono do LocalProspects (email, tipo de
// telefone, celular) aos leads cujo job já terminou. enrich_job_id = null
// marca o lead como "enriquecimento aplicado".
export async function refreshEnrichment() {
  const { supabase } = await requireAuthenticatedUser();

  const apiKey = process.env.LOCALPROSPECTS_API_KEY;
  if (!apiKey) {
    return {
      error:
        "Configure LOCALPROSPECTS_API_KEY no ambiente (.env local e variáveis do Vercel).",
    };
  }

  const { data: pending, error: pendingError } = await supabase
    .from("prospects")
    .select("id, google_place_id, enrich_job_id, email, website, phone, phone_e164")
    .not("enrich_job_id", "is", null);

  if (pendingError) return { error: pendingError.message };
  if (!pending || pending.length === 0) {
    return { updated: 0, pendingJobs: 0 };
  }

  const jobIds = [...new Set(pending.map((p) => p.enrich_job_id as string))];
  let updated = 0;
  let pendingJobs = 0;

  for (const jobId of jobIds) {
    let statusResponse: Response;
    try {
      statusResponse = await fetch(`${LP_BASE}/job/${jobId}`, {
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      pendingJobs++;
      continue;
    }

    if (!statusResponse.ok) {
      // Job desconhecido/expirado: desmarca para não travar o botão pra sempre.
      await supabase
        .from("prospects")
        .update({ enrich_job_id: null })
        .eq("enrich_job_id", jobId);
      continue;
    }

    const status = (await statusResponse.json()) as { status?: string };
    if (status.status !== "completed") {
      pendingJobs++;
      continue;
    }

    const resultsResponse = await fetch(`${LP_BASE}/job/${jobId}/results`, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    }).catch(() => null);

    if (!resultsResponse?.ok) {
      pendingJobs++;
      continue;
    }

    const resultsJson = (await resultsResponse.json()) as {
      businesses?: LpEnrichedBusiness[];
    };

    const leadsOfJob = pending.filter((p) => p.enrich_job_id === jobId);
    for (const b of resultsJson.businesses ?? []) {
      const businessId = lpBusinessId(b);
      if (!businessId) continue;
      const lead = leadsOfJob.find((p) => p.google_place_id === businessId);
      if (!lead) continue;

      const bestPhone = b.mobile_number || b.phone || null;
      const normalized = bestPhone
        ? normalizeBrPhone(bestPhone)
        : { e164: null, isMobile: false };
      const isMobile = b.mobile_number
        ? true
        : b.phone_type === "mobile" || normalized.isMobile;

      // Só completa: um e-mail ou site que o enriquecimento não trouxe não
      // pode apagar o que a análise do site (ou alguém) já tinha preenchido.
      const patch: Record<string, unknown> = {
        enrich_job_id: null,
        updated_at: new Date().toISOString(),
      };
      if (b.email && !lead.email) patch.email = b.email;
      if (b.website && !lead.website) patch.website = b.website;
      if (normalized.e164 && (isMobile || !lead.phone_e164)) {
        patch.phone = b.phone ?? bestPhone;
        patch.phone_e164 = normalized.e164;
        patch.is_mobile = isMobile;
      }

      const { error: updateError } = await supabase
        .from("prospects")
        .update(patch)
        .eq("id", lead.id);

      if (!updateError) updated++;
    }

    // Limpa o job também em leads que não vieram nos resultados (falhas).
    await supabase
      .from("prospects")
      .update({ enrich_job_id: null })
      .eq("enrich_job_id", jobId);
  }

  revalidatePath("/prospeccao");
  return { updated, pendingJobs };
}

/* ------------------------------------------------------------------ */
/* Status, mensagem, CRM                                               */
/* ------------------------------------------------------------------ */

export async function updateProspectStatus(id: string, status: ProspectStatus) {
  const { supabase, user } = await requireAuthenticatedUser();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("prospects")
    .update({
      status,
      updated_at: now,
      ...(status === "respondeu" ? { replied_at: now } : {}),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  // A partir do primeiro contato de verdade, o lead já merece um lugar no
  // pipeline do CRM — não faz sentido esperar um clique manual em "Enviar ao
  // CRM". Best-effort: uma falha aqui não deve reverter a troca de status.
  if (status === "contatado" || status === "respondeu") {
    const { data: prospect } = await supabase
      .from("prospects")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (prospect && !prospect.contacted_at) {
      await supabase.from("prospects").update({ contacted_at: now }).eq("id", id);
    }
    if (prospect && !prospect.crm_client_id) {
      await promoteProspectToCrm(supabase, user.id, prospect as Prospect);
    }
  }

  revalidatePath("/prospeccao");
  return { success: true };
}

/** Descartar/reabrir vários leads de uma vez (seleção da tabela). */
export async function bulkUpdateProspectStatus(ids: string[], status: ProspectStatus) {
  const { supabase } = await requireAuthenticatedUser();
  if (ids.length === 0) return { updated: 0 };
  if (status !== "descartado" && status !== "novo") {
    return { error: "Em lote, só dá para descartar ou voltar para Novo." };
  }

  let updated = 0;
  for (const idsChunk of chunk(ids, ID_CHUNK)) {
    const { error, count } = await supabase
      .from("prospects")
      .update({ status, updated_at: new Date().toISOString() }, { count: "exact" })
      .in("id", idsChunk);
    if (error) return { error: error.message };
    updated += count ?? idsChunk.length;
  }

  revalidatePath("/prospeccao");
  return { updated };
}

export async function updateProspectMessage(id: string, message: string) {
  const { supabase } = await requireAuthenticatedUser();
  const { error } = await supabase
    .from("prospects")
    .update({ custom_message: message || null, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/prospeccao");
  return { success: true };
}

export async function deleteProspect(id: string) {
  const { supabase } = await requireAuthenticatedUser();
  const { error } = await supabase.from("prospects").delete().eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/prospeccao");
  return { success: true };
}

export async function personalizeMessage(id: string) {
  const { supabase } = await requireAuthenticatedUser();

  const apiKey = openAiKey();
  if (!apiKey) {
    return { error: "Configure OPENAI_API_KEY (ou NEXT_OPENAI_API_KEY) no ambiente." };
  }

  const { data: prospect, error: prospectError } = await supabase
    .from("prospects")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (prospectError) return { error: prospectError.message };
  if (!prospect) return { error: "Lead não encontrado." };

  const settings = await loadSettings(supabase);
  const baseMessage = renderProspectMessage(
    templateFor(settings, prospect as Prospect, "primeira"),
    prospect as Prospect,
  );
  const links = [...new Set(baseMessage.match(/https?:\/\/[^\s)]+/g) ?? [])];
  const segment = matchSegment(prospect);
  const diagnosis = siteDiagnosis(prospect as Prospect);
  const issues = diagnosis.length
    ? diagnosis
    : ((prospect.site_issues as string[] | null) ?? []);

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const prompt = `
Escreva uma mensagem curta e natural de prospecção via WhatsApp, em português do Brasil.

Contexto do lead:
- Nome do negócio: ${prospect.name}
- Nicho: ${prospect.niche}${prospect.category ? ` (categoria no Google: ${prospect.category})` : ""}
- Cidade: ${prospect.city}
- Site: ${
    !prospect.website
      ? "não tem site próprio"
      : prospect.site_status === "offline"
        ? `o site (${prospect.website}) está fora do ar`
        : `já tem site (${prospect.website})${issues.length ? ` com estes problemas: ${issues.join("; ")}` : ""}`
  }
${prospect.rating ? `- Avaliação no Google: ${prospect.rating} (${prospect.rating_count ?? 0} avaliações)` : ""}
${segment ? `- Projeto parecido que já fizemos: ${segment.cases[0]?.name} (${segment.angle})` : ""}

Use a mensagem abaixo como referência de tom e oferta (quem envia é uma agência que cria sites e sistemas):

---
${baseMessage}
---

Regras:
1) Máximo ~650 caracteres.
2) Sem markdown, sem emojis em excesso (no máximo 1), sem assinatura formal.
3) Personalize com um detalhe real do contexto (nicho, cidade, avaliação, problema do site ou ausência de site).
4) ${
    // O link só é pedido se o modelo tiver um. Se o texto de referência não
    // traz link nenhum, a IA não pode inventar um.
    links.length > 0
      ? `Inclua exatamente estes links, sem alterar: ${links.join(" ")}`
      : "Não inclua nenhum link."
  }
5) Termine com uma pergunta leve que convide resposta.
6) Retorne APENAS o texto da mensagem, nada mais.
`;

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    return { error: "A IA demorou demais para responder. Tente de novo." };
  }

  if (!response.ok) {
    const text = await response.text();
    return { error: `Falha na geração da mensagem (${response.status}): ${text}` };
  }

  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const message = json.choices?.[0]?.message?.content?.trim();

  if (!message) {
    return { error: "A IA não retornou uma mensagem. Tente novamente." };
  }

  const { error: saveError } = await supabase
    .from("prospects")
    .update({ custom_message: message, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (saveError) return { error: saveError.message };

  revalidatePath("/prospeccao");
  return { message };
}

// Compartilhado entre o botão manual "Enviar ao CRM", a promoção automática
// ao marcar um lead como contatado/respondeu e o envio pelo WhatsApp.
async function promoteProspectToCrm(
  supabase: Supabase,
  userId: string,
  prospect: Prospect,
): Promise<PromoteToCrmResult> {
  // O telefone do CRM é o mesmo número que recebe o WhatsApp — pode ser o
  // celular achado no site, não o fixo do Maps.
  const phone = prospect.phone_e164 ? formatBrPhone(prospect.phone_e164) : prospect.phone;

  // Mesmo número já no CRM (lead que chamou antes, ou cadastrado à mão):
  // vincula em vez de criar um cliente duplicado.
  let clientId: string | null = null;
  const targetKey = phone ? brPhoneMatchKey(phone) : null;
  if (targetKey) {
    const { data: clients } = await supabase
      .from("crm_clients")
      .select("id, phone")
      .not("phone", "is", null);
    clientId =
      (clients ?? []).find((client) => brPhoneMatchKey(client.phone) === targetKey)?.id ??
      null;
  }

  if (!clientId) {
    const { data: client, error: insertError } = await supabase
      .from("crm_clients")
      .insert({
        owner_id: userId,
        name: prospect.name,
        phone,
        email: prospect.email,
        source: "Prospecção",
        stage: "enviado",
      })
      .select("id")
      .single();

    if (insertError) return { error: insertError.message };
    clientId = client.id as string;
  }

  const { error: linkError } = await supabase
    .from("prospects")
    .update({ crm_client_id: clientId, updated_at: new Date().toISOString() })
    .eq("id", prospect.id);

  if (linkError) return { error: linkError.message };

  return { crmClientId: clientId };
}

export async function promoteToCrm(id: string): Promise<PromoteToCrmResult> {
  const { supabase, user } = await requireAuthenticatedUser();

  const { data: prospect, error: prospectError } = await supabase
    .from("prospects")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (prospectError) return { error: prospectError.message };
  if (!prospect) return { error: "Lead não encontrado." };
  if (prospect.crm_client_id) {
    return { error: "Este lead já foi enviado ao CRM." };
  }

  const result = await promoteProspectToCrm(supabase, user.id, prospect as Prospect);
  if ("error" in result) return result;

  revalidatePath("/crm");
  revalidatePath("/prospeccao");
  return result;
}

/**
 * Envia pelo WhatsApp (Evolution), coloca o lead no CRM e marca como
 * contatado. Usado no envio individual, no disparo em lote e no follow-up.
 *
 * `quiet` evita revalidar a página a cada envio do lote: a tela atualiza o
 * lead na hora e recarrega uma vez no fim.
 */
export async function sendProspectToConversas(
  id: string,
  message: string,
  { followup = false, quiet = false }: { followup?: boolean; quiet?: boolean } = {},
) {
  // O que veio da tela é o que sai — sem completar nada por fora.
  const trimmed = message.trim();
  if (!trimmed) return { error: "Escreva a mensagem antes de enviar." };

  const { supabase, user } = await requireAuthenticatedUser();

  const [settings, sentToday] = await Promise.all([
    loadSettings(supabase),
    countSentToday(supabase),
  ]);
  if (sentToday >= settings.dailyLimit) {
    return {
      error: `Limite de ${settings.dailyLimit} envios por dia atingido. Volte amanhã ou ajuste o limite em "Mensagens".`,
      limitReached: true as const,
    };
  }

  const { data: prospect, error: prospectError } = await supabase
    .from("prospects")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (prospectError) return { error: prospectError.message };
  if (!prospect) return { error: "Lead não encontrado." };
  if (!prospect.phone_e164) {
    return { error: "Este lead não tem um telefone válido para WhatsApp." };
  }
  if (prospect.has_whatsapp === false) {
    return { error: "A verificação indicou que este número não tem WhatsApp." };
  }

  if (!followup) {
    await supabase
      .from("prospects")
      .update({ custom_message: trimmed, updated_at: new Date().toISOString() })
      .eq("id", id);
  }

  let crmClientId = prospect.crm_client_id as string | null;
  if (!crmClientId) {
    const promoted = await promoteProspectToCrm(supabase, user.id, prospect as Prospect);
    if ("error" in promoted) {
      return { error: promoted.error ?? "Falha ao criar cliente no CRM." };
    }
    crmClientId = promoted.crmClientId;
  }

  // O JID que a verificação devolveu (às vezes sem o nono dígito) é o que a
  // resposta do lead vai usar — enviando para ele, tudo fica numa conversa.
  const remoteJid =
    (prospect.whatsapp_jid as string | null) ?? phoneToRemoteJid(prospect.phone_e164);

  await supabase.from("crm_whatsapp_chats").upsert(
    {
      remote_jid: remoteJid,
      client_id: crmClientId,
      instance: process.env.EVOLUTION_INSTANCE ?? null,
      push_name: prospect.name,
      // Nasceu de um disparo seu: é conversa de venda, não contato pessoal
      // que já existia no celular. A inbox usa isso para não afogar o
      // trabalho comercial no meio das outras conversas do número.
      origem: "prospeccao",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "remote_jid" },
  );

  // "Digitando..." proporcional ao tamanho, como uma pessoa escrevendo.
  const typingMs = Math.min(5000, Math.max(1500, trimmed.length * 20));
  const sendResult = await sendCrmWhatsappChatMessage(remoteJid, trimmed, { typingMs });
  if ("error" in sendResult && sendResult.error) {
    if (sendResult.error === "Este número não tem WhatsApp.") {
      await supabase
        .from("prospects")
        .update({ has_whatsapp: false, whatsapp_checked_at: new Date().toISOString() })
        .eq("id", id);
    }
    return { error: sendResult.error };
  }

  const now = new Date().toISOString();
  const keepsStatus = prospect.status === "contatado" || prospect.status === "respondeu";
  await supabase
    .from("prospects")
    .update({
      status: keepsStatus ? prospect.status : "contatado",
      crm_client_id: crmClientId,
      updated_at: now,
      ...(followup
        ? {
            followup_count: ((prospect.followup_count as number | null) ?? 0) + 1,
            last_followup_at: now,
          }
        : { contacted_at: prospect.contacted_at ?? now }),
    })
    .eq("id", id);

  if (!quiet) {
    revalidatePath("/prospeccao");
    revalidatePath("/crm");
  }

  return {
    success: true as const,
    remoteJid,
    crmClientId,
    sentToday: sentToday + 1,
    dailyLimit: settings.dailyLimit,
  };
}

/* ------------------------------------------------------------------ */
/* Importação de CSV                                                   */
/* ------------------------------------------------------------------ */

// Import de CSV sem gastar créditos de busca: export do LocalProspects, do
// Apify, do Outscraper ou planilha feita à mão — os nomes de coluna mais
// comuns de cada um são aceitos. Sem place_id real, o id de dedupe é
// derivado do nome + telefone (ou endereço/índice), com prefixo "csv:".
export async function importProspectsCsv(csvText: string, niche: string, city: string) {
  const { supabase, user } = await requireAuthenticatedUser();

  const trimmedNiche = niche.trim();
  const trimmedCity = city.trim();
  if (!trimmedNiche || !trimmedCity) {
    return { error: "Informe o nicho e a cidade do arquivo." };
  }

  const parsedRows = parseCsv(csvText);
  if (parsedRows.length === 0) {
    return { error: "Não encontrei linhas válidas nesse CSV." };
  }

  const rows = parsedRows
    .map((r, index) => {
      const name = pickColumn(r, ["business_name", "name", "title", "nome", "empresa"]);
      if (!name) return null;

      const rawPhone = pickColumn(r, [
        "phone",
        "telefone",
        "phoneUnformatted",
        "phone_number",
        "celular",
        "whatsapp",
      ]);
      const { e164, isMobile } = rawPhone
        ? normalizeBrPhone(rawPhone)
        : { e164: null, isMobile: false };
      const email = pickColumn(r, ["email", "e-mail", "emails", "emails/0", "email_1"]);
      const address = pickColumn(r, ["address", "endereco", "endereço", "full_address"]);
      const website =
        pickColumn(r, ["website", "site", "site_url", "domain"]) ??
        inferWebsiteFromRow({ logo_url: r.logo_url, email: email ?? undefined });
      const placeId = pickColumn(r, ["place_id", "placeId", "google_place_id", "cid"]);
      const phoneDigits = rawPhone ? rawPhone.replace(/\D/g, "") : "";
      const idBase = phoneDigits || slugify(address || "") || String(index);
      const rating = Number(pickColumn(r, ["rating", "totalScore", "nota"])?.replace(",", "."));
      const reviews = Number(pickColumn(r, ["reviews", "reviewsCount", "avaliacoes", "avaliações"]));

      return {
        owner_id: user.id,
        google_place_id: placeId ?? `csv:${slugify(name)}-${idBase}`,
        name,
        phone: rawPhone,
        phone_e164: e164,
        is_mobile: isMobile,
        website,
        address,
        rating: Number.isFinite(rating) && rating > 0 ? rating : null,
        rating_count: Number.isFinite(reviews) && reviews > 0 ? reviews : null,
        google_maps_uri: pickColumn(r, ["url", "google_maps_url", "gbp_url", "maps_url"]),
        category: pickColumn(r, ["category", "categoryName", "categoria", "type"]),
        instagram: pickColumn(r, ["instagram", "instagrams", "instagrams/0"]),
        // O CSV do robô traz nicho e cidade por linha (várias buscas num
        // arquivo só); o que foi preenchido na tela vale para o resto.
        niche: pickColumn(r, ["nicho", "niche"]) ?? trimmedNiche,
        city: pickColumn(r, ["cidade", "city"]) ?? trimmedCity,
        email,
        source: "csv",
        enrich_job_id: null,
        updated_at: new Date().toISOString(),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) {
    return { error: "Nenhuma linha com nome de negócio válida encontrada." };
  }

  // O upsert falha se o mesmo google_place_id aparecer 2x no mesmo lote
  // ("ON CONFLICT DO UPDATE command cannot affect row a second time") — o
  // CSV real tem negócios duplicados (mesmo telefone, endereços diferentes).
  const dedupedRows = [...new Map(rows.map((r) => [r.google_place_id, r])).values()];

  const existingIds = new Set<string>();
  for (const ids of chunk(dedupedRows.map((r) => r.google_place_id), ID_CHUNK)) {
    const { data: existing } = await supabase
      .from("prospects")
      .select("google_place_id")
      .in("google_place_id", ids);
    for (const row of existing ?? []) existingIds.add(row.google_place_id);
  }

  // Quem já está na base (de qualquer pessoa do workspace) fica como está.
  const newRows = dedupedRows.filter((r) => !existingIds.has(r.google_place_id));
  const noSite = newRows.filter((r) => !r.website).length;
  const newIds: string[] = [];

  for (const batch of chunk(newRows, 200)) {
    const { data, error } = await supabase
      .from("prospects")
      .upsert(batch, { onConflict: "owner_id,google_place_id", ignoreDuplicates: true })
      .select("id");
    if (error) return { error: error.message };
    newIds.push(...(data ?? []).map((row) => row.id as string));
  }

  revalidatePath("/prospeccao");
  return { imported: newIds.length, total: dedupedRows.length, noSite, newIds };
}
