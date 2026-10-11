// Robô próprio do Google Maps — roda no seu computador, sem API.
//
// Modo fila (padrão): fica ligado, pega as buscas que você pede na tela de
// Prospecção, abre o Maps num Chromium sem janela, lê as empresas, grava os
// leads, analisa os sites e verifica o WhatsApp.
//
//   npm run maps:robo
//
// Modo avulso: uma busca direto do terminal, com saída em CSV (e, com
// --salvar, gravando na base em nome do --dono).
//
//   npm run maps:robo -- --buscar "advogado criminalista" --cidade Campinas --uf SP
//   npm run maps:robo -- --buscar "clínica geriátrica" --cidade Campinas --uf SP --modo varredura --csv leads.csv
//
// Opções: --modo padrao|ampla|varredura · --max 120 · --csv arquivo.csv ·
// --salvar --dono email · --sem-sites · --janela (mostra o navegador)
//
// Importar um CSV gerado antes (grava, analisa sites e verifica WhatsApp):
//
//   npm run maps:robo -- --importar leads/arquivo.csv [--dono email]
//
// Verificar o WhatsApp de quem ainda não foi verificado:
//
//   npm run maps:robo -- --verificar

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { runMapsSearch, MapsBlockedError, MapsCancelledError } from "@/lib/prospecting/maps-scraper";
import {
  saveFoundLeads,
  scanAndSaveSites,
  verifyAndSaveWhatsapp,
  mapWithConcurrency,
} from "@/lib/prospecting/store";
import { scanWebsite } from "@/lib/prospecting/site-scan";
import { matchSegment, searchTermsFor } from "@/lib/prospecting/segments";
import { normalizeBrPhone } from "@/lib/phone";
import { parseCsv, pickColumn } from "@/lib/csv";
import { BR_STATES } from "@/lib/br-states";

const VERSION = "1";
const POLL_MS = 5000;
const HEARTBEAT_MS = 15000;
// Busca "rodando" há mais que isso é de um robô que caiu no meio.
const STALE_JOB_MS = 30 * 60 * 1000;

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

function log(...parts) {
  const time = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });
  console.log(`[${time}]`, ...parts);
}

