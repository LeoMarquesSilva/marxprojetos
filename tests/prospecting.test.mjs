import assert from "node:assert/strict";
import test from "node:test";
import {
  brPhoneMatchKey,
  brPhoneVariants,
  fillTemplate,
  formatBrPhone,
} from "../src/lib/phone.ts";
import {
  dedupeLeads,
  mapApifyPlace,
  mapGooglePlace,
  mapLocalProspectsBusiness,
  splitViewport,
} from "../src/lib/prospecting/providers.ts";
import {
  extractSiteSignals,
  isSafePublicUrl,
  normalizeSiteUrl,
  socialSiteLabel,
} from "../src/lib/prospecting/site-scan.ts";
import { matchSegment } from "../src/lib/prospecting/segments.ts";
import { scoreProspect } from "../src/lib/prospecting/score.ts";
import {
  applySpintax,
  buyerMoment,
  greetingAt,
  renderProspectMessage,
  shortBusinessName,
  siteDiagnosis,
  templateFor,
  vocativeFor,
} from "../src/lib/prospecting/message.ts";
import {
  DEFAULT_FOLLOWUP_TEMPLATE,
  DEFAULT_PROSPECTING_TEMPLATE,
  DEFAULT_SITE_TEMPLATE,
} from "../src/types/prospecting.ts";
import {
  auditLabels,
  auditPitches,
  buildSiteAuditPatch,
  evaluateSite,
} from "../src/lib/prospecting/site-audit.ts";

// Medição de um site sem nenhum problema; cada teste estraga o que quer.
const GOOD_SITE = {
  https: true,
  certExpired: false,
  timedOut: false,
  timeoutMs: 30000,
  lcpMs: 2100,
  loadMs: 2600,
  weightKb: 1800,
  requests: 40,
  viewportWidth: 390,
  horizontalScroll: false,
  title: "Silva Advogados | Direito Trabalhista em Campinas",
  description: "Escritório de advocacia trabalhista em Campinas.",
  ogImage: "https://silva.adv.br/og.jpg",
  mentionsWhatsapp: true,
  hasContactForm: true,
  hasTelLink: true,
  htmlIssues: [],
};

const AUDITED_LEAD = {
  id: "lead-audit",
  name: "Andrade Advocacia",
  city: "Campinas",
  niche: "advogado trabalhista",
  website: "https://andrade.adv.br",
  site_status: "ok",
  site_issues: [],
  site_audit: {
    status: "ok",
    score: 40,
    findings: [
      { code: "heavy", value: 7300 },
      { code: "no_whatsapp" },
      { code: "slow", value: 9 },
      { code: "builder", value: "Wix" },
      { code: "outdated", value: 2021 },
    ],
  },
};

test("site bom tira nota alta e não gera problema", () => {
  const { findings, score } = evaluateSite(GOOD_SITE);
  assert.deepEqual(findings, []);
  assert.equal(score, 100);
});

test("auditoria transforma a medição em problemas e nota", () => {
  const { findings, score } = evaluateSite({
    ...GOOD_SITE,
    https: false,
    lcpMs: 9400,
    weightKb: 7300,
    viewportWidth: 980,
    mentionsWhatsapp: false,
    ogImage: null,
    description: null,
    title: "Home",
    htmlIssues: ["Feito no Wix", "Rodapé parado em 2019", "Sem HTTPS (navegador avisa \"não seguro\")"],
  });
  const codes = findings.map((finding) => finding.code);
  assert.deepEqual(codes, [
    "no_https",
    "slow",
    "no_viewport",
    "no_whatsapp",
    "no_preview",
    "generic_title",
    "no_description",
    "heavy",
    "builder",
    "outdated",
  ]);
  assert.equal(findings.find((f) => f.code === "slow").value, 9);
  assert.ok(score < 30);
});

test("tempo esgotado sem nada na tela vira 'não abriu'; com LCP, vale o LCP", () => {
  const stuck = evaluateSite({ ...GOOD_SITE, timedOut: true, lcpMs: null, loadMs: null });
  assert.deepEqual(stuck.findings, [{ code: "timeout", value: 30 }]);
  // Página na tela em 3 s, mas um script nunca deixa o "load" terminar.
  const fine = evaluateSite({ ...GOOD_SITE, timedOut: true, lcpMs: 3000, loadMs: null });
  assert.deepEqual(fine.findings, []);
});

