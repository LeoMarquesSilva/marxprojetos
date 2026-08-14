"use server";

import { revalidatePath } from "next/cache";
import { fillTemplate, normalizeBrPhone, phoneToRemoteJid } from "@/lib/phone";
import { inferWebsiteFromRow, parseCsv, slugify } from "@/lib/csv";
import { requireAuthenticatedUser } from "@/lib/supabase/require-authenticated-user";
import { sendCrmWhatsappMessage } from "@/app/actions/crm-whatsapp";
import { checkWhatsAppNumbers } from "@/lib/evolution";
import {
  DEFAULT_PROSPECTING_TEMPLATE,
  INSYT_STUDIO_URL,
  type Prospect,
  type ProspectStatus,
} from "@/types/prospecting";

type AuthenticatedContext = Awaited<ReturnType<typeof requireAuthenticatedUser>>;
type PromoteToCrmResult =
  | { crmClientId: string; error?: never }
  | { error: string; crmClientId?: never };

function portfolioUrlForTemplate() {
  return INSYT_STUDIO_URL;
}

export async function getProspects() {
  const { supabase } = await requireAuthenticatedUser();
  const { data, error } = await supabase
    .from("prospects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data as Prospect[];
}

export async function getProspectingTemplate() {
  const { supabase } = await requireAuthenticatedUser();
  return loadProspectingTemplate(supabase);
}

async function loadProspectingTemplate(
  supabase: AuthenticatedContext["supabase"],
) {
  const { data, error } = await supabase
    .from("prospecting_settings")
    .select("template")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  // Devolve o que está salvo, sem tocar em nada. Antes, um modelo sem o link
  // do portfólio era reescrito com a linha do estúdio colada no fim — e
  // gravado por cima no banco. Quem editava o modelo para tirar o link via a
  // própria edição desfeita no próximo carregamento.
  return data?.template?.trim() || DEFAULT_PROSPECTING_TEMPLATE;
}

export async function saveProspectingTemplate(template: string) {
  const { supabase, user } = await requireAuthenticatedUser();

  const { error } = await supabase.from("prospecting_settings").upsert(
    {
      owner_id: user.id,
      template,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id" },
  );

  if (error) return { error: error.message };
  revalidatePath("/prospeccao");
  return { success: true };
}

const LP_BASE = "https://localprospects.ai/api/v1";

type LpBusiness = {
  id?: string;
  place_id?: string;
  cid?: string;
  name?: string;
  phone?: string;
  website?: string;
  address?: string;
  rating?: number;
  reviews?: number;
  gbp_url?: string;
};

type LpEnrichedBusiness = LpBusiness & {
  email?: string | null;
  phone_type?: string | null;
  mobile_number?: string | null;
  contact?: { address?: string | null };
  reputation?: { rating?: number | null; reviews?: number | null };
};

function lpKey() {
  return process.env.LOCALPROSPECTS_API_KEY;
}

function lpBusinessId(b: LpBusiness) {
  return b.place_id || b.cid || b.id || null;
}

export async function searchPlaces(niche: string, city: string, state?: string) {
  const { supabase, user } = await requireAuthenticatedUser();

  const trimmedNiche = niche.trim();
  const trimmedCity = city.trim();
  if (!trimmedNiche || !trimmedCity) {
    return { error: "Informe o nicho e a cidade." };
  }

  const apiKey = lpKey();
  if (!apiKey) {
    return {
      error:
        "Configure LOCALPROSPECTS_API_KEY no ambiente (.env local e variáveis do Vercel).",
    };
  }

  // 1) Resolve a cidade para um location_code (não consome créditos).
  // O estado desambigua cidades homônimas (ex: 15 "Bom Jesus" pelo país).
  const locQuery = state ? `${trimmedCity}, ${state.trim()}` : trimmedCity;
  const locResponse = await fetch(
    `${LP_BASE}/locations?q=${encodeURIComponent(locQuery)}`,
    { headers: { "x-api-key": apiKey } },
  );

  if (!locResponse.ok) {
    const text = await locResponse.text();
    return { error: `Falha ao buscar a cidade (${locResponse.status}): ${text}` };
  }

  const locJson = (await locResponse.json()) as {
    locations?: { location_code: number; full_name: string; country?: string }[];
  };
  const location =
    locJson.locations?.find((l) => l.country === "BR") ?? locJson.locations?.[0];
  if (!location) {
    return { error: `Cidade "${trimmedCity}" não encontrada. Tente outro nome.` };
  }

  // 2) Busca os negócios (retorna listagem bruta + job de enriquecimento).
  const searchResponse = await fetch(`${LP_BASE}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      keyword: trimmedNiche,
      location_code: location.location_code,
    }),
  });

  if (!searchResponse.ok) {
    const text = await searchResponse.text();
    return { error: `Falha na busca (${searchResponse.status}): ${text}` };
  }

  const searchJson = (await searchResponse.json()) as {
    job_id?: string;
    businesses?: LpBusiness[];
  };

  const businesses = searchJson.businesses ?? [];
  if (businesses.length === 0) {
    return { imported: 0, total: 0 };
  }

  // status e custom_message ficam de fora de propósito: no upsert em conflito,
  // colunas omitidas são preservadas — não podem ser sobrescritas por re-busca.
  const rows = businesses
    .filter((b) => lpBusinessId(b) && b.name)
    .map((b) => {
      const rawPhone = b.phone || null;
      const { e164, isMobile } = rawPhone
        ? normalizeBrPhone(rawPhone)
        : { e164: null, isMobile: false };

      return {
        owner_id: user.id,
        google_place_id: lpBusinessId(b)!,
        name: b.name!,
        phone: rawPhone,
        phone_e164: e164,
        is_mobile: isMobile,
        website: b.website ?? null,
        address: b.address ?? null,
        rating: b.rating ?? null,
        rating_count: b.reviews ?? null,
        google_maps_uri: b.gbp_url ?? null,
        niche: trimmedNiche,
        city: trimmedCity,
        enrich_job_id: searchJson.job_id ?? null,
        updated_at: new Date().toISOString(),
      };
    });

  const { data: existing } = await supabase
    .from("prospects")
    .select("google_place_id")
    .in(
      "google_place_id",
      rows.map((r) => r.google_place_id),
    );

  const existingIds = new Set((existing ?? []).map((e) => e.google_place_id));
  const imported = rows.filter((r) => !existingIds.has(r.google_place_id)).length;

  const { error } = await supabase
    .from("prospects")
    .upsert(rows, { onConflict: "owner_id,google_place_id" });

  if (error) return { error: error.message };

  revalidatePath("/prospeccao");
  return { imported, total: rows.length };
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
 * não pagar de novo pela base inteira. `todos` refaz tudo.
 */
export async function checkProspectsWhatsapp({ todos = false } = {}) {
  const { supabase } = await requireAuthenticatedUser();

  let query = supabase
    .from("prospects")
    .select("id, phone_e164")
    .not("phone_e164", "is", null);

  if (!todos) query = query.is("whatsapp_checked_at", null);

  const { data: leads, error } = await query;
  if (error) return { error: error.message };
  if (!leads || leads.length === 0) {
    return { verificados: 0, comWhatsapp: 0, semWhatsapp: 0 };
  }

  let existencia: Map<string, boolean>;
  try {
    existencia = await checkWhatsAppNumbers(
      // Números repetidos entre leads viram uma pergunta só.
      [...new Set(leads.map((lead) => lead.phone_e164 as string))],
    );
  } catch (checkError) {
    console.error("[prospecção] falha ao verificar números:", checkError);
    return {
      error:
        "Não consegui consultar o WhatsApp agora. Verifique a conexão da instância e tente de novo.",
    };
  }

  const agora = new Date().toISOString();
  let comWhatsapp = 0;
  let semWhatsapp = 0;
  const erros: string[] = [];

  for (const lead of leads) {
    const tem = existencia.get(lead.phone_e164 as string);
    // Número que a Evolution não respondeu fica sem veredito em vez de
    // virar "não tem" — marcar errado esconderia um lead bom.
    if (tem === undefined) continue;

    const { error: updateError } = await supabase
      .from("prospects")
      .update({
        has_whatsapp: tem,
        whatsapp_checked_at: agora,
        updated_at: agora,
      })
      .eq("id", lead.id);

    if (updateError) {
      erros.push(updateError.message);
      continue;
    }

    if (tem) comWhatsapp += 1;
    else semWhatsapp += 1;
  }

  revalidatePath("/prospeccao");
  return {
    verificados: comWhatsapp + semWhatsapp,
    comWhatsapp,
    semWhatsapp,
    naoSalvos: erros.length,
  };
}

// Aplica o enriquecimento assíncrono do LocalProspects (email, tipo de
// telefone, celular) aos leads cujo job já terminou. enrich_job_id = null
// marca o lead como "enriquecimento aplicado".
export async function refreshEnrichment() {
  const { supabase } = await requireAuthenticatedUser();

  const apiKey = lpKey();
  if (!apiKey) {
    return {
      error:
        "Configure LOCALPROSPECTS_API_KEY no ambiente (.env local e variáveis do Vercel).",
    };
  }

  const { data: pending, error: pendingError } = await supabase
    .from("prospects")
    .select("id, google_place_id, enrich_job_id")
    .not("enrich_job_id", "is", null);

  if (pendingError) return { error: pendingError.message };
  if (!pending || pending.length === 0) {
    return { updated: 0, pendingJobs: 0 };
  }

  const jobIds = [...new Set(pending.map((p) => p.enrich_job_id as string))];
  let updated = 0;
  let pendingJobs = 0;

  for (const jobId of jobIds) {
    const statusResponse = await fetch(`${LP_BASE}/job/${jobId}`, {
      headers: { "x-api-key": apiKey },
    });

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
    });

    if (!resultsResponse.ok) {
      pendingJobs++;
      continue;
    }

    const resultsJson = (await resultsResponse.json()) as {
      businesses?: LpEnrichedBusiness[];
    };

    for (const b of resultsJson.businesses ?? []) {
      const businessId = lpBusinessId(b);
      if (!businessId) continue;

      const bestPhone = b.mobile_number || b.phone || null;
      const normalized = bestPhone
        ? normalizeBrPhone(bestPhone)
        : { e164: null, isMobile: false };
      const isMobile = b.mobile_number
        ? true
        : b.phone_type === "mobile" || normalized.isMobile;

      const { error: updateError } = await supabase
        .from("prospects")
        .update({
          email: b.email ?? null,
          phone: b.phone ?? bestPhone,
          phone_e164: normalized.e164,
          is_mobile: isMobile,
          website: b.website ?? null,
          enrich_job_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("google_place_id", businessId);

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

export async function updateProspectStatus(id: string, status: ProspectStatus) {
  const { supabase, user } = await requireAuthenticatedUser();
  const { error } = await supabase
    .from("prospects")
    .update({ status, updated_at: new Date().toISOString() })
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

    if (prospect && !prospect.crm_client_id) {
      await promoteProspectToCrm(supabase, user.id, prospect as Prospect);
    }
  }

  revalidatePath("/prospeccao");
  return { success: true };
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

  const apiKey =
    process.env.OPENAI_API_KEY ||
    process.env.NEXT_OPENAI_API_KEY ||
    process.env.OPENAI_KEY;

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

  const template = await loadProspectingTemplate(supabase);
  const portfolioUrl = portfolioUrlForTemplate();
  const baseMessage = fillTemplate(template, {
    nome: prospect.name,
    cidade: prospect.city,
    hasSite: Boolean(prospect.website),
    portfolioUrl,
  });

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const prompt = `
Escreva uma mensagem curta e natural de prospecção via WhatsApp, em português do Brasil.

Contexto do lead:
- Nome do negócio: ${prospect.name}
- Nicho: ${prospect.niche}
- Cidade: ${prospect.city}
- Site: ${prospect.website ? `já tem site (${prospect.website})` : "não tem site próprio"}
${prospect.rating ? `- Avaliação no Google: ${prospect.rating} (${prospect.rating_count ?? 0} avaliações)` : ""}

Use a mensagem abaixo como referência de tom e oferta (quem envia é uma agência que cria sites e sistemas):

---
${baseMessage}
---

Regras:
1) Máximo ~650 caracteres.
2) Sem markdown, sem emojis em excesso (no máximo 1), sem assinatura formal.
3) Personalize com um detalhe real do contexto (nicho, cidade, avaliação ou ausência de site).
4) ${
    // O link só é pedido se o modelo tiver um. Se o texto de referência não
    // traz link nenhum, a IA não pode inventar um.
    baseMessage.includes(portfolioUrl)
      ? `Inclua o link do portfólio exatamente assim: ${portfolioUrl}`
      : "Não inclua nenhum link que não esteja na mensagem de referência."
  }
