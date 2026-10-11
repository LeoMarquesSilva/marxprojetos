// Robô próprio do Google Maps: abre o Maps num Chromium sem janela, busca,
// rola a lista até o fim e lê cada empresa — sem API e sem custo.
//
// Roda só no computador (scripts/maps-robo.mjs), nunca na Vercel: função
// serverless não tem navegador. O app coloca a busca numa fila e o robô
// executa.
//
// Se o Google pedir verificação ("tráfego incomum"), o robô para e avisa.
// Não há nenhuma tentativa de driblar isso — é esperar e tentar mais tarde.

import type { BrowserContext, Page } from "playwright";
import type { FoundLead } from "@/lib/prospecting/providers";

export type LatLng = { lat: number; lng: number };

/** O que o navegador devolve de cada card da lista, antes de interpretar. */
export type MapsCardRaw = {
  name: string;
  href: string;
  website: string | null;
  text: string;
};

export class MapsBlockedError extends Error {
  constructor() {
    super(
      "O Google pediu verificação de robô (tráfego incomum). Pare as buscas por algumas horas e tente de novo.",
    );
    this.name = "MapsBlockedError";
  }
}

export class MapsCancelledError extends Error {
  constructor() {
    super("Busca cancelada.");
    this.name = "MapsCancelledError";
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------------ */
/* Interpretação (pura, testável)                                      */
/* ------------------------------------------------------------------ */

/**
 * O link de um lugar no Maps carrega o place_id do Google (`!19sChIJ…`) —
 * o mesmo da API oficial, então um lead achado pelo robô e pela API é o
 * mesmo lead. Sem ele, cai no id interno (`!1s0x…:0x…`).
 */
export function parseMapsPlaceUrl(href: string): {
  placeId: string | null;
  lat: number | null;
  lng: number | null;
  cleanUrl: string;
} {
  const decoded = (() => {
    try {
      return decodeURIComponent(href);
    } catch {
      return href;
    }
  })();
  const placeId =
    decoded.match(/!19s(ChIJ[^!?&/]+)/)?.[1] ??
    (decoded.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i)?.[1]
      ? `fid:${decoded.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i)![1]}`
      : null);
  const coords = decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  return {
    placeId,
    lat: coords ? Number(coords[1]) : null,
    lng: coords ? Number(coords[2]) : null,
    // Sem os parâmetros de rastreio (authuser, g_ep, rclk): é o link que vai
    // para a tabela e abre o lugar direto.
    cleanUrl: href.split("?")[0],
  };
}

const HOURS_LINE = /^(aberto|fechado|abre|fecha|funciona|atendimento|24 horas)/i;
const PHONE_PATTERNS = [
  /\(\d{2}\)\s?\d{4,5}[-\s]?\d{4}/,
  /\+55\s?\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4}/,
  /\b0[3589]00[\s-]?\d{3}[\s-]?\d{4}\b/,
];

function findPhone(text: string): string | null {
  for (const pattern of PHONE_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0].trim();
  }
  return null;
}

/**
 * Lê o texto de um card da lista. Formato típico (uma linha por item):
 *   Dra. Carolina Resende
 *   5,0(21)
 *   Advogado criminal ·  · R. Conceição, 233
 *   Aberto 24 horas · (19) 99963-0953
 */
export function parseMapsCard(raw: MapsCardRaw): FoundLead | null {
  const { placeId, cleanUrl } = parseMapsPlaceUrl(raw.href);
  const name = raw.name.trim();
  if (!placeId || !name) return null;

  const lines = raw.text
    .split("\n")
    // Ícones da fonte do Maps vêm como caracteres de uso privado.
    .map((line) => line.replace(/[\uE000-\uF8FF]/g, "").trim())
    .filter((line) => line && line !== "Patrocinado" && line !== name);

  let rating: number | null = null;
  let ratingCount: number | null = null;
  let category: string | null = null;
  let address: string | null = null;

  for (const line of lines) {
    const ratingMatch = line.match(/^(\d[,.]\d)\s*(?:\(([\d.]+)\))?$/);
    if (ratingMatch && rating === null) {
      rating = Number(ratingMatch[1].replace(",", "."));
      ratingCount = ratingMatch[2] ? Number(ratingMatch[2].replace(/\./g, "")) : null;
      continue;
    }
    if (category === null && !HOURS_LINE.test(line) && !findPhone(line)) {
      // "Categoria · · Endereço" — a primeira linha que não é nota, horário
      // nem telefone.
      if (/^(nenhuma avaliação|website|rotas|site|ligar)$/i.test(line)) continue;
      const parts = line
        .split("·")
        .map((part) => part.trim())
        .filter(Boolean);
      category = parts[0] ?? null;
      address = parts.length > 1 ? parts[parts.length - 1] : null;
    }
  }

  const website =
    raw.website && !/^https?:\/\/(www\.)?google\./i.test(raw.website) ? raw.website : null;

  return {
    placeId,
    name,
    phone: findPhone(raw.text),
    website,
    address,
    rating,
    ratingCount,
    mapsUri: cleanUrl,
    category,
    closed: /fechado permanentemente|fechado temporariamente|permanently closed/i.test(raw.text),
    email: null,
    instagram: null,
    facebook: null,
    linkedin: null,
  };
}

