// Análise do site do lead: de onde saem e-mail, WhatsApp, Instagram e os
// "problemas" do site que viram argumento de venda (fora do ar, sem HTTPS,
// não adaptado ao celular, rodapé parado em 2019...).
//
// O Google Maps só traz telefone e endereço do site. É no próprio site que
// o escritório publica o WhatsApp de verdade — muitas vezes um celular,
// quando o Maps mostra só o fixo da recepção.

import { normalizeBrPhone } from "@/lib/phone";

export type SiteStatus = "ok" | "offline" | "social";

export type SiteScanResult = {
  status: SiteStatus;
  issues: string[];
  emails: string[];
  /** Celular (e164) publicado como link de WhatsApp no site. */
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
};

// "Site" que é só a rede social: para a INSYT, é lead sem site próprio.
const SOCIAL_AS_SITE: { host: RegExp; label: string }[] = [
  { host: /(^|\.)instagram\.com$/, label: "Instagram" },
  { host: /(^|\.)facebook\.com$|(^|\.)fb\.com$/, label: "Facebook" },
  { host: /(^|\.)linktr\.ee$|(^|\.)linkin\.bio$|(^|\.)beacons\.ai$/, label: "Linktree" },
  { host: /(^|\.)wa\.me$|(^|\.)whatsapp\.com$/, label: "WhatsApp" },
  { host: /(^|\.)sites\.google\.com$/, label: "Google Sites" },
  { host: /(^|\.)negocio\.site$|(^|\.)business\.site$/, label: "perfil do Google" },
];

const BUILDERS: { pattern: RegExp; label: string }[] = [
  { pattern: /wixstatic\.com|wix\.com website builder|x-wix-/i, label: "Wix" },
  { pattern: /weebly\.com/i, label: "Weebly" },
  { pattern: /webnode\./i, label: "Webnode" },
  { pattern: /site123\.|site123\.me/i, label: "Site123" },
  { pattern: /zyrosite|hostinger website builder/i, label: "construtor da Hostinger" },
  { pattern: /godaddy website builder|img1\.wsimg\.com/i, label: "construtor da GoDaddy" },
];

const JUNK_EMAIL =
  /(@(example|exemplo|domain|dominio|email|seudominio|sentry|wixpress|sentry-next\.wixpress)\.)|(\.(png|jpe?g|gif|webp|svg)$)|^(nome|seu|your|user|usuario|email)@/i;

function uniq<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#64;|&commat;/gi, "@")
    .replace(/&#46;|&period;/gi, ".")
    .replace(/&amp;/gi, "&")
    .replace(/%40/g, "@");
}

function extractHrefs(html: string): string[] {
  const hrefs: string[] = [];
  const pattern = /href\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) hrefs.push(decodeEntities(match[1].trim()));
  return hrefs;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function socialSiteLabel(url: string): string | null {
  const host = hostOf(url);
  if (!host) return null;
  return SOCIAL_AS_SITE.find((item) => item.host.test(host))?.label ?? null;
}

function extractEmails(html: string, hrefs: string[], siteHost: string | null) {
  const fromMailto = hrefs
    .filter((href) => href.toLowerCase().startsWith("mailto:"))
    .map((href) => href.slice(7).split("?")[0]);
  const text = decodeEntities(html);
  const fromText = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? [];

  const emails = uniq(
    [...fromMailto, ...fromText]
      .map((email) => email.trim().toLowerCase().replace(/^[.]+|[.]+$/g, ""))
      .filter((email) => email.includes("@") && !JUNK_EMAIL.test(email)),
  );

  // Do domínio do próprio site primeiro: contato@escritorio.com.br vale mais
  // que o gmail do desenvolvedor que ficou no rodapé.
  const rootHost = siteHost?.split(".").slice(-3).join(".") ?? null;
  return emails.sort((a, b) => {
    const aOwn = rootHost && a.split("@")[1]?.endsWith(rootHost) ? 0 : 1;
    const bOwn = rootHost && b.split("@")[1]?.endsWith(rootHost) ? 0 : 1;
    return aOwn - bOwn;
  });
}

