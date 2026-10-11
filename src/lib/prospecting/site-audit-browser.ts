// Abre o site do lead como um celular em 4G e mede o que quem visita sente.
// Roda só no robô (scripts/maps-robo.mjs): precisa de navegador, e a
// Vercel não tem. As regras do que vira problema ficam em site-audit.ts.

import type { Browser } from "playwright";
import {
  extractSiteSignals,
  hostingPlaceholder,
  normalizeSiteUrl,
  socialSiteLabel,
  type SiteScanResult,
} from "@/lib/prospecting/site-scan";
import { evaluateSite, type SiteAudit, type SiteMetrics } from "@/lib/prospecting/site-audit";

// Rede do teste de celular do PageSpeed (4G lento: 150 ms, 1,6 Mbps). A CPU
// fica em 2x, não 4x: com vários sites em paralelo no mesmo computador, 4x
// exageraria o tempo — e o número vai para a mensagem, melhor errar para
// menos.
const NETWORK = {
  offline: false,
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
};
const CPU_SLOWDOWN = 2;

const MOBILE_CONTEXT = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (Linux; Android 13; moto g54 5G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  locale: "pt-BR",
  timezoneId: "America/Sao_Paulo",
  // Certificado vencido é medido (securityDetails), não impede a leitura.
  ignoreHTTPSErrors: true,
  serviceWorkers: "block" as const,
};

// Erros que querem dizer "não existe nada ali" — o resto (tempo esgotado,
// erro estranho do navegador) fica sem veredito.
const OFFLINE_ERRORS =
  /ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ERR_ADDRESS_UNREACHABLE|ERR_EMPTY_RESPONSE|ERR_TOO_MANY_REDIRECTS|ERR_SSL_PROTOCOL_ERROR/;

const HTTPS_BROKEN = /ERR_SSL|ERR_CERT|ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED/;

// Proteção anti-robô (Cloudflare & cia): quem visita pelo navegador vê o
// site normalmente, então não dá para afirmar nada.
const BOT_WALL = /just a moment|attention required|checking your browser|verify(ing)? you are human|um momento/i;

export type SiteAuditRun = { audit: SiteAudit; signals: SiteScanResult | null };

type DomSignals = {
  lcpMs: number | null;
  loadMs: number | null;
  viewportWidth: number;
  horizontalScroll: boolean;
  title: string;
  description: string | null;
  ogImage: string | null;
  mentionsWhatsapp: boolean;
  hasContactForm: boolean;
  hasTelLink: boolean;
  botWallText: string;
  html: string;
};

type Visit =
  | {
      kind: "ok";
      status: number;
      finalUrl: string;
      certExpired: boolean;
      timedOut: boolean;
      weightKb: number;
      requests: number;
      dom: DomSignals;
    }
  | { kind: "error"; message: string };

// Roda dentro da página. Sem nada importado: o Playwright manda o texto da
// função para o navegador.
function collectDomSignals(): Promise<DomSignals> {
  return new Promise((resolve) => {
    let lcp: number | null = null;
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length) lcp = entries[entries.length - 1].startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      // Navegador sem LCP: fica o "load".
    }
    setTimeout(() => {
      const meta = (selector: string) =>
        document.querySelector(selector)?.getAttribute("content")?.trim() || null;
      const nav = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      const html = document.documentElement.outerHTML;

      // Rolagem de lado de verdade (não só largura calculada): body com
      // overflow-x escondido não conta. Até 40 px é uma balançada, não
      // "parte da página fora da tela".
      const startX = window.scrollX;
      window.scrollTo(400, window.scrollY);
      const horizontalScroll = window.scrollX > 40;
      window.scrollTo(startX, window.scrollY);

      resolve({
        lcpMs: lcp,
        loadMs: nav && nav.loadEventEnd > 0 ? nav.loadEventEnd : null,
        viewportWidth: window.innerWidth,
        horizontalScroll,
        title: document.title ?? "",
        description:
          meta('meta[name="description"]') ?? meta('meta[property="og:description"]'),
        ogImage:
          meta('meta[property="og:image"]') ??
          meta('meta[name="og:image"]') ??
          meta('meta[name="twitter:image"]'),
        // Qualquer menção conta (botão, widget, link no rodapé): só dizemos
        // "sem WhatsApp" quando a palavra não aparece em lugar nenhum.
        mentionsWhatsapp: /wa\.me\/|whatsapp/i.test(html),
        hasContactForm:
          Boolean(document.querySelector("form textarea, form input[type=email], form input[type=tel]")) ||
          Array.from(document.querySelectorAll("iframe")).some((frame) =>
            /form|rdstation|typeform|jotform|hubspot/i.test(frame.src),
          ),
        hasTelLink: Boolean(document.querySelector('a[href^="tel:"]')),
        botWallText: `${document.title} ${(document.body?.innerText ?? "").slice(0, 400)}`,
        html: html.slice(0, 1_500_000),
      });
    }, 400);
  });
}