test("diagnóstico cita os problemas mais convincentes, sem repetir argumento", () => {
  const pitches = auditPitches(AUDITED_LEAD.site_audit);
  assert.equal(pitches.length, 3);
  assert.match(pitches[0], /^Demora uns 9 segundos para aparecer no celular/);
  assert.match(pitches[1], /botão de WhatsApp/);
  assert.match(pitches[2], /© 2021/);
  // "Pesada" é o mesmo argumento de "lenta"; "feito no Wix" não se diz ao lead.
  assert.ok(!pitches.some((pitch) => /MB|Wix/.test(pitch)));
  assert.equal(auditLabels(AUDITED_LEAD.site_audit)[0], "Lento no celular (9 s)");
  assert.deepEqual(auditPitches({ status: "inconclusive", findings: [{ code: "slow", value: 9 }] }), []);
});

test("quem tem site auditado recebe o modelo com diagnóstico", () => {
  const settings = { template: "SEM SITE {{site}}", siteTemplate: "COM SITE\n{{diagnostico}}", followupTemplate: "FUP" };
  assert.equal(templateFor(settings, AUDITED_LEAD, "primeira"), settings.siteTemplate);
  assert.equal(templateFor(settings, AUDITED_LEAD, "followup"), "FUP");
  assert.equal(templateFor(settings, { ...AUDITED_LEAD, website: null }, "primeira"), settings.template);
  assert.equal(
    templateFor(settings, { ...AUDITED_LEAD, site_status: "offline" }, "primeira"),
    settings.template,
  );
  // Sem auditoria (ou sem nada a citar): modelo de primeiro contato.
  assert.equal(templateFor(settings, { ...AUDITED_LEAD, site_audit: null }, "primeira"), settings.template);

  const message = renderProspectMessage(settings.siteTemplate, AUDITED_LEAD);
  assert.equal(message.split("\n").length, 4);
  assert.match(message, /^COM SITE\n• Demora uns 9 segundos/);
  assert.deepEqual(siteDiagnosis({ ...AUDITED_LEAD, site_status: "offline" }), []);

  // {{site}} no modelo comum também aproveita a auditoria.
  assert.match(
    renderProspectMessage("{{site}}", AUDITED_LEAD),
    /^Abri o site de Andrade Advocacia e reparei que demora uns 9 segundos para aparecer no celular/,
  );
});

test("auditoria inconclusiva não apaga o que a análise simples achou", () => {
  const now = new Date("2026-10-11T12:00:00Z");
  const inconclusive = buildSiteAuditPatch(
    { status: "inconclusive", reason: "HTTP 403", score: null, findings: [] },
    now,
  );
  assert.equal(inconclusive.site_issues, undefined);
  assert.equal(inconclusive.site_score, undefined);
  assert.equal(inconclusive.site_audited_at, now.toISOString());

  const measured = buildSiteAuditPatch(AUDITED_LEAD.site_audit, now);
  assert.equal(measured.site_score, 40);
  assert.equal(measured.site_status, "ok");
  assert.equal(measured.site_issues[0], "Lento no celular (9 s)");
});
import { hostingPlaceholder } from "../src/lib/prospecting/site-scan.ts";
import { isFollowupDue } from "../src/lib/prospecting/followup.ts";
import {
  gridAround,
  parseMapsCard,
  parseMapsPlaceUrl,
} from "../src/lib/prospecting/maps-scraper.ts";
import { searchTermsFor } from "../src/lib/prospecting/segments.ts";

const CARD_HREF =
  "https://www.google.com/maps/place/Dra.+Carolina+Resende/data=!4m7!3m6!1s0x94c8c92bd64e0c07:0xa20eaa771c1de1d!8m2!3d-22.9045159!4d-47.0572795!16s%2Fg%2F11xcj9vwhv!19sChIJBwxO1ivJyJQRHd7BcafqIAo?authuser=0&hl=pt-BR&rclk=1";

test("lê place_id, coordenadas e link limpo do endereço do Maps", () => {
  const parsed = parseMapsPlaceUrl(CARD_HREF);
  assert.equal(parsed.placeId, "ChIJBwxO1ivJyJQRHd7BcafqIAo");
  assert.equal(parsed.lat, -22.9045159);
  assert.equal(parsed.lng, -47.0572795);
  assert.ok(!parsed.cleanUrl.includes("?"));
  // Sem o !19s, cai no id interno.
  assert.equal(
    parseMapsPlaceUrl("https://www.google.com/maps/place/X/data=!1s0x94c8:0x79a").placeId,
    "fid:0x94c8:0x79a",
  );
});