function extractWhatsapp(hrefs: string[]): string | null {
  const candidates: string[] = [];
  for (const href of hrefs) {
    const match =
      href.match(/wa\.me\/\+?(\d{10,15})/i) ??
      href.match(/whatsapp\.com\/send\/?\?(?:[^"']*&)?phone=\+?(\d{10,15})/i) ??
      href.match(/whatsapp:\/\/send\?(?:[^"']*&)?phone=\+?(\d{10,15})/i);
    if (match) candidates.push(match[1]);
  }

  // Celular primeiro; WhatsApp Business em fixo também serve se for o único.
  const normalized = candidates
    .map((digits) => normalizeBrPhone(digits))
    .filter((phone) => phone.e164);
  return (
    normalized.find((phone) => phone.isMobile)?.e164 ??
    normalized[0]?.e164 ??
    null
  );
}

function firstProfile(
  hrefs: string[],
  host: RegExp,
  reject: RegExp,
): string | null {
  for (const href of hrefs) {
    let url: URL;
    try {
      url = new URL(href);
    } catch {
      continue;
    }
    if (!host.test(url.hostname.toLowerCase())) continue;
    const path = url.pathname.replace(/\/+$/, "");
    if (!path || path === "/" || reject.test(path)) continue;
    return `https://${url.hostname.replace(/^(m|web|pt-br|br)\./, "www.")}${path}`;
  }
  return null;
}

// Página da hospedagem no lugar do site: conta suspensa (cPanel e afins) ou
// a página padrão do servidor. Para quem visita, é o mesmo que fora do ar.
const SUSPENDED =
  /account (has been )?suspended|conta (foi )?suspensa|site suspenso|webmaster, por favor, entre em contato com o provedor/i;
const DEFAULT_PAGE =
  /^(index of \/|it works!?|welcome to nginx!?|apache2? (ubuntu |debian )?default page|default web site page|página padrão)/i;

// "Página não encontrada" respondida como página normal (HTTP 200).
const SOFT_404 = /^(404\b|p[áa]gina n[ãa]o encontrada|page not found|not found\b)/i;

export function hostingPlaceholder(url: string, html: string): string | null {
  if (/\/cgi-sys\/suspendedpage\.cgi/i.test(url)) return "Site suspenso pela hospedagem";
  if (/\/cgi-sys\/defaultwebpage\.cgi/i.test(url)) return "Página padrão da hospedagem (sem site)";
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 3000 && SUSPENDED.test(text)) return "Site suspenso pela hospedagem";
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
  if (DEFAULT_PAGE.test(title) || DEFAULT_PAGE.test(text.slice(0, 80))) {
    return "Página padrão da hospedagem (sem site)";
  }
  if (SOFT_404.test(title)) return "Site fora do ar (página não encontrada)";
  return null;
}

/**
 * Lê o HTML já baixado. Separado do download para ser testável sem rede.
 */
export function extractSiteSignals(
  html: string,
  {
    url,
    https,
    now = new Date(),
  }: { url: string; https: boolean; now?: Date },
): SiteScanResult {
  const hrefs = extractHrefs(html);
  const lower = html.toLowerCase();
  const issues: string[] = [];

  if (!https) issues.push("Sem HTTPS (navegador avisa \"não seguro\")");

  if (!/<meta[^>]+name\s*=\s*["']viewport["']/i.test(html)) {
    issues.push("Não é adaptado ao celular");
  }

  const builder = BUILDERS.find((item) => item.pattern.test(html));
  if (builder) issues.push(`Feito no ${builder.label}`);

  const visibleText = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (
    /em constru[cç][aã]o|under construction|coming soon|site em manuten[cç][aã]o|em breve novo site/i.test(
      visibleText,
    )
  ) {
    issues.push("Site em construção");
  } else if (/dom[ií]nio (est[aá] )?[àa] venda|domain (is )?for sale|parked/i.test(visibleText)) {
    issues.push("Domínio estacionado (sem site)");
  } else if (visibleText.length < 400 && !builder) {
    // Sites em React/Wix montam o texto no navegador; só desconfiamos de
    // página vazia quando não é um construtor conhecido.
    issues.push("Página quase sem conteúdo");
  }

  // Texto provisório do modelo que ficou no ar ("Lorem ipsum", "Neste
  // espaço podemos inserir o texto…"): argumento concreto e verificável.
  const placeholder = visibleText.match(
    /lorem ipsum dolor[^.]{0,40}|neste espa[çc]o (podemos|voc[êe] pode) inserir[^.]{0,60}|(insira|digite) (aqui )?(o )?seu texto[^.]{0,40}|seu texto aqui/i,
  );
  if (placeholder) issues.push(`Texto provisório no site: "${placeholder[0].trim().slice(0, 70)}"`);

  const copyright = visibleText.match(
    /(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?((?:19|20)\d{2})/i,
  );
  if (copyright) {
    const year = Number(copyright[1]);
    if (year <= now.getFullYear() - 3) {
      issues.push(`Rodapé parado em ${year}`);
    }
  }

  if (lower.includes("jquery-1.") || lower.includes("<frameset") || lower.includes(".swf")) {
    issues.push("Tecnologia antiga");
  }

  return {
    status: "ok",
    issues,
    emails: extractEmails(html, hrefs, hostOf(url)),
    whatsapp: extractWhatsapp(hrefs),
    instagram: firstProfile(
      hrefs,
      /(^|\.)instagram\.com$/,
      /^\/(p|reel|reels|explore|stories|accounts|share)(\/|$)/i,
    ),
    facebook: firstProfile(
      hrefs,
      /(^|\.)facebook\.com$/,
      /^\/(sharer|share|plugins|tr|dialog|login)(\.php)?(\/|$)/i,
    ),
    linkedin: firstProfile(hrefs, /(^|\.)linkedin\.com$/, /^\/(share|sharing|shareArticle)/i),
  };
}

function mergeScan(base: SiteScanResult, extra: SiteScanResult): SiteScanResult {
  return {
    ...base,
    emails: uniq([...base.emails, ...extra.emails]),
    whatsapp: base.whatsapp ?? extra.whatsapp,
    instagram: base.instagram ?? extra.instagram,
    facebook: base.facebook ?? extra.facebook,
    linkedin: base.linkedin ?? extra.linkedin,
  };
}

// Só http(s) público. O endereço vem do perfil do Google, escrito pelo dono
// do negócio — não deixamos o servidor ser apontado para a rede interna.
export function isSafePublicUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost") ||
    host.includes(":") || // IPv6 literal
    !host.includes(".")
  ) {
    return false;
  }
  const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    ) {
      return false;
    }
  }
  return true;
}

export function normalizeSiteUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return isSafePublicUrl(withProtocol) ? withProtocol : null;
}

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "pt-BR,pt;q=0.9",
};

const MAX_HTML_CHARS = 1_500_000;

async function fetchHtml(url: string, timeoutMs: number) {
  const response = await fetch(url, {
    headers: BROWSER_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  const finalUrl = response.url || url;
  if (!isSafePublicUrl(finalUrl)) throw new Error("redirect_unsafe");
  const html = response.ok ? (await response.text()).slice(0, MAX_HTML_CHARS) : "";
  return { ok: response.ok, status: response.status, finalUrl, html };
}

function contactPageUrl(html: string, baseUrl: string): string | null {
  const base = new URL(baseUrl);
  for (const href of extractHrefs(html)) {
    if (!/contato|contact|fale-conosco|faleconosco|atendimento/i.test(href)) continue;
    try {
      const url = new URL(href, base);
      if (url.hostname === base.hostname && /^https?:$/.test(url.protocol)) {
        return url.toString();
      }
    } catch {
      // href quebrado: tenta o próximo
    }
  }
  return null;
}

/**
 * Baixa a home (e a página de contato, se a home não tiver e-mail) e
 * extrai os sinais. Nunca lança: site que não responde vira "offline", que
 * para a INSYT é o melhor argumento de todos.
 */
export async function scanWebsite(
  rawUrl: string,
  { timeoutMs = 9000, now = new Date() }: { timeoutMs?: number; now?: Date } = {},
): Promise<SiteScanResult> {
  const offline = (issue: string): SiteScanResult => ({
    status: "offline",
    issues: [issue],
    emails: [],
    whatsapp: null,
    instagram: null,
    facebook: null,
    linkedin: null,
  });

  const url = normalizeSiteUrl(rawUrl);
  if (!url) return offline("Endereço do site inválido");

  const social = socialSiteLabel(url);
  if (social) {
    return {
      status: "social",
      issues: [`Usa ${social} no lugar de site`],
      emails: [],
      whatsapp: null,
      instagram: social === "Instagram" ? url : null,
      facebook: social === "Facebook" ? url : null,
      linkedin: null,
    };
  }

  // Sem veredito: o site existe, mas não deu para ler. Melhor não afirmar
  // nada do que dizer ao lead que o site dele "está fora do ar".
  const inconclusive = (issues: string[] = []): SiteScanResult => ({
    status: "ok",
    issues,
    emails: [],
    whatsapp: null,
    instagram: null,
    facebook: null,
    linkedin: null,
  });
  const isTimeout = (error: unknown) =>
    error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");

  let page: Awaited<ReturnType<typeof fetchHtml>>;
  try {
    page = await fetchHtml(url, timeoutMs);
  } catch (error) {
    if (isTimeout(error)) return inconclusive(["Site muito lento para abrir"]);
    // Certificado vencido derruba o https; se o http responde, o site existe
    // mas o navegador do cliente mostra "não seguro".
    if (url.startsWith("https://")) {
      try {
        page = await fetchHtml(url.replace(/^https:/, "http:"), timeoutMs);
      } catch (httpError) {
        if (isTimeout(httpError)) return inconclusive(["Site muito lento para abrir"]);
        return offline("Site fora do ar");
      }
    } else {
      return offline("Site fora do ar");
    }
  }

  if (!page.ok) {
    // 401/403/429/503 costumam ser proteção contra robôs (Cloudflare etc.),
    // não site quebrado: para quem visita pelo navegador, ele abre.
    if ([401, 403, 406, 429, 503].includes(page.status)) return inconclusive();
    return offline(
      page.status === 404 || page.status === 410
        ? "Site fora do ar (página não encontrada)"
        : `Site com erro (${page.status})`,
    );
  }

  const placeholder = hostingPlaceholder(page.finalUrl, page.html);
  if (placeholder) return offline(placeholder);

  let result = extractSiteSignals(page.html, {
    url: page.finalUrl,
    https: page.finalUrl.startsWith("https://"),
    now,
  });

  if (result.emails.length === 0 || !result.whatsapp) {
    const contactUrl = contactPageUrl(page.html, page.finalUrl);
    if (contactUrl && contactUrl !== page.finalUrl) {
      try {
        const contact = await fetchHtml(contactUrl, Math.min(timeoutMs, 6000));
        if (contact.ok) {
          result = mergeScan(
            result,
            extractSiteSignals(contact.html, {
              url: contact.finalUrl,
              https: true,
              now,
            }),
          );
        }
      } catch {
        // A home já respondeu; a página de contato é bônus.
      }
    }
  }

  return result;
}