/** Centros de uma grade n×n em volta do centro da cidade. */
export function gridAround(center: LatLng, size: number, stepDeg: number): LatLng[] {
  const half = (size - 1) / 2;
  const points: LatLng[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      points.push({
        lat: Number((center.lat + (row - half) * stepDeg).toFixed(6)),
        lng: Number((center.lng + (col - half) * stepDeg).toFixed(6)),
      });
    }
  }
  return points;
}

/* ------------------------------------------------------------------ */
/* Navegador                                                           */
/* ------------------------------------------------------------------ */

export async function openMapsContext({ headless = true }: { headless?: boolean } = {}) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1280, height: 900 },
  });
  // Imagem, vídeo e fonte não têm dado nenhum: bloquear deixa cada busca
  // bem mais rápida e leve.
  await context.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (type === "image" || type === "media" || type === "font") return route.abort();
    return route.continue();
  });
  return {
    context,
    close: () => browser.close(),
  };
}

async function ensureUsable(page: Page) {
  const url = page.url();
  if (url.includes("/sorry/")) throw new MapsBlockedError();
  if (url.includes("consent.google")) {
    // Tela de cookies (comum fora do Brasil): recusa o que não é essencial.
    const reject = page.getByRole("button", { name: /rejeitar tudo|reject all/i });
    if (await reject.count()) {
      await Promise.all([page.waitForURL(/google\.com\/maps/, { timeout: 15000 }), reject.first().click()]);
    }
  }
  const body = (await page.locator("body").innerText().catch(() => "")).slice(0, 2000);
  if (/tráfego incomum|unusual traffic|não é um robô|not a robot/i.test(body)) {
    throw new MapsBlockedError();
  }
}

async function readCards(page: Page): Promise<MapsCardRaw[]> {
  return page.$$eval('div[role="feed"] a[href*="/maps/place/"]', (anchors) =>
    anchors.map((anchor) => {
      const card =
        anchor.closest('div[role="feed"] > div') ?? anchor.parentElement ?? anchor;
      const site = card.querySelector('a[data-value="Website"], a[aria-label^="Acessar o site"]');
      return {
        name: anchor.getAttribute("aria-label") ?? "",
        href: (anchor as HTMLAnchorElement).href,
        website: site ? (site as HTMLAnchorElement).href : null,
        text: (card as HTMLElement).innerText ?? "",
      };
    }),
  );
}

/**
 * Uma busca no Maps: rola a lista lateral até o fim (ou até `maxResults`)
 * e lê os cards. `center` restringe a busca àquela área do mapa — é o que
 * a varredura usa para cobrir a cidade em pedaços.
 */