function stateName(uf) {
  if (!uf) return null;
  return BR_STATES.find((state) => state.uf === uf.toUpperCase())?.name ?? uf;
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.");
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// A verificação de WhatsApp usa a Evolution. O client dela é "server-only"
// (só carrega com --conditions=react-server, que o npm script passa).
async function whatsappChecker() {
  if (!process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_API_KEY || !process.env.EVOLUTION_INSTANCE) {
    return null;
  }
  try {
    const { checkWhatsAppNumbers } = await import("@/lib/evolution");
    return checkWhatsAppNumbers;
  } catch (error) {
    log("WhatsApp: não deu para carregar o client da Evolution —", error.message);
    return null;
  }
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[;"\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/* ------------------------------------------------------------------ */
/* Modo avulso                                                         */
/* ------------------------------------------------------------------ */

async function runOnce(args) {
  // --buscar pode vir várias vezes: um nicho por busca, tudo num CSV só.
  const niches = args.buscar.map((niche) => niche.trim()).filter(Boolean);
  const city = (args.cidade ?? "").trim();
  if (!city) throw new Error("Informe --cidade.");
  const mode = ["ampla", "varredura"].includes(args.modo) ? args.modo : "padrao";
  const state = stateName(args.uf);

  // Mesmo lugar achado por dois nichos fica com o primeiro.
  const found = new Map();
  for (const [index, niche] of niches.entries()) {
    const terms = searchTermsFor(niche, mode);
    log(`(${index + 1}/${niches.length}) Buscando ${terms.map((t) => `"${t}"`).join(", ")} em ${city}${state ? `, ${state}` : ""} (${mode})…`);
    const { leads } = await runMapsSearch({
      terms,
      city,
      state,
      mode,
      maxPerSearch: Number(args.max) || 120,
      headless: !args.janela,
      onProgress: (message) => log(message),
    });
    let added = 0;
    for (const lead of leads) {
      if (lead.closed || found.has(lead.placeId)) continue;
      found.set(lead.placeId, { niche, lead });
      added += 1;
    }
    log(`"${niche}": ${leads.length} encontrada(s), ${added} nova(s) nesta rodada.`);
    if (index < niches.length - 1) await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  const results = [...found.values()];
  log(`${results.length} empresa(s) aberta(s) no total.`);

  if (args.salvar) {
    const supabase = adminClient();
    const ownerId = await resolveOwner(supabase, args.dono);
    for (const niche of niches) {
      const leads = results.filter((item) => item.niche === niche).map((item) => item.lead);
      const saved = await saveFoundLeads(supabase, { ownerId, leads, niche, city, source: "maps" });
      if ("error" in saved) throw new Error(saved.error);
      log(`Gravado "${niche}": ${saved.newIds.length} novo(s), ${saved.updated} atualizado(s).`);
      await enrichSaved(supabase, saved.newIds, { sites: !args["sem-sites"] });
    }
  }

  if (args.csv || !args.salvar) {
    const scans = new Map();
    if (!args["sem-sites"]) {
      const withSite = results.filter((item) => item.lead.website);
      let done = 0;
      await mapWithConcurrency(withSite, 6, async ({ lead }) => {
        scans.set(lead.placeId, await scanWebsite(lead.website));
        done += 1;
        if (done % 20 === 0 || done === withSite.length) log(`Sites analisados: ${done}/${withSite.length}`);
      });
    }

    const header = [
      "nicho", "cidade", "name", "category", "phone", "whatsapp", "website", "situacao_site",
      "problemas_site", "email", "instagram", "address", "rating", "reviews", "segmento",
      "place_id", "url",
    ];
    const lines = results.map(({ niche, lead }) => {
      const scan = scans.get(lead.placeId);
      const sitePhone = scan?.whatsapp ?? null;
      const mapsPhone = lead.phone ? normalizeBrPhone(lead.phone) : { e164: null, isMobile: false };
      return [
        niche,
        city,
        lead.name,
        lead.category,
        lead.phone,
        mapsPhone.isMobile ? mapsPhone.e164 : (sitePhone ?? mapsPhone.e164),
        lead.website,
        lead.website ? (scan?.status ?? "") : "sem site",
        (scan?.issues ?? []).join(" | "),
        lead.email ?? scan?.emails?.[0] ?? "",
        lead.instagram ?? scan?.instagram ?? "",
        lead.address,
        lead.rating,
        lead.ratingCount,
        matchSegment({ niche, name: lead.name, category: lead.category })?.label ?? "",
        lead.placeId,
        lead.mapsUri,
      ].map(csvCell).join(";");
    });
    const file =
      args.csv ??
      `leads-${city.replace(/\W+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`.toLowerCase();
    writeFileSync(file, `﻿${[header.join(";"), ...lines].join("\n")}`);
    log(`CSV salvo em ${file} (importe pela tela de Prospecção).`);
  }
}

// Grava na base um CSV gerado pelo modo avulso (sem buscar de novo no
// Maps): agrupa por nicho/cidade, salva, analisa os sites e verifica o
// WhatsApp dos novos.
async function importCsv(args) {
  const rows = parseCsv(readFileSync(args.importar, "utf8"));
  const supabase = adminClient();
  const ownerId = await resolveOwner(supabase, args.dono);

  const groups = new Map();
  for (const row of rows) {
    const placeId = pickColumn(row, ["place_id", "placeId"]);
    const name = pickColumn(row, ["name", "title", "nome"]);
    if (!placeId || !name) continue;
    const niche = pickColumn(row, ["nicho", "niche"]) ?? args.buscar?.[0] ?? "importado";
    const city = pickColumn(row, ["cidade", "city"]) ?? args.cidade ?? "";
    const key = `${niche}|${city}`;
    if (!groups.has(key)) groups.set(key, { niche, city, leads: [] });
    const rating = Number(pickColumn(row, ["rating"])?.replace(",", "."));
    const reviews = Number(pickColumn(row, ["reviews"]));
    groups.get(key).leads.push({
      placeId,
      name,
      phone: pickColumn(row, ["phone", "telefone"]),
      website: pickColumn(row, ["website", "site"]),
      address: pickColumn(row, ["address", "endereco"]),
      rating: Number.isFinite(rating) && rating > 0 ? rating : null,
      ratingCount: Number.isFinite(reviews) && reviews > 0 ? reviews : null,
      mapsUri: pickColumn(row, ["url", "google_maps_url"]),
      category: pickColumn(row, ["category", "categoria"]),
      closed: false,
      email: pickColumn(row, ["email"]),
      instagram: pickColumn(row, ["instagram"]),
      facebook: null,
      linkedin: null,
    });
  }

  const allNew = [];
  for (const { niche, city, leads } of groups.values()) {
    const saved = await saveFoundLeads(supabase, { ownerId, leads, niche, city, source: "maps" });
    if ("error" in saved) throw new Error(saved.error);
    log(`"${niche}" (${city}): ${saved.newIds.length} novo(s), ${saved.updated} atualizado(s).`);
    allNew.push(...saved.newIds);
  }
  log(`Importado: ${allNew.length} lead(s) novo(s). Analisando sites e WhatsApp…`);
  await enrichSaved(supabase, allNew, { sites: !args["sem-sites"] });
}

// Verifica o WhatsApp dos leads do robô ainda não verificados (só consulta
// a existência do número; nenhuma mensagem é enviada).
async function verifyPending() {
  const checker = await whatsappChecker();
  if (!checker) throw new Error("Evolution não configurada no .env.");
  const supabase = adminClient();
  const { data, error } = await supabase
    .from("prospects")
    .select("id")
    .eq("source", "maps")
    .is("whatsapp_checked_at", null)
    .not("phone_e164", "is", null)
    .limit(2000);
  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((row) => row.id);
  if (ids.length === 0) {
    log("Nenhum lead do robô esperando verificação.");
    return;
  }
  log(`Verificando ${ids.length} número(s)…`);
  const result = await verifyAndSaveWhatsapp(supabase, { ids }, checker);
  if ("error" in result) throw new Error(result.error);
  log(`WhatsApp: ${result.verificados} verificado(s) — ${result.comWhatsapp} com, ${result.semWhatsapp} sem.`);
}

async function resolveOwner(supabase, email) {
  if (email) {
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error(error.message);
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
    if (!user) throw new Error(`Usuário ${email} não encontrado.`);
    return user.id;
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error("Informe --dono email (não achei um admin).");
  return data.id;
}

/* ------------------------------------------------------------------ */
/* Modo fila                                                           */
/* ------------------------------------------------------------------ */

async function enrichSaved(supabase, newIds, { sites = true } = {}) {
  if (newIds.length === 0) return;
  if (sites) {
    let scanned = 0;
    for (let start = 0; start < newIds.length; start += 150) {
      const ids = newIds.slice(start, start + 150);
      for (let guard = 0; guard < 30; guard += 1) {
        const result = await scanAndSaveSites(supabase, { ids, limit: 15 });
        if ("error" in result) {
          log("Sites:", result.error);
          break;
        }
        scanned += result.scanned;
        if (result.remaining === 0 || result.scanned === 0) break;
      }
    }
    log(`Sites analisados: ${scanned}.`);
  }

  const checker = await whatsappChecker();
  if (checker) {
    try {
      const result = await verifyAndSaveWhatsapp(supabase, { ids: newIds }, checker);
      if ("error" in result) log("WhatsApp:", result.error);
      else log(`WhatsApp: ${result.comWhatsapp} com, ${result.semWhatsapp} sem.`);
    } catch (error) {
      log("WhatsApp: verificação falhou —", error.message);
    }
  }
}

async function processJob(supabase, job) {
  let lastProgressAt = 0;
  const setProgress = async (progress, force = false) => {
    log(progress);
    if (!force && Date.now() - lastProgressAt < 3000) return;
    lastProgressAt = Date.now();
    await supabase.from("prospect_search_jobs").update({ progress }).eq("id", job.id);
  };
  const isCancelled = async () => {
    const { data } = await supabase
      .from("prospect_search_jobs")
      .select("status")
      .eq("id", job.id)
      .maybeSingle();
    return data?.status === "cancelado";
  };

  try {
    const { leads } = await runMapsSearch({
      terms: job.terms?.length ? job.terms : [job.niche],
      city: job.city,
      state: job.state,
      mode: job.mode,
      maxPerSearch: job.max_results,
      onProgress: (message) => void setProgress(message),
      shouldStop: isCancelled,
    });

    await setProgress(`Gravando ${leads.length} empresa(s)…`, true);
    const saved = await saveFoundLeads(supabase, {
      ownerId: job.owner_id,
      leads,
      niche: job.niche,
      city: job.city,
      source: "maps",
    });
    if ("error" in saved) throw new Error(saved.error);

    await supabase
      .from("prospect_search_jobs")
      .update({
        found: saved.total,
        imported: saved.newIds.length,
        updated: saved.updated,
        new_ids: saved.newIds,
      })
      .eq("id", job.id);

    await setProgress(`Analisando sites e WhatsApp de ${saved.newIds.length} lead(s) novo(s)…`, true);
    await enrichSaved(supabase, saved.newIds);

    await supabase
      .from("prospect_search_jobs")
      .update({
        status: "concluido",
        progress: null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("status", "rodando");
    log(`✔ ${job.niche} · ${job.city}: ${saved.newIds.length} novo(s), ${saved.updated} atualizado(s).`);
  } catch (error) {
    const cancelled = error instanceof MapsCancelledError;
    const message =
      error instanceof MapsBlockedError || cancelled
        ? error.message
        : `Falha no robô: ${error?.message ?? error}`;
    log(cancelled ? "Busca cancelada." : `✖ ${message}`);
    await supabase
      .from("prospect_search_jobs")
      .update({
        status: cancelled ? "cancelado" : "erro",
        error: cancelled ? null : message,
        progress: null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    // Bloqueio do Google: melhor não insistir com a próxima da fila agora.
    if (error instanceof MapsBlockedError) {
      log("Google pediu verificação. Pausando o robô por 30 minutos.");
      await new Promise((resolve) => setTimeout(resolve, 30 * 60 * 1000));
    }
  }
}

async function claimNextJob(supabase, worker) {
  const { data: pending } = await supabase
    .from("prospect_search_jobs")
    .select("id")
    .eq("status", "pendente")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!pending) return null;

  // Só um robô pega cada pedido: o update exige que ainda esteja pendente.
  const { data: claimed } = await supabase
    .from("prospect_search_jobs")
    .update({
      status: "rodando",
      worker,
      started_at: new Date().toISOString(),
      progress: "Abrindo o Google Maps…",
    })
    .eq("id", pending.id)
    .eq("status", "pendente")
    .select("*")
    .maybeSingle();
  return claimed ?? null;
}

async function runQueue(args) {
  const supabase = adminClient();
  const worker = `${hostname()}-${process.pid}`;

  const { error: tableError } = await supabase.from("prospect_search_jobs").select("id").limit(1);
  if (tableError) {
    throw new Error(
      `A fila não existe no banco (${tableError.message}). Aplique a migration 20261009180000_prospecting_upgrade.sql.`,
    );
  }

  const beat = async () => {
    await supabase
      .from("prospect_worker_heartbeats")
      .upsert({ worker, last_seen_at: new Date().toISOString(), version: VERSION });
  };
  await beat();
  const heartbeat = setInterval(() => void beat(), HEARTBEAT_MS);

  const staleBefore = new Date(Date.now() - STALE_JOB_MS).toISOString();
  await supabase
    .from("prospect_search_jobs")
    .update({ status: "erro", error: "O robô foi desligado no meio desta busca.", finished_at: new Date().toISOString() })
    .eq("status", "rodando")
    .lt("started_at", staleBefore);

  let stopping = false;
  const stop = async () => {
    if (stopping) process.exit(1);
    stopping = true;
    log("Desligando…");
    clearInterval(heartbeat);
    await supabase.from("prospect_worker_heartbeats").delete().eq("worker", worker);
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  log(`Robô do Maps ligado (${worker}). Esperando buscas da tela de Prospecção… (Ctrl+C para sair)`);
  while (!stopping) {
    const job = await claimNextJob(supabase, worker);
    if (job) {
      log(`▶ ${job.niche} em ${job.city} (${job.mode})`);
      await processJob(supabase, job);
      if (args["uma-vez"]) break;
      continue;
    }
    if (args["uma-vez"]) break;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  clearInterval(heartbeat);
}

/* ------------------------------------------------------------------ */

loadEnv();
const { values: args } = parseArgs({
  options: {
    buscar: { type: "string", multiple: true },
    cidade: { type: "string" },
    uf: { type: "string" },
    modo: { type: "string" },
    max: { type: "string" },
    csv: { type: "string" },
    salvar: { type: "boolean" },
    dono: { type: "string" },
    "sem-sites": { type: "boolean" },
    janela: { type: "boolean" },
    "uma-vez": { type: "boolean" },
    importar: { type: "string" },
    verificar: { type: "boolean" },
  },
});

try {
  if (args.verificar) await verifyPending();
  else if (args.importar) await importCsv(args);
  else if (args.buscar?.length) await runOnce(args);
  else await runQueue(args);
} catch (error) {
  log(`✖ ${error.message}`);
  process.exitCode = 1;
}