test("lê um card da lista do Maps (texto real)", () => {
  const lead = parseMapsCard({
    name: "Dra. Carolina Resende",
    href: CARD_HREF,
    website: "https://www.carolinaresendeadvogada.com.br/",
    text: "Dra. Carolina Resende\nDra. Carolina Resende\n5,0(21)\nAdvogado criminal ·  · R. Conceição, 233\nAberto 24 horas · (19) 99963-0953\n\nWebsite\n\nRotas\n \n\"Excelente advogada.\"",
  });
  assert.equal(lead.placeId, "ChIJBwxO1ivJyJQRHd7BcafqIAo");
  assert.equal(lead.rating, 5);
  assert.equal(lead.ratingCount, 21);
  assert.equal(lead.category, "Advogado criminal");
  assert.equal(lead.address, "R. Conceição, 233");
  assert.equal(lead.phone, "(19) 99963-0953");
  assert.equal(lead.website, "https://www.carolinaresendeadvogada.com.br/");
  assert.equal(lead.closed, false);
});

test("card patrocinado, sem avaliação e fechado", () => {
  const sponsored = parseMapsCard({
    name: "FF | Advogados",
    href: CARD_HREF,
    website: null,
    text: "FF | Advogados\nPatrocinado\n\nFF | Advogados\n5,0\nAdvogado criminal · 587 Rua Doutor Barbosa da Cunha\nAberto 24 horas · (19) 3383-7590",
  });
  assert.equal(sponsored.rating, 5);
  assert.equal(sponsored.ratingCount, null);
  assert.equal(sponsored.phone, "(19) 3383-7590");
  assert.equal(sponsored.website, null);

  const closed = parseMapsCard({
    name: "Escritório Antigo",
    href: CARD_HREF,
    website: null,
    text: "Escritório Antigo\nNenhuma avaliação\nAdvogado · Rua X, 10\nFechado permanentemente",
  });
  assert.equal(closed.closed, true);
  assert.equal(closed.category, "Advogado");
  assert.equal(closed.phone, null);
  assert.equal(parseMapsCard({ name: "Sem id", href: "https://x", website: null, text: "" }), null);
});

test("grade da varredura em volta do centro da cidade", () => {
  const points = gridAround({ lat: -22.9, lng: -47.06 }, 3, 0.05);
  assert.equal(points.length, 9);
  assert.deepEqual(points[4], { lat: -22.9, lng: -47.06 });
  assert.deepEqual(points[0], { lat: -22.95, lng: -47.11 });
});

test("termos da busca ampla vêm do segmento do portfólio", () => {
  assert.deepEqual(searchTermsFor("advogado criminalista", "padrao"), ["advogado criminalista"]);
  const ampla = searchTermsFor("advogado criminalista", "ampla");
  assert.equal(ampla[0], "advogado criminalista");
  assert.ok(ampla.includes("advocacia criminal"));
  assert.ok(ampla.length <= 4);
});
import { parseCsv, pickColumn } from "../src/lib/csv.ts";

test("lê CSV do Excel em português (;) e reconhece colunas de várias ferramentas", () => {
  const rows = parseCsv('﻿title;Telefone;website\n"Silva; Costa";(19) 99999-1111;silva.adv.br\n');
  assert.equal(rows.length, 1);
  assert.equal(pickColumn(rows[0], ["business_name", "name", "title"]), "Silva; Costa");
  assert.equal(pickColumn(rows[0], ["phone", "telefone"]), "(19) 99999-1111");
  assert.equal(pickColumn(rows[0], ["email"]), null);
  assert.equal(parseCsv("a,b\n1,2")[0].b, "2");
});

test("follow-up aparece 3 dias depois do último toque e para no limite", () => {
  const now = new Date("2026-10-09T12:00:00Z");
  const base = {
    status: "contatado",
    contacted_at: "2026-10-05T12:00:00Z",
    replied_at: null,
    last_followup_at: null,
    followup_count: 0,
  };
  assert.equal(isFollowupDue(base, now), true);
  assert.equal(isFollowupDue({ ...base, contacted_at: "2026-10-08T12:00:00Z" }, now), false);
  assert.equal(isFollowupDue({ ...base, replied_at: "2026-10-06T12:00:00Z" }, now), false);
  assert.equal(isFollowupDue({ ...base, status: "respondeu" }, now), false);
  assert.equal(
    isFollowupDue({ ...base, last_followup_at: "2026-10-08T12:00:00Z", followup_count: 1 }, now),
    false,
  );
  assert.equal(isFollowupDue({ ...base, followup_count: 2 }, now), false);
});