export async function scrapeMapsSearch(
  context: BrowserContext,
  {
    query,
    center,
    zoom = 14,
    maxResults = 120,
  }: { query: string; center?: LatLng; zoom?: number; maxResults?: number },
): Promise<FoundLead[]> {
  const page = await context.newPage();
  try {
    const at = center ? `/@${center.lat},${center.lng},${zoom}z` : "";
    await page.goto(
      `https://www.google.com/maps/search/${encodeURIComponent(query)}${at}?hl=pt-BR`,
      { waitUntil: "domcontentloaded", timeout: 45000 },
    );
    await ensureUsable(page);

    const feed = await page
      .waitForSelector('div[role="feed"]', { timeout: 20000 })
      .catch(() => null);

    if (!feed) {
      await ensureUsable(page);
      // Busca que bate em um lugar só abre direto a ficha dele.
      const single = await readPlaceDetails(page).catch(() => null);
      if (single?.name && page.url().includes("/maps/place/")) {
        const { placeId, cleanUrl } = parseMapsPlaceUrl(page.url());
        if (placeId) {
          return [
            {
              placeId,
              name: single.name,
              phone: single.phone,
              website: single.website,
              address: single.address,
              rating: single.rating,
              ratingCount: single.ratingCount,
              mapsUri: cleanUrl,
              category: single.category,
              closed: single.closed,
              email: null,
              instagram: null,
              facebook: null,
              linkedin: null,
            },
          ];
        }
      }
      return [];
    }

    let lastCount = 0;
    let stableRounds = 0;
    for (let round = 0; round < 60; round += 1) {
      const count = await page.$$eval(
        'div[role="feed"] a[href*="/maps/place/"]',
        (anchors) => new Set(anchors.map((a) => (a as HTMLAnchorElement).href.split("?")[0])).size,
      );
      if (count >= maxResults) break;
      const reachedEnd = await page.$eval('div[role="feed"]', (el) =>
        /chegou ao final da lista|reached the end of the list/i.test((el as HTMLElement).innerText),
      );
      if (reachedEnd) break;
      stableRounds = count === lastCount ? stableRounds + 1 : 0;
      if (stableRounds >= 4) break;
      lastCount = count;
      await page.$eval('div[role="feed"]', (el) => el.scrollBy(0, 5000));
      await page.waitForTimeout(1100 + Math.random() * 600);
    }

    const byPlace = new Map<string, FoundLead>();
    for (const raw of await readCards(page)) {
      const lead = parseMapsCard(raw);
      if (!lead) continue;
      const previous = byPlace.get(lead.placeId);
      // O anúncio ("Patrocinado") repete a empresa: fica o card com mais dado.
      if (!previous || (!previous.phone && lead.phone) || (!previous.ratingCount && lead.ratingCount)) {
        byPlace.set(lead.placeId, { ...previous, ...lead, website: lead.website ?? previous?.website ?? null });
      }
    }
    return [...byPlace.values()].slice(0, maxResults);
  } finally {
    await page.close().catch(() => undefined);
  }
}

type PlaceDetails = {
  name: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  category: string | null;
  rating: number | null;
  ratingCount: number | null;
  closed: boolean;
};

async function readPlaceDetails(page: Page): Promise<PlaceDetails> {
  await page.waitForSelector("h1", { timeout: 15000 });
  await page.waitForTimeout(800);
  return page.evaluate(() => {
    const phoneId = document
      .querySelector('[data-item-id^="phone:tel:"]')
      ?.getAttribute("data-item-id");
    const ratingText = (document.querySelector("div.F7nice") as HTMLElement | null)?.innerText ?? "";
    const ratingMatch = ratingText.match(/(\d[,.]\d)/);
    const countMatch = ratingText.match(/\(([\d.]+)\)/);
    return {
      name: (document.querySelector("h1") as HTMLElement | null)?.innerText?.trim() ?? null,
      phone: phoneId ? phoneId.replace("phone:tel:", "") : null,
      website:
        (document.querySelector('a[data-item-id="authority"]') as HTMLAnchorElement | null)
          ?.href ?? null,
      address:
        document
          .querySelector('[data-item-id="address"]')
          ?.getAttribute("aria-label")
          ?.replace(/^Endereço:\s*/i, "")
          .trim() ?? null,
      category:
        (document.querySelector('button[jsaction*="category"]') as HTMLElement | null)
          ?.innerText?.trim() ?? null,
      rating: ratingMatch ? Number(ratingMatch[1].replace(",", ".")) : null,
      ratingCount: countMatch ? Number(countMatch[1].replace(/\./g, "")) : null,
      closed: /Fechado permanentemente|Fechado temporariamente/.test(document.body.innerText),
    };
  });
}

/**
 * Abre a ficha de quem veio sem telefone no card. O card às vezes esconde o
 * número; a ficha completa (e traz o endereço inteiro, com CEP).
 */
