// Auditoria do site do lead. O robô abre o site como um celular em 4G
// (site-audit-browser.ts) e mede o que quem visita sente; aqui ficam as
// regras — o que vira problema, quanto pesa na nota do site e a frase que
// vai para a mensagem —, sem navegador, para testar e para a tela usar.
//
// O banco guarda só o código de cada problema (e o número medido): a frase
// sai daqui na hora de montar a mensagem, então dá para reescrever o texto
// sem auditar tudo de novo.

export type SiteFindingCode =
  | "offline"
  | "construction"
  | "placeholder_text"
  | "timeout"
  | "slow"
  | "cert_expired"
  | "no_viewport"
  | "overflow"
  | "no_https"
  | "empty"
  | "no_whatsapp"
  | "outdated"
  | "no_preview"
  | "no_title"
  | "generic_title"
  | "heavy"
  | "no_contact"
  | "no_description"
  | "old_tech"
  | "builder";

export type SiteFinding = { code: SiteFindingCode; value?: number | string };

export type SiteAudit = {
  /** inconclusive = não deu para medir (anti-robô, erro estranho). */
  status: "ok" | "offline" | "inconclusive";
  reason?: string;
  /** Nota do site, 0–100 (100 = nada a melhorar). null se inconclusiva. */
  score: number | null;
  findings: SiteFinding[];
  lcpMs?: number | null;
  weightKb?: number;
  requests?: number;
  finalUrl?: string;
  title?: string;
  measuredAt?: string;
};

/** O que o navegador mediu na home, já montada. */
export type SiteMetrics = {
  https: boolean;
  certExpired: boolean;
  /** Não terminou de carregar dentro do limite. */
  timedOut: boolean;
  timeoutMs: number;
  /** Quando o maior bloco da tela apareceu (LCP). */
  lcpMs: number | null;
  loadMs: number | null;
  weightKb: number;
  requests: number;
  /** Largura da página no celular: bem acima de 390 = sem viewport. */
  viewportWidth: number;
  horizontalScroll: boolean;
  title: string;
  description: string | null;
  ogImage: string | null;
  mentionsWhatsapp: boolean;
  hasContactForm: boolean;
  hasTelLink: boolean;
  /** Problemas lidos do HTML montado por extractSiteSignals. */
  htmlIssues: string[];
};

type FindingInfo = {
  /** Curto, para a tabela. */
  label: string;
  /** Frase da mensagem; null = não vale citar para o lead. */
  pitch: string | null;
  /** Quanto tira da nota do site. */
  weight: number;
  /** Ordem na mensagem: o mais convincente primeiro. */
  priority: number;
};

// Lento acima de 4 s é o limite do próprio Google para o "maior conteúdo"
// da tela aparecer (LCP) — dá para afirmar sem exagero.
export const SLOW_LCP_MS = 4000;
const HEAVY_KB = 5000;

const GENERIC_TITLE =
  /^(home|in[ií]cio|p[aá]gina inicial|principal|bem[- ]?vind[oa]s?|site|meu site|novo site|untitled|document|wordpress|wix|index|default|my site)$/i;
const DEFAULT_TAGLINE = /just another wordpress site|apenas outro site wordpress|my wordpress blog/i;

function secondsOf(ms: number) {
  return Math.max(1, Math.round(ms / 1000));
}

function megabytes(kb: number) {
  return (kb / 1024).toFixed(1).replace(".", ",");
}