test("casa celular com e sem o nono dígito", () => {
  assert.equal(brPhoneMatchKey("(19) 98198-4137"), brPhoneMatchKey("551981984137"));
  assert.equal(
    brPhoneMatchKey("5519981984137@s.whatsapp.net"),
    brPhoneMatchKey("551981984137@s.whatsapp.net"),
  );
  // Fixo não colide com celular de mesmo final.
  assert.notEqual(brPhoneMatchKey("(19) 3198-4137"), brPhoneMatchKey("(19) 98198-4137"));
  assert.equal(brPhoneMatchKey("123"), null);
});

test("lista as duas grafias de um celular e uma de fixo", () => {
  assert.deepEqual(brPhoneVariants("(19) 98198-4137"), ["5519981984137", "551981984137"]);
  assert.deepEqual(brPhoneVariants("551981984137"), ["551981984137", "5519981984137"]);
  assert.deepEqual(brPhoneVariants("(11) 3456-7890"), ["551134567890"]);
});

test("formata e164 para exibição", () => {
  assert.equal(formatBrPhone("5519981984137"), "(19) 98198-4137");
  assert.equal(formatBrPhone("551134567890"), "(11) 3456-7890");
});

test("preenche os placeholders novos do modelo", () => {
  const result = fillTemplate("{{saudacao}}! {{nome}} ({{nicho}}) — veja {{caso}}: {{caso_link}}", {
    nome: "Acme",
    cidade: "Campinas",
    hasSite: true,
    nicho: "advocacia",
    caso: "Outeiral Advocacia",
    casoLink: "https://outeiraladvocacia.com.br",
    saudacao: "Boa tarde",
  });
  assert.equal(
    result,
    "Boa tarde! Acme (advocacia) — veja Outeiral Advocacia: https://outeiraladvocacia.com.br",
  );
});

test("mapeia um lugar da Places API (New)", () => {
  const lead = mapGooglePlace({
    id: "ChIJabc",
    displayName: { text: "Silva Advogados" },
    formattedAddress: "R. X, 10 - Campinas - SP",
    nationalPhoneNumber: "(19) 98198-4137",
    websiteUri: "https://silva.adv.br/",
    rating: 4.8,
    userRatingCount: 52,
    googleMapsUri: "https://maps.google.com/?cid=1",
    businessStatus: "OPERATIONAL",
    primaryTypeDisplayName: { text: "Advogado criminalista" },
  });
  assert.equal(lead.placeId, "ChIJabc");
  assert.equal(lead.name, "Silva Advogados");
  assert.equal(lead.phone, "(19) 98198-4137");
  assert.equal(lead.ratingCount, 52);
  assert.equal(lead.category, "Advogado criminalista");
  assert.equal(lead.closed, false);
  assert.equal(mapGooglePlace({ id: "x" }), null);
  assert.equal(
    mapGooglePlace({ id: "y", displayName: { text: "Fechado" }, businessStatus: "CLOSED_PERMANENTLY" })
      .closed,
    true,
  );
});

test("mapeia um item do robô do Apify com contatos", () => {
  const lead = mapApifyPlace({
    placeId: "ChIJdef",
    title: "Clínica Vida",
    phone: "+55 19 3232-1010",
    website: "https://clinicavida.com.br",
    totalScore: 4.6,
    reviewsCount: 120,
    url: "https://www.google.com/maps/place/x",
    categoryName: "Clínica médica",
    emails: ["contato@clinicavida.com.br"],
    instagrams: ["https://www.instagram.com/clinicavida"],
    permanentlyClosed: false,
  });
  assert.equal(lead.email, "contato@clinicavida.com.br");
  assert.equal(lead.instagram, "https://www.instagram.com/clinicavida");
  assert.equal(lead.rating, 4.6);
  assert.equal(mapApifyPlace({ title: "Sem id" }), null);
});

test("mapeia LocalProspects e junta duplicados preservando dados", () => {
  const a = mapLocalProspectsBusiness({ place_id: "p1", name: "A", phone: "1999", reviews: 3 });
  const b = { ...a, phone: null, email: "a@a.com.br" };
  const [merged, ...rest] = dedupeLeads([a, b]);
  assert.equal(rest.length, 0);
  assert.equal(merged.phone, "1999");
  assert.equal(merged.email, "a@a.com.br");
});