export async function completeFromDetails(
  context: BrowserContext,
  leads: FoundLead[],
  {
    concurrency = 3,
    limit = 60,
    onProgress,
  }: { concurrency?: number; limit?: number; onProgress?: (done: number, total: number) => void } = {},
) {
  const targets = leads.filter((lead) => !lead.phone && !lead.closed).slice(0, limit);
  let done = 0;
  let index = 0;

  const workers = Array.from({ length: Math.min(concurrency, targets.length) }, async () => {
    const page = await context.newPage();
    try {
      while (index < targets.length) {
        const lead = targets[index++];
        try {
          await page.goto(`${lead.mapsUri}?hl=pt-BR`, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });
          await ensureUsable(page);
          const details = await readPlaceDetails(page);
          lead.phone = details.phone ?? lead.phone;
          lead.website = lead.website ?? details.website;
          lead.address = details.address ?? lead.address;
          lead.category = lead.category ?? details.category;
          lead.closed = lead.closed || details.closed;
        } catch (error) {
          if (error instanceof MapsBlockedError) throw error;
          // Ficha que não abriu: o lead fica com o que o card trouxe.
        }
        done += 1;
        onProgress?.(done, targets.length);
        await sleep(400 + Math.random() * 600);
      }
    } finally {
      await page.close().catch(() => undefined);
    }
  });

  await Promise.all(workers);
}

/** Centro da cidade, lido do próprio Maps (sem API de geocodificação). */
export async function findCityCenter(context: BrowserContext, place: string): Promise<LatLng | null> {
  const page = await context.newPage();
  try {
    await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(place)}?hl=pt-BR`, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await ensureUsable(page);
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const { lat, lng } = parseMapsPlaceUrl(page.url());
      if (lat !== null && lng !== null) return { lat, lng };
      const viewport = page.url().match(/@(-?\d+\.\d+),(-?\d+\.\d+),/);
      if (viewport && attempt > 6) return { lat: Number(viewport[1]), lng: Number(viewport[2]) };
      await page.waitForTimeout(500);
    }
    return null;
  } finally {
    await page.close().catch(() => undefined);
  }
}

export type MapsSearchMode = "padrao" | "ampla" | "varredura";

/**
 * A busca completa de um pedido da fila: um ou mais termos (busca ampla) ou
 * a cidade em quadrantes (varredura), juntando tudo sem repetir empresa.
 */
export async function runMapsSearch({
  terms,
  city,
  state,
  mode,
  maxPerSearch = 120,
  headless = true,
  onProgress,
  shouldStop,
}: {
  terms: string[];
  city: string;
  state?: string | null;
  mode: MapsSearchMode;
  maxPerSearch?: number;
  headless?: boolean;
  onProgress?: (message: string) => void;
  shouldStop?: () => Promise<boolean> | boolean;
}): Promise<{ leads: FoundLead[]; searches: number }> {
  const { context, close } = await openMapsContext({ headless });
  try {
    const place = state ? `${city}, ${state}` : city;
    const all = new Map<string, FoundLead>();

    let searches: { query: string; center?: LatLng; label: string }[];
    if (mode === "varredura") {
      onProgress?.(`Localizando ${place} no mapa…`);
      const center = await findCityCenter(context, place);
      if (!center) throw new Error(`Não achei ${place} no Google Maps.`);
      // 3×3 quadrantes de ~5,5 km: cobre o miolo de uma cidade média, onde
      // a lista única do Maps corta em ~120 resultados.
      searches = gridAround(center, 3, 0.05).map((point) => ({
        query: terms[0],
        center: point,
        label: `Varrendo o quadrante`,
      }));
    } else {
      searches = terms.map((term) => ({ query: `${term} em ${place}`, label: `Buscando "${term}"` }));
    }

    for (const [index, search] of searches.entries()) {
      if (await shouldStop?.()) throw new MapsCancelledError();
      onProgress?.(
        `${search.label} ${index + 1}/${searches.length} · ${all.size} empresa(s) até agora`,
      );
      const found = await scrapeMapsSearch(context, {
        query: search.query,
        center: search.center,
        maxResults: maxPerSearch,
      });
      for (const lead of found) {
        const previous = all.get(lead.placeId);
        all.set(lead.placeId, previous ? { ...lead, ...previous, phone: previous.phone ?? lead.phone, website: previous.website ?? lead.website } : lead);
      }
      // Pausa entre buscas: ritmo de gente, não de rajada.
      if (index < searches.length - 1) await sleep(2000 + Math.random() * 2000);
    }

    const leads = [...all.values()];
    const missing = leads.filter((lead) => !lead.phone && !lead.closed).length;
    if (missing > 0) {
      if (await shouldStop?.()) throw new MapsCancelledError();
      await completeFromDetails(context, leads, {
        onProgress: (done, total) =>
          onProgress?.(`Abrindo a ficha de quem veio sem telefone (${done}/${total})`),
      });
    }

    return { leads, searches: searches.length };
  } finally {
    await close().catch(() => undefined);
  }
}