export function describeFinding(finding: SiteFinding): FindingInfo {
  const value = finding.value;
  switch (finding.code) {
    case "offline":
      return {
        label: "Site fora do ar",
        pitch: "O site não abre: quem procura vocês no Google cai numa página de erro",
        weight: 100,
        priority: 100,
      };
    case "construction":
      return {
        label: "Site em construção",
        pitch: "A página está como \"em construção\": quem chega pelo Google não encontra informação nenhuma",
        weight: 60,
        priority: 99,
      };
    case "placeholder_text":
      return {
        label: `Texto provisório no site ("${value}")`,
        pitch: `Ainda aparece texto provisório do modelo no site ("${value}")`,
        weight: 25,
        priority: 98,
      };
    case "cert_expired":
      return {
        label: "Certificado de segurança vencido",
        pitch: "O certificado de segurança venceu: antes de abrir, o navegador avisa que a conexão não é segura",
        weight: 25,
        priority: 97,
      };
    case "timeout":
      return {
        label: `Não abriu em ${value ?? 30} s no celular`,
        pitch: `No celular, com 4G, a página não terminou de abrir nem em ${value ?? 30} segundos`,
        weight: 35,
        priority: 94,
      };
    case "slow": {
      const seconds = Number(value) || 5;
      // 4,0–4,5 s arredonda para 4: "uns 4 segundos… lento acima de 4" soaria contraditório.
      const howLong = seconds <= 4 ? "mais de 4 segundos" : `uns ${seconds} segundos`;
      return {
        label: `Lento no celular (${seconds} s)`,
        pitch: `Demora ${howLong} para aparecer no celular — o Google considera lento acima de 4`,
        weight: seconds >= 10 ? 30 : seconds >= 7 ? 22 : 14,
        priority: 92,
      };
    }
    case "no_viewport":
      return {
        label: "Não é adaptado ao celular",
        pitch: "No celular ele abre como no computador, com letra miúda: é preciso dar zoom para ler",
        weight: 25,
        priority: 90,
      };
    case "overflow":
      return {
        label: "Layout quebra no celular",
        pitch: "No celular, parte da página sai da tela e é preciso arrastar para os lados",
        weight: 15,
        priority: 86,
      };
    case "no_https":
      return {
        label: "Sem HTTPS",
        pitch: "O navegador marca o site como \"Não seguro\" ao lado do endereço",
        weight: 15,
        priority: 84,
      };
    case "empty":
      return {
        label: "Página quase sem conteúdo",
        pitch: "A página inicial quase não tem texto explicando o que vocês fazem",
        weight: 25,
        priority: 80,
      };
    case "no_whatsapp":
      return {
        label: "Sem botão de WhatsApp",
        pitch: "Não tem botão de WhatsApp: quem quer falar com vocês precisa copiar o número e salvar o contato",
        weight: 12,
        priority: 78,
      };
    case "outdated":
      return {
        label: `Rodapé parado em ${value}`,
        pitch: `O rodapé ainda mostra © ${value}, o que passa a impressão de site abandonado`,
        weight: 10,
        priority: 70,
      };
    case "no_preview":
      return {
        label: "Link sem prévia no WhatsApp",
        pitch:
          value === "sem_descricao"
            ? "Quando alguém compartilha o link no WhatsApp, ele aparece sem imagem e sem descrição"
            : "Quando alguém compartilha o link no WhatsApp, ele aparece sem imagem",
        weight: 8,
        priority: 64,
      };
    case "no_title":
      return {
        label: "Página sem título",
        pitch: "A página não tem título: na aba do navegador e no Google aparece só o endereço",
        weight: 8,
        priority: 60,
      };
    case "generic_title":
      return {
        label: `Título genérico ("${value}")`,
        pitch: `No Google e na aba do navegador, o título aparece só como "${value}"`,
        weight: 6,
        priority: 56,
      };
    case "heavy":
      return {
        label: `Página pesada (${megabytes(Number(value) || 0)} MB)`,
        pitch: `A página inicial pesa ${megabytes(Number(value) || 0)} MB, o que gasta o plano de dados de quem visita e deixa tudo mais lento`,
        weight: 8,
        priority: 52,
      };
    case "no_contact":
      return {
        label: "Sem WhatsApp, formulário ou telefone clicável",
        pitch: "Não tem botão de WhatsApp, formulário nem telefone clicável: para falar com vocês é preciso copiar o número",
        weight: 18,
        priority: 82,
      };
    case "no_description":
      return {
        label: "Sem descrição para o Google",
        pitch: "Não tem a descrição que aparece embaixo do título no Google, então ele mostra um trecho qualquer da página",
        weight: 4,
        priority: 40,
      };
    case "old_tech":
      return { label: "Tecnologia antiga", pitch: null, weight: 8, priority: 20 };
    case "builder":
      return { label: `Feito no ${value}`, pitch: null, weight: 5, priority: 10 };
  }
}

// extractSiteSignals devolve frases; aqui elas viram código. HTTPS e celular
// o navegador mede direto, então essas duas frases são ignoradas.
function findingsFromHtmlIssues(issues: string[]): SiteFinding[] {
  const findings: SiteFinding[] = [];
  for (const issue of issues) {
    const builder = issue.match(/^Feito no (.+)$/);
    const outdated = issue.match(/^Rodapé parado em (\d{4})$/);
    const placeholder = issue.match(/^Texto provisório no site: "(.+)"$/);
    if (builder) findings.push({ code: "builder", value: builder[1] });
    else if (placeholder) findings.push({ code: "placeholder_text", value: placeholder[1] });
    else if (outdated) findings.push({ code: "outdated", value: Number(outdated[1]) });
    else if (/^Site em construção|^Domínio estacionado/.test(issue)) findings.push({ code: "construction" });
    else if (/^Página quase sem conteúdo/.test(issue)) findings.push({ code: "empty" });
    else if (/^Tecnologia antiga/.test(issue)) findings.push({ code: "old_tech" });
  }
  return findings;
}