test("divide o retângulo da cidade em quadrantes", () => {
  const tiles = splitViewport(
    { low: { latitude: 0, longitude: 0 }, high: { latitude: 3, longitude: 3 } },
    3,
  );
  assert.equal(tiles.length, 9);
  assert.deepEqual(tiles[4], {
    low: { latitude: 1, longitude: 1 },
    high: { latitude: 2, longitude: 2 },
  });
});

test("extrai contatos e problemas do HTML do site", () => {
  const html = `<!doctype html><html><head><title>Silva</title></head><body>
    <a href="https://wa.me/5519981984137?text=oi">WhatsApp</a>
    <a href="mailto:contato@silva.adv.br">e-mail</a>
    <a href="https://www.instagram.com/silva.adv/">Insta</a>
    <a href="https://www.facebook.com/sharer.php?u=x">compartilhar</a>
    <a href="https://www.facebook.com/silvaadv">Face</a>
    <img src="logo@2x.png">
    <p>${"Texto institucional do escritório. ".repeat(20)}</p>
    <footer>© 2019 Silva Advogados</footer></body></html>`;
  const result = extractSiteSignals(html, {
    url: "http://silva.adv.br",
    https: false,
    now: new Date("2026-10-09T12:00:00Z"),
  });
  assert.equal(result.whatsapp, "5519981984137");
  assert.deepEqual(result.emails, ["contato@silva.adv.br"]);
  assert.equal(result.instagram, "https://www.instagram.com/silva.adv");
  assert.equal(result.facebook, "https://www.facebook.com/silvaadv");
  assert.ok(result.issues.some((issue) => issue.startsWith("Sem HTTPS")));
  assert.ok(result.issues.includes("Não é adaptado ao celular"));
  assert.ok(result.issues.includes("Rodapé parado em 2019"));
});

test("site bom não gera problema", () => {
  const html = `<html><head><meta name="viewport" content="width=device-width"></head>
    <body><p>${"Conteúdo. ".repeat(80)}</p><footer>© 2026</footer></body></html>`;
  const result = extractSiteSignals(html, {
    url: "https://bom.com.br",
    https: true,
    now: new Date("2026-10-09T12:00:00Z"),
  });
  assert.deepEqual(result.issues, []);
});

test("rede social no lugar do site e URLs perigosas", () => {
  assert.equal(socialSiteLabel("https://instagram.com/escritorio"), "Instagram");
  assert.equal(socialSiteLabel("https://linktr.ee/escritorio"), "Linktree");
  assert.equal(socialSiteLabel("https://escritorio.com.br"), null);
  assert.equal(isSafePublicUrl("http://169.254.169.254/latest"), false);
  assert.equal(isSafePublicUrl("http://localhost:3000"), false);
  assert.equal(isSafePublicUrl("file:///etc/passwd"), false);
  assert.equal(normalizeSiteUrl("escritorio.com.br"), "https://escritorio.com.br");
});

test("reconhece o segmento do portfólio sem confundir nichos", () => {
  assert.equal(matchSegment({ niche: "advogado criminalista" })?.id, "advocacia-criminal");
  assert.equal(matchSegment({ niche: "escritório de advocacia" })?.id, "advocacia-geral");
  assert.equal(matchSegment({ niche: "clínica médica" })?.id, "clinicas");
  assert.equal(matchSegment({ niche: "advogado direito médico" })?.id, "direito-medico");
  assert.equal(matchSegment({ niche: "medicina do trabalho" })?.id, "rh-nr1");
  // "jurídico" não é "júri": escritório genérico e agência não viram criminal.
  assert.equal(matchSegment({ niche: "escritório jurídico" })?.id, "advocacia-geral");
  assert.equal(
    matchSegment({ niche: "agência de marketing jurídico" })?.id,
    "marketing-juridico",
  );
  assert.equal(matchSegment({ niche: "advogado tribunal do júri" })?.id, "advocacia-criminal");
  // "Empresarial" sem contexto jurídico não é advocacia.
  assert.equal(matchSegment({ niche: "contabilidade empresarial" }), null);
  assert.equal(matchSegment({ niche: "padaria" }), null);
});

