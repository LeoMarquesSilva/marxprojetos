// Fontes de leads do Google Maps. Cada uma devolve o mesmo formato
// (FoundLead), e a action decide o que gravar. A principal é o robô próprio
// (maps-scraper.ts, sem API); as de baixo são alternativas pagas.
//
// - google: Places API (New), oficial. Até 60 resultados por busca, com
//   1.000 buscas/mês grátis na faixa Enterprise (telefone, site, nota).
//   A varredura em grade divide a cidade em quadrantes para passar dos 60.
// - apify: robô do Google Maps (compass/crawler-google-places). Passa de
//   centenas por busca e já traz e-mail e redes sociais do site.
// - localprospects: a API que já era usada, mantida como opção.

// maps = robô próprio (src/lib/prospecting/maps-scraper.ts), sem API.
export type LeadSource = "maps" | "google" | "apify" | "localprospects" | "csv";

export type FoundLead = {
  placeId: string;
  name: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  rating: number | null;
  ratingCount: number | null;
  mapsUri: string | null;
  category: string | null;
  closed: boolean;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
};

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}

function firstStr(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = str(item);
      if (found) return found;
    }
    return null;
  }
  return str(value);
}

/* ------------------------------------------------------------------ */
/* Google Places API (New)                                             */
/* ------------------------------------------------------------------ */

const GOOGLE_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

// Tudo da faixa Enterprise ou abaixo (telefone, site e nota são Enterprise);
// nada de Atmosphere (avaliações por escrito), que custa mais.
export const GOOGLE_TEXT_SEARCH_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.businessStatus",
  "places.primaryTypeDisplayName",
  "nextPageToken",
].join(",");

export type LatLng = { latitude: number; longitude: number };
export type Viewport = { low: LatLng; high: LatLng };

export function mapGooglePlace(raw: unknown): FoundLead | null {
  if (!raw || typeof raw !== "object") return null;
  const place = raw as Record<string, unknown>;
  const placeId = str(place.id);
  const name = str((place.displayName as { text?: unknown } | undefined)?.text);
  if (!placeId || !name) return null;

  return {
    placeId,
    name,
    phone: str(place.nationalPhoneNumber) ?? str(place.internationalPhoneNumber),
    website: str(place.websiteUri),
    address: str(place.formattedAddress),
    rating: num(place.rating),
    ratingCount: num(place.userRatingCount),
    mapsUri: str(place.googleMapsUri),
    category: str((place.primaryTypeDisplayName as { text?: unknown } | undefined)?.text),
    closed: place.businessStatus === "CLOSED_PERMANENTLY",
    email: null,
    instagram: null,
    facebook: null,
    linkedin: null,
  };
}

async function googleTextSearch(
  apiKey: string,
  body: Record<string, unknown>,
  fieldMask: string,
): Promise<Record<string, unknown>> {
  const response = await fetch(GOOGLE_TEXT_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });

  const json = (await response.json().catch(() => null)) as
    | (Record<string, unknown> & { error?: { message?: string; status?: string } })
    | null;

  if (!response.ok) {
    const reason = json?.error?.message ?? `HTTP ${response.status}`;
    if (response.status === 403) {
      throw new ProviderError(
        `O Google recusou a chave (${reason}). Ative a "Places API (New)" no Google Cloud e confira o faturamento.`,
      );
    }
    throw new ProviderError(`Falha na busca do Google Maps: ${reason}`);
  }
  return json ?? {};
}

/**
 * Uma busca do Maps, paginada até `maxPages` (20 por página, 60 no total —
 * limite do próprio Google). Cada página é uma requisição cobrada.
 */
export async function searchGooglePlaces({
  apiKey,
  textQuery,
  maxPages = 3,
  locationRestriction,
}: {
  apiKey: string;
  textQuery: string;
  maxPages?: number;
  locationRestriction?: Viewport;
}): Promise<{ leads: FoundLead[]; requests: number }> {
  const leads: FoundLead[] = [];
  let pageToken: string | undefined;
  let requests = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const json = await googleTextSearch(
      apiKey,
      {
        textQuery,
        languageCode: "pt-BR",
        regionCode: "BR",
        pageSize: 20,
        ...(locationRestriction ? { locationRestriction: { rectangle: locationRestriction } } : {}),
        ...(pageToken ? { pageToken } : {}),
      },
      GOOGLE_TEXT_SEARCH_FIELDS,
    );
    requests += 1;

    for (const place of (json.places as unknown[] | undefined) ?? []) {
      const lead = mapGooglePlace(place);
      if (lead) leads.push(lead);
    }

    pageToken = str(json.nextPageToken) ?? undefined;
    if (!pageToken) break;
  }

  return { leads, requests };
}