async function visit(browser: Browser, url: string, timeoutMs: number): Promise<Visit> {
  const context = await browser.newContext(MOBILE_CONTEXT);
  try {
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", NETWORK);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN });

    let bytes = 0;
    let requests = 0;
    cdp.on("Network.loadingFinished", (event) => {
      bytes += event.encodedDataLength;
      requests += 1;
    });

    let response = null;
    let timedOut = false;
    try {
      response = await page.goto(url, { waitUntil: "load", timeout: timeoutMs });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/timeout/i.test(message)) return { kind: "error", message };
      timedOut = true;
    }

    // Botão de WhatsApp e afins costumam entrar depois do "load".
    await page.waitForTimeout(2500);
    const dom = await page.evaluate(collectDomSignals);

    const security = response ? await response.securityDetails().catch(() => null) : null;
    const certExpired = Boolean(security?.validTo && security.validTo * 1000 < Date.now());

    return {
      kind: "ok",
      status: response?.status() ?? 200,
      finalUrl: page.url(),
      certExpired,
      timedOut,
      weightKb: Math.round(bytes / 1024),
      requests,
      dom,
    };
  } catch (error) {
    return { kind: "error", message: error instanceof Error ? error.message : String(error) };
  } finally {
    await context.close().catch(() => {});
  }
}

function withDeadline<T>(promise: Promise<T>, ms: number, fallback: () => T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback()), ms)),
  ]);
}

const offline = (reason: string): SiteAuditRun => ({
  audit: { status: "offline", reason, score: 0, findings: [{ code: "offline" }] },
  signals: null,
});

const inconclusive = (reason: string): SiteAuditRun => ({
  audit: { status: "inconclusive", reason: reason.slice(0, 200), score: null, findings: [] },
  signals: null,
});

/** Nunca lança: o pior caso é uma auditoria inconclusiva. */
export async function auditWebsite(
  browser: Browser,
  rawUrl: string,
  { timeoutMs = 30_000, now = new Date() }: { timeoutMs?: number; now?: Date } = {},
): Promise<SiteAuditRun> {
  const url = normalizeSiteUrl(rawUrl);
  if (!url) return offline("Endereço do site inválido");
  if (socialSiteLabel(url)) return inconclusive("Rede social no lugar de site");

  const run = async (): Promise<SiteAuditRun> => {
    let result = await visit(browser, url, timeoutMs);
    // https quebrado de vez: se o http abre, o site existe (e fica "sem HTTPS").
    if (result.kind === "error" && url.startsWith("https://") && HTTPS_BROKEN.test(result.message)) {
      const plain = await visit(browser, url.replace(/^https:/, "http:"), timeoutMs);
      if (plain.kind === "ok") result = plain;
    }

    if (result.kind === "error") {
      return OFFLINE_ERRORS.test(result.message)
        ? offline(result.message.split("\n")[0])
        : inconclusive(result.message.split("\n")[0]);
    }

    const { dom } = result;
    if (BOT_WALL.test(dom.botWallText)) return inconclusive("Proteção anti-robô");
    const placeholder = hostingPlaceholder(result.finalUrl, dom.html);
    if (placeholder) return offline(placeholder);
    if ([401, 403, 406, 429, 503].includes(result.status)) {
      return inconclusive(`HTTP ${result.status}`);
    }
    if (result.status >= 400) {
      return offline(`HTTP ${result.status}`);
    }

    const https = result.finalUrl.startsWith("https://");
    const signals = extractSiteSignals(dom.html, { url: result.finalUrl, https, now });
    const metrics: SiteMetrics = {
      https,
      certExpired: result.certExpired,
      timedOut: result.timedOut,
      timeoutMs,
      lcpMs: dom.lcpMs,
      loadMs: dom.loadMs,
      weightKb: result.weightKb,
      requests: result.requests,
      viewportWidth: dom.viewportWidth,
      horizontalScroll: dom.horizontalScroll,
      title: dom.title,
      description: dom.description,
      ogImage: dom.ogImage,
      mentionsWhatsapp: dom.mentionsWhatsapp,
      hasContactForm: dom.hasContactForm,
      hasTelLink: dom.hasTelLink,
      htmlIssues: signals.issues,
    };
    const { findings, score } = evaluateSite(metrics);

    return {
      audit: {
        status: "ok",
        score,
        findings,
        lcpMs: dom.lcpMs === null ? null : Math.round(dom.lcpMs),
        weightKb: result.weightKb,
        requests: result.requests,
        finalUrl: result.finalUrl,
        title: dom.title.slice(0, 120),
      },
      signals,
    };
  };

  // Duas visitas de 30 s + espera: passou disso, algo travou no navegador.
  return withDeadline(
    run().catch((error) => inconclusive(error instanceof Error ? error.message : String(error))),
    timeoutMs * 2 + 20_000,
    () => inconclusive("Tempo esgotado na auditoria"),
  );
}