5) Termine com uma pergunta leve que convide resposta.
6) Retorne APENAS o texto da mensagem, nada mais.
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
  });

  if (!response.ok) {
    const text = await response.text();
    return { error: `Falha na geração da mensagem (${response.status}): ${text}` };
  }

  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const rawMessage = json.choices?.[0]?.message?.content?.trim();

  if (!rawMessage) {
    return { error: "A IA não retornou uma mensagem. Tente novamente." };
  }

  const message = rawMessage;

  const { error: saveError } = await supabase
    .from("prospects")
    .update({ custom_message: message, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (saveError) return { error: saveError.message };

  revalidatePath("/prospeccao");
  return { message };
}

// Compartilhado entre o botão manual "Enviar ao CRM" e a promoção automática
// ao marcar um lead como contatado/respondeu.
async function promoteProspectToCrm(
  supabase: AuthenticatedContext["supabase"],
  userId: string,
  prospect: Prospect,
) {
  const { data: client, error: insertError } = await supabase
    .from("crm_clients")
    .insert({
      owner_id: userId,
      name: prospect.name,
      phone: prospect.phone,
      email: prospect.email,
      source: "Prospecção",
      stage: "enviado",
    })
    .select("id")
    .single();

  if (insertError) return { error: insertError.message };

  const { error: linkError } = await supabase
    .from("prospects")
    .update({ crm_client_id: client.id, updated_at: new Date().toISOString() })
    .eq("id", prospect.id);

  if (linkError) return { error: linkError.message };

  return { crmClientId: client.id as string };
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

// Envia a mensagem pelo WhatsApp (Evolution), coloca o lead no CRM, marca
// como contatado e devolve o JID para abrir a inbox de Conversas.
export async function sendProspectToConversas(id: string, message: string) {
  // O que veio da tela é o que sai — sem completar nada por fora.
  const trimmed = message.trim();
  if (!trimmed) return { error: "Escreva a mensagem antes de enviar." };

  const { supabase, user } = await requireAuthenticatedUser();

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

  await supabase
    .from("prospects")
    .update({
      custom_message: trimmed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  let crmClientId = prospect.crm_client_id as string | null;
  if (!crmClientId) {
    const promoted = await promoteProspectToCrm(
      supabase,
      user.id,
      prospect as Prospect,
    );
    if ("error" in promoted) {
      return { error: promoted.error ?? "Falha ao criar cliente no CRM." };
    }
    crmClientId = promoted.crmClientId;
  }

  if (!crmClientId) {
    return { error: "Não foi possível criar o cliente no CRM." };
  }

  const remoteJid = phoneToRemoteJid(prospect.phone_e164);

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

  const sendResult = await sendCrmWhatsappMessage(crmClientId, trimmed);
  if ("error" in sendResult && sendResult.error) {
    return { error: sendResult.error };
  }

  await supabase
    .from("prospects")
    .update({
      status: "contatado",
      crm_client_id: crmClientId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath("/prospeccao");
  revalidatePath("/crm");

  return {
    success: true as const,
    remoteJid,
    crmClientId,
  };
}

// Import de CSV (ex: export do dashboard do LocalProspects) sem gastar
// créditos da API de busca. Sem place_id real, o id de dedupe é derivado do
// nome + telefone (ou endereço/índice como fallback) — estável entre imports
// do mesmo arquivo, mas específico dessa origem (por isso o prefixo "csv:").
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
      const name = r.business_name || r.name || "";
      if (!name) return null;

      const rawPhone = r.phone || null;
      const { e164, isMobile } = rawPhone
        ? normalizeBrPhone(rawPhone)
        : { e164: null, isMobile: false };
      const website = inferWebsiteFromRow(r);
      const phoneDigits = rawPhone ? rawPhone.replace(/\D/g, "") : "";
      const idBase = phoneDigits || slugify(r.address || "") || String(index);

      return {
        owner_id: user.id,
        google_place_id: `csv:${slugify(name)}-${idBase}`,
        name,
        phone: rawPhone,
        phone_e164: e164,
        is_mobile: isMobile,
        website,
        address: r.address || null,
        rating: null,
        rating_count: null,
        google_maps_uri: null,
        niche: trimmedNiche,
        city: trimmedCity,
        email: r.email || null,
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

  const { data: existing } = await supabase
    .from("prospects")
    .select("google_place_id")
    .in(
      "google_place_id",
      dedupedRows.map((r) => r.google_place_id),
    );

  const existingIds = new Set((existing ?? []).map((e) => e.google_place_id));
  const imported = dedupedRows.filter((r) => !existingIds.has(r.google_place_id)).length;
  const noSite = dedupedRows.filter((r) => !r.website).length;

  const { error } = await supabase
    .from("prospects")
    .upsert(dedupedRows, { onConflict: "owner_id,google_place_id" });

  if (error) return { error: error.message };

  revalidatePath("/prospeccao");
  return { imported, total: dedupedRows.length, noSite };
}