/** Retângulo da cidade, para a varredura em grade. Faixa Pro (barata). */
export async function fetchGoogleCityViewport({
  apiKey,
  city,
}: {
  apiKey: string;
  city: string;
}): Promise<Viewport | null> {
  const json = await googleTextSearch(
    apiKey,
    { textQuery: city, languageCode: "pt-BR", regionCode: "BR", pageSize: 1 },
    "places.id,places.viewport",
  );
  const viewport = (json.places as { viewport?: Viewport }[] | undefined)?.[0]?.viewport;
  if (!viewport?.low || !viewport?.high) return null;
  return viewport;
}

/** Divide o retângulo em n×n quadrantes. */
export function splitViewport(viewport: Viewport, n: number): Viewport[] {
  const tiles: Viewport[] = [];
  const latStep = (viewport.high.latitude - viewport.low.latitude) / n;
  const lngStep = (viewport.high.longitude - viewport.low.longitude) / n;
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      tiles.push({
        low: {
          latitude: viewport.low.latitude + latStep * row,
          longitude: viewport.low.longitude + lngStep * col,
        },
        high: {
          latitude: viewport.low.latitude + latStep * (row + 1),
          longitude: viewport.low.longitude + lngStep * (col + 1),
        },
      });
    }
  }
  return tiles;
}

/* ------------------------------------------------------------------ */
/* Apify — Google Maps Scraper                                         */
/* ------------------------------------------------------------------ */

export const DEFAULT_APIFY_ACTOR = "compass~crawler-google-places";

export function mapApifyPlace(raw: unknown): FoundLead | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const placeId = str(item.placeId) ?? str(item.cid) ?? str(item.fid);
  const name = str(item.title) ?? str(item.name);
  if (!placeId || !name) return null;

  const impressum = (item.impressum ?? null) as { emails?: unknown } | null;

  return {
    placeId,
    name,
    phone: str(item.phone) ?? str(item.phoneUnformatted),
    website: str(item.website),
    address: str(item.address),
    rating: num(item.totalScore),
    ratingCount: num(item.reviewsCount),
    mapsUri: str(item.url),
    category: str(item.categoryName),
    closed: item.permanentlyClosed === true,
    email: firstStr(item.emails) ?? firstStr(impressum?.emails),
    instagram: firstStr(item.instagrams),
    facebook: firstStr(item.facebooks),
    linkedin: firstStr(item.linkedIns),
  };
}

/**
 * Roda o robô e espera o resultado (run-sync). Com `scrapeContacts`, o
 * próprio Apify visita o site de cada negócio atrás de e-mail e redes.
 */