/** Medições → problemas e nota do site. */
export function evaluateSite(metrics: SiteMetrics): { findings: SiteFinding[]; score: number } {
  const findings: SiteFinding[] = [];

  if (metrics.certExpired) findings.push({ code: "cert_expired" });
  else if (!metrics.https) findings.push({ code: "no_https" });

  // O LCP é o que a pessoa vê; o "load" às vezes nunca chega por causa de
  // um script de anúncio pendurado, mesmo com a página já na tela.
  const shownMs = metrics.lcpMs ?? (metrics.timedOut ? null : metrics.loadMs);
  if (shownMs !== null && shownMs > SLOW_LCP_MS) {
    findings.push({ code: "slow", value: secondsOf(shownMs) });
  } else if (shownMs === null && metrics.timedOut) {
    findings.push({ code: "timeout", value: secondsOf(metrics.timeoutMs) });
  }

  if (metrics.viewportWidth > 600) findings.push({ code: "no_viewport" });
  else if (metrics.horizontalScroll) findings.push({ code: "overflow" });

  // Site que atende pelo WhatsApp não precisa de formulário: só é problema
  // quando não há forma nenhuma de contato clicável.
  if (!metrics.mentionsWhatsapp) {
    findings.push({
      code: metrics.hasContactForm || metrics.hasTelLink ? "no_whatsapp" : "no_contact",
    });
  }

  if (!metrics.ogImage) {
    findings.push({ code: "no_preview", value: metrics.description ? "sem_imagem" : "sem_descricao" });
  }
  const title = metrics.title.trim();
  if (!title) findings.push({ code: "no_title" });
  else if (GENERIC_TITLE.test(title) || DEFAULT_TAGLINE.test(title)) {
    findings.push({ code: "generic_title", value: title.slice(0, 60) });
  }
  if (!metrics.description) findings.push({ code: "no_description" });
  if (metrics.weightKb > HEAVY_KB) findings.push({ code: "heavy", value: Math.round(metrics.weightKb) });

  findings.push(...findingsFromHtmlIssues(metrics.htmlIssues));

  const unique = findings.filter(
    (finding, index) => findings.findIndex((other) => other.code === finding.code) === index,
  );
  const penalty = unique.reduce((sum, finding) => sum + describeFinding(finding).weight, 0);
  return { findings: unique, score: Math.max(0, Math.min(100, 100 - penalty)) };
}

function byPriority(a: SiteFinding, b: SiteFinding) {
  return describeFinding(b).priority - describeFinding(a).priority;
}

/** Rótulos para a tabela (vão para site_issues), do mais grave ao menos. */
export function auditLabels(audit: Pick<SiteAudit, "findings">): string[] {
  return [...audit.findings].sort(byPriority).map((finding) => describeFinding(finding).label);
}

/**
 * Os problemas que valem citar para o lead, do mais convincente ao menos.
 * Peso da página some quando já tem "lento": é o mesmo argumento.
 */
export function auditPitches(
  audit: Pick<SiteAudit, "status" | "findings"> | null | undefined,
  max = 3,
): string[] {
  if (!audit || audit.status !== "ok") return [];
  const codes = new Set(audit.findings.map((finding) => finding.code));
  return [...audit.findings]
    .filter((finding) => !(finding.code === "heavy" && (codes.has("slow") || codes.has("timeout"))))
    .sort(byPriority)
    .map((finding) => describeFinding(finding).pitch)
    .filter((pitch): pitch is string => Boolean(pitch))
    .slice(0, max);
}

/**
 * O que a auditoria muda no lead. Inconclusiva só registra a tentativa:
 * não apaga o que a análise simples já tinha achado.
 */
export function buildSiteAuditPatch(audit: SiteAudit, now: Date): Record<string, unknown> {
  const stamped: SiteAudit = { ...audit, measuredAt: now.toISOString() };
  const patch: Record<string, unknown> = {
    site_audit: stamped,
    site_audited_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
  if (audit.status === "inconclusive") return patch;
  patch.site_status = audit.status;
  patch.site_score = audit.score;
  // Fora do ar: o motivo é mais útil que o rótulo genérico ("Site suspenso
  // pela hospedagem"), quando é frase nossa e não erro cru do navegador.
  const friendlyReason = audit.reason && /^(Site|Página|Endereço)/.test(audit.reason) ? audit.reason : null;
  patch.site_issues =
    audit.status === "offline" && friendlyReason ? [friendlyReason] : auditLabels(audit);
  patch.site_checked_at = now.toISOString();
  return patch;
}