test("prioriza lead do portfólio, sem site e com WhatsApp", () => {
  const hot = scoreProspect({
    name: "Silva Advogados",
    niche: "advogado criminalista",
    website: null,
    phone_e164: "5519981984137",
    is_mobile: true,
    has_whatsapp: true,
    rating: 4.8,
    rating_count: 60,
    email: null,
  });
  assert.equal(hot.tier, "quente");
  assert.ok(hot.reasons.includes("Sem site"));
  assert.ok(hot.reasons.includes("WhatsApp confirmado"));

  const cold = scoreProspect({
    name: "Padaria",
    niche: "padaria",
    website: "https://padaria.com.br",
    site_status: "ok",
    site_issues: [],
    phone_e164: null,
    is_mobile: false,
    has_whatsapp: null,
    rating: null,
    rating_count: null,
    email: null,
  });
  assert.equal(cold.tier, "frio");
  assert.ok(cold.score < hot.score);
});

test("spintax é estável por lead e varia entre leads", () => {
  const text = "{Oi|Olá|E aí|Bom dia|Opa}, {{nome}}";
  assert.equal(applySpintax(text, "lead-1"), applySpintax(text, "lead-1"));
  const outputs = new Set(
    Array.from({ length: 20 }, (_, i) => applySpintax(text, `lead-${i}`)),
  );
  assert.ok(outputs.size > 1);
  assert.ok(!applySpintax(text, "x").includes("|"));
  assert.ok(applySpintax(text, "x").endsWith("{{nome}}"));
  assert.match(applySpintax("{a|{b|c}}", "y"), /^[abc]$/);
});

test("saudação pelo horário de Brasília", () => {
  assert.equal(greetingAt(new Date("2026-10-09T12:00:00Z")), "Bom dia"); // 09h
  assert.equal(greetingAt(new Date("2026-10-09T18:00:00Z")), "Boa tarde"); // 15h
  assert.equal(greetingAt(new Date("2026-10-09T23:30:00Z")), "Boa noite"); // 20h30
});

test("mensagem cita o caso parecido e o problema do site", () => {
  const message = renderProspectMessage(
    "{{saudacao}}! {{site}} Fizemos {{caso}}.",
    {
      id: "lead-9",
      name: "Silva Advogados",
      city: "Campinas",
      niche: "advogado criminalista",
      website: "https://silva.adv.br",
      site_status: "offline",
      site_issues: ["Site fora do ar"],
    },
    { now: new Date("2026-10-09T12:00:00Z") },
  );
  assert.equal(
    message,
    "Bom dia! Tentei abrir o site de Silva Advogados e ele está fora do ar: quem procura vocês no Google cai numa página de erro. Fizemos Outeiral Advocacia (outeiraladvocacia.com.br).",
  );
});

test("nota do lead soma necessidade, porte, encaixe e contato", () => {
  const base = {
    name: "Andrade Advocacia",
    niche: "advogado trabalhista",
    website: "https://andrade.adv.br",
    site_status: "ok",
    site_issues: ["Lento no celular (9 s)"],
    phone_e164: "5519981984137",
    is_mobile: true,
    has_whatsapp: true,
    rating: 4.9,
    rating_count: 120,
    email: "contato@andrade.adv.br",
  };
  const badSite = scoreProspect({ ...base, site_score: 20 });
  assert.deepEqual(
    badSite.parts.map((part) => [part.key, part.points]),
    [
      ["precisa", 32],
      ["porte", 25],
      ["encaixe", 15],
      ["contato", 20],
    ],
  );
  assert.equal(badSite.score, 92);
  assert.equal(badSite.tier, "quente");
  assert.ok(badSite.reasons.includes("Nota do site: 20/100"));

  // Mesmo escritório com site bom: não precisa da INSYT, cai bastante.
  const goodSite = scoreProspect({ ...base, site_score: 95, site_issues: [] });
  assert.equal(goodSite.parts[0].points, 2);
  assert.ok(goodSite.score < badSite.score - 25);
});

test("site que atende pelo WhatsApp não é cobrado por falta de formulário", () => {
  const whatsappOnly = evaluateSite({ ...GOOD_SITE, hasContactForm: false, hasTelLink: false });
  assert.deepEqual(whatsappOnly.findings, []);
  const noContact = evaluateSite({
    ...GOOD_SITE,
    mentionsWhatsapp: false,
    hasContactForm: false,
    hasTelLink: false,
  });
  assert.deepEqual(noContact.findings, [{ code: "no_contact" }]);
  const formOnly = evaluateSite({ ...GOOD_SITE, mentionsWhatsapp: false, hasTelLink: false });
  assert.deepEqual(formOnly.findings, [{ code: "no_whatsapp" }]);
});