export async function runApifyGoogleMaps({
  token,
  terms,
  locationQuery,
  maxPerTerm,
  actor = DEFAULT_APIFY_ACTOR,
  timeoutSecs = 240,
}: {
  token: string;
  terms: string[];
  locationQuery: string;
  maxPerTerm: number;
  actor?: string;
  timeoutSecs?: number;
}): Promise<FoundLead[]> {
  // A API aceita "dono~ator"; quem copia do site do Apify cola "dono/ator".
  const actorId = encodeURIComponent(actor.trim().replace("/", "~"));
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?timeout=${timeoutSecs}&clean=true&format=json`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        searchStringsArray: terms,
        locationQuery,
        maxCrawledPlacesPerSearch: maxPerTerm,
        language: "pt-BR",
        skipClosedPlaces: true,
        scrapeContacts: true,
        scrapePlaceDetailPage: false,
        maxReviews: 0,
        maxImages: 0,
      }),
      signal: AbortSignal.timeout((timeoutSecs + 20) * 1000),
      cache: "no-store",
    });
  } catch {
    throw new ProviderError(
      "O Apify demorou demais para responder. Tente com menos resultados por termo.",
    );
  }

  const json = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const message =
      (json as { error?: { message?: string } } | null)?.error?.message ??
      `HTTP ${response.status}`;
    if (response.status === 401) {
      throw new ProviderError("Token do Apify inválido (APIFY_TOKEN).");
    }
    if (response.status === 408) {
      throw new ProviderError(
        "A busca no Apify passou do tempo limite. Reduza os resultados por termo.",
      );
    }
    throw new ProviderError(`Falha no Apify: ${message}`);
  }

  return (Array.isArray(json) ? json : [])
    .map(mapApifyPlace)
    .filter((lead): lead is FoundLead => lead !== null);
}

/* ------------------------------------------------------------------ */
/* LocalProspects                                                      */
/* ------------------------------------------------------------------ */

export const LP_BASE = "https://localprospects.ai/api/v1";

export type LpBusiness = {
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

export type LpEnrichedBusiness = LpBusiness & {
  email?: string | null;
  phone_type?: string | null;
  mobile_number?: string | null;
};

export function lpBusinessId(b: LpBusiness) {
  return b.place_id || b.cid || b.id || null;
}

export function mapLocalProspectsBusiness(b: LpBusiness): FoundLead | null {
  const placeId = lpBusinessId(b);
  if (!placeId || !b.name) return null;
  return {
    placeId,
    name: b.name,
    phone: b.phone || null,
    website: b.website || null,
    address: b.address || null,
    rating: b.rating ?? null,
    ratingCount: b.reviews ?? null,
    mapsUri: b.gbp_url || null,
    category: null,
    closed: false,
    email: null,
    instagram: null,
    facebook: null,
    linkedin: null,
  };
}

export async function searchLocalProspects({
  apiKey,
  keyword,
  city,
  stateName,
}: {
  apiKey: string;
  keyword: string;
  city: string;
  stateName?: string;
}): Promise<{ leads: FoundLead[]; jobId: string | null }> {
  // A cidade vira location_code (não consome créditos). O estado
  // desambigua homônimas (há 15 "Bom Jesus" no país).
  const locQuery = stateName ? `${city}, ${stateName}` : city;
  let locResponse: Response;
  try {
    locResponse = await fetch(`${LP_BASE}/locations?q=${encodeURIComponent(locQuery)}`, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch {
    throw new ProviderError("O LocalProspects não respondeu. Tente de novo.");
  }
  if (!locResponse.ok) {
    throw new ProviderError(
      `Falha ao buscar a cidade (${locResponse.status}): ${await locResponse.text()}`,
    );
  }

  const locJson = (await locResponse.json()) as {
    locations?: { location_code: number; country?: string }[];
  };
  const location =
    locJson.locations?.find((l) => l.country === "BR") ?? locJson.locations?.[0];
  if (!location) {
    throw new ProviderError(`Cidade "${city}" não encontrada. Tente outro nome.`);
  }

  let searchResponse: Response;
  try {
    searchResponse = await fetch(`${LP_BASE}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ keyword, location_code: location.location_code }),
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    });
  } catch {
    throw new ProviderError("O LocalProspects demorou demais para responder.");
  }
  if (!searchResponse.ok) {
    throw new ProviderError(
      `Falha na busca (${searchResponse.status}): ${await searchResponse.text()}`,
    );
  }

  const searchJson = (await searchResponse.json()) as {
    job_id?: string;
    businesses?: LpBusiness[];
  };

  return {
    leads: (searchJson.businesses ?? [])
      .map(mapLocalProspectsBusiness)
      .filter((lead): lead is FoundLead => lead !== null),
    jobId: searchJson.job_id ?? null,
  };
}

/** Junta resultados de várias buscas sem repetir o mesmo lugar. */
export function dedupeLeads(leads: FoundLead[]): FoundLead[] {
  const byId = new Map<string, FoundLead>();
  for (const lead of leads) {
    const previous = byId.get(lead.placeId);
    if (!previous) {
      byId.set(lead.placeId, lead);
      continue;
    }
    // Mesma empresa vinda de dois termos: fica o que tiver mais dados.
    byId.set(lead.placeId, {
      ...previous,
      phone: previous.phone ?? lead.phone,
      website: previous.website ?? lead.website,
      email: previous.email ?? lead.email,
      instagram: previous.instagram ?? lead.instagram,
      facebook: previous.facebook ?? lead.facebook,
      linkedin: previous.linkedin ?? lead.linkedin,
      category: previous.category ?? lead.category,
    });
  }
  return [...byId.values()];
}
