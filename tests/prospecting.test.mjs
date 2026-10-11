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
  greetingAt,
  renderProspectMessage,
} from "../src/lib/prospecting/message.ts";
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
    "Bom dia! Tentei abrir o site de Silva Advogados e ele está fora do ar — quem pesquisa no Google acaba indo para o concorrente. Fizemos Outeiral Advocacia (outeiraladvocacia.com.br).",
  );
});