test("nome curto tira a palavra-chave que o Google Maps acumula", () => {
  const cases = [
    [
      "Escritório de advocacia Dra. Janaina Giacometti - Advogado Especialista em Direito De Família e Direito da Saúde em Campinas",
      "Dra. Janaina Giacometti",
    ],
    ["Dra.Thamires Bolivar | Advogada Criminalista", "Dra.Thamires Bolivar"],
    ["João Felipe Advogado, Direito de Família, Divórcio, Campinas/SP", "João Felipe Advogado"],
    ["SALERNO & SOARES - Especialistas em Direito da Saúde", "SALERNO & SOARES"],
    ["Advocacia Lacerda Rodrigues", "Advocacia Lacerda Rodrigues"],
    ["Silva-Costa Advogados", "Silva-Costa Advogados"],
    ["Escritório de Advocacia", "Escritório de Advocacia"],
  ];
  for (const [full, short] of cases) assert.equal(shortBusinessName(full), short);
  assert.match(
    renderProspectMessage("{{nome}}", { id: "x", name: cases[0][0], city: "Campinas", niche: "advogado", website: null }),
    /^Dra\. Janaina Giacometti$/,
  );
});

test("vocativo só quando o nome é de uma pessoa", () => {
  assert.equal(vocativeFor("Escritório de advocacia Dra. Janaina Giacometti - Advogado Especialista"), ", Dra. Janaina");
  assert.equal(vocativeFor("Dra.Thamires Bolivar | Advogada Criminalista"), ", Dra. Thamires");
  assert.equal(vocativeFor("Dr. Valdécio - Advogado"), ", Dr. Valdécio");
  assert.equal(vocativeFor("João Felipe Advogado, Direito de Família"), ", Dr. João");
  assert.equal(vocativeFor("Advogada Ana Paula Souza"), ", Dra. Ana");
  assert.equal(vocativeFor("Silva & Costa Advogados"), "");
  assert.equal(vocativeFor("Advocacia Lacerda Rodrigues"), "");
  assert.equal(vocativeFor("Giovanni Costa Silva - Advogado Criminal"), ", Dr. Giovanni");
  assert.equal(vocativeFor("Victória Andrade Advogada Criminalista"), ", Dra. Victória");
  assert.equal(vocativeFor("Andre Santos Advogados"), "");
  assert.equal(vocativeFor("Oscar Silvestre Filho - Advocacia e Consultoria Jurídica"), "");
  assert.equal(vocativeFor("Escritório Central - Advogado Trabalhista"), "");
});

test("momento do cliente final muda com a área", () => {
  const moment = (niche, name = "X") => buyerMoment({ niche, name, category: null });
  assert.match(moment("advogado criminalista"), /^Na área criminal/);
  assert.match(moment("escritório de advocacia", "Dra. Ana - Direito de Família"), /^Em direito de família/);
  assert.match(moment("advogado previdenciário"), /^Na área previdenciária/);
  assert.match(moment("advogado trabalhista"), /^Na área trabalhista/);
  assert.match(moment("advogado tributarista"), /^Empresário/);
  assert.match(moment("escritório de advocacia"), /pesquisa o escritório no Google/);
});

test("primeira mensagem: observação concreta, área, case e uma pergunta só", () => {
  const settings = {
    template: DEFAULT_PROSPECTING_TEMPLATE,
    siteTemplate: DEFAULT_SITE_TEMPLATE,
    followupTemplate: DEFAULT_FOLLOWUP_TEMPLATE,
  };
  const now = new Date("2026-10-13T17:00:00Z");
  const lead = {
    ...AUDITED_LEAD,
    name: "Dra. Paula Andrade - Advogada Trabalhista em Campinas",
  };
  const message = renderProspectMessage(templateFor(settings, lead, "primeira"), lead, { now });
  const [greeting, observation, pitch] = message.split("\n\n");
  assert.match(greeting, /^Boa tarde, Dra\. Paula! Tudo (bem|certo)\?$/);
  assert.match(observation, /^Abri o seu site e reparei que demora uns 9 segundos/);
  assert.match(observation, /Na área trabalhista/);
  assert.match(pitch, /da INSYT: fazemos sites para escritórios de advocacia, como o de /);
  // Três problemas citáveis: um na abertura, dois guardados para a resposta.
  assert.match(pitch, /mais dois pontos desse tipo no site\./);
  assert.equal((message.match(/\?/g) ?? []).length, 2); // "Tudo bem?" + a pergunta final
  assert.ok(!/https?:\/\//.test(message), "sem link na primeira mensagem");
  assert.ok(message.split(/\s+/).length < 110, "curta o bastante para ler no celular");

  const noSite = renderProspectMessage(
    settings.template,
    { id: "s", name: "Silva & Costa Advogados", city: "Campinas", niche: "advogado criminalista", website: null, rating: 4.8, rating_count: 64 },
    { now },
  );
  assert.match(noSite, /^Boa tarde! /);
  assert.match(noSite, /Vi o perfil de Silva & Costa Advogados no Google, com nota 4,8 em 64 avaliações, mas sem link para um site\./);
  assert.match(noSite, /como ficaria o de vocês\?$/);
});

test("follow-up traz um ponto novo e o último se despede", () => {
  const first = renderProspectMessage(DEFAULT_FOLLOWUP_TEMPLATE, { ...AUDITED_LEAD, followup_count: 0 });
  assert.match(first, /outra coisa que reparei é que não tem botão de WhatsApp/);
  const last = renderProspectMessage(DEFAULT_FOLLOWUP_TEMPLATE, { ...AUDITED_LEAD, followup_count: 1 });
  assert.match(last, /não vou insistir/);
  assert.match(last, /te mando a lista completa/);
  const noSite = renderProspectMessage(DEFAULT_FOLLOWUP_TEMPLATE, {
    id: "n",
    name: "Silva & Costa Advogados",
    city: "Campinas",
    niche: "advogado criminalista",
    website: null,
  });
  assert.match(noSite, /posso te mandar o que fizemos para /);
  assert.ok(!/ [!?.,]/.test(noSite.replace(/\n/g, " ")), "sem espaço antes de pontuação");
});

test("nota no Google sem contagem pública vale porte moderado", () => {
  const lead = {
    name: "Filipe Ramasco Advogado",
    niche: "advogado trabalhista",
    website: null,
    phone_e164: "5519999999999",
    is_mobile: true,
    has_whatsapp: null,
    rating: 5,
    rating_count: null,
    email: null,
  };
  const porte = scoreProspect(lead).parts.find((part) => part.key === "porte");
  assert.equal(porte.points, 12);
  assert.equal(scoreProspect({ ...lead, rating: null }).parts.find((p) => p.key === "porte").points, 0);
  assert.equal(scoreProspect({ ...lead, rating_count: 120 }).parts.find((p) => p.key === "porte").points, 25);
});

test("lento logo acima do limite não soa contraditório", () => {
  const [pitch] = auditPitches({ status: "ok", findings: [{ code: "slow", value: 4 }] });
  assert.match(pitch, /^Demora mais de 4 segundos para aparecer no celular/);
  assert.match(auditPitches({ status: "ok", findings: [{ code: "slow", value: 9 }] })[0], /uns 9 segundos/);
});

test("conta suspensa e página padrão da hospedagem contam como fora do ar", () => {
  assert.equal(
    hostingPlaceholder("https://abrahaoecamposadv.com.br/cgi-sys/suspendedpage.cgi", "<html></html>"),
    "Site suspenso pela hospedagem",
  );
  assert.equal(
    hostingPlaceholder("https://x.com.br/", "<title>Account Suspended</title><h1>This Account has been suspended.</h1>"),
    "Site suspenso pela hospedagem",
  );
  assert.equal(
    hostingPlaceholder("https://x.com.br/", "<title>Index of /</title><h1>Index of /</h1>"),
    "Página padrão da hospedagem (sem site)",
  );
  assert.equal(hostingPlaceholder("https://x.com.br/", "<title>Silva Advogados</title><p>Direito trabalhista</p>"), null);
});

test("página padrão do cPanel e 'não encontrada' com HTTP 200", () => {
  assert.equal(
    hostingPlaceholder("http://x.com.br/cgi-sys/defaultwebpage.cgi", "<title>Ops!</title>"),
    "Página padrão da hospedagem (sem site)",
  );
  assert.equal(
    hostingPlaceholder("https://x.com.br/a/", "<title>Página não encontrada - MeChamenoZAP!</title>"),
    "Site fora do ar (página não encontrada)",
  );
});

test("texto provisório do modelo vira argumento", () => {
  const { findings } = evaluateSite({
    ...GOOD_SITE,
    htmlIssues: ['Texto provisório no site: "Neste espaço podemos inserir o texto de acordo com o título acima"'],
  });
  assert.deepEqual(findings, [
    { code: "placeholder_text", value: "Neste espaço podemos inserir o texto de acordo com o título acima" },
  ]);
  assert.match(auditPitches({ status: "ok", findings })[0], /^Ainda aparece texto provisório do modelo no site \("Neste espaço/);
});
