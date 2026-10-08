import assert from "node:assert/strict";
import test from "node:test";
import { adSourceLabel, extractAdReferral } from "../src/lib/ad-referral.ts";
import {
  actionValue,
  buildCampaignRows,
  countHashtags,
  formatBrDateTime,
  isPostDue,
  rangeDates,
  rangeToUnix,
  resolveRange,
  storageSafeName,
  summarizeCampaigns,
  validatePostDraft,
} from "../src/lib/marketing.ts";

const adReply = {
  title: "Site profissional para advogados",
  body: "Fale com a INSYT",
  mediaType: "IMAGE",
  sourceType: "ad",
  sourceId: "120210000000000001",
  sourceUrl: "https://fb.me/abc",
  ctwaClid: "Afc_clid",
};

test("lê o anúncio de origem dentro de extendedTextMessage", () => {
  const referral = extractAdReferral({
    key: { remoteJid: "5511999999999@s.whatsapp.net", fromMe: false },
    message: {
      extendedTextMessage: {
        text: "Olá! Quero saber mais.",
        contextInfo: { externalAdReply: adReply },
      },
    },
  });
  assert.deepEqual(referral, {
    adId: "120210000000000001",
    title: "Site profissional para advogados",
    body: "Fale com a INSYT",
    sourceUrl: "https://fb.me/abc",
    ctwaClid: "Afc_clid",
  });
});

test("lê o contextInfo que a Evolution sobe para a raiz do evento", () => {
  const referral = extractAdReferral({
    message: { conversation: "Oi" },
    contextInfo: {
      conversionSource: "FB_Ads",
      externalAdReply: { ...adReply, sourceType: undefined },
    },
  });
  assert.equal(referral?.adId, "120210000000000001");
});

test("desembrulha mensagem temporária antes de procurar o anúncio", () => {
  const referral = extractAdReferral({
    message: {
      ephemeralMessage: {
        message: {
          extendedTextMessage: { text: "Oi", contextInfo: { externalAdReply: adReply } },
        },
      },
    },
  });
  assert.equal(referral?.title, "Site profissional para advogados");
});

test("link compartilhado com prévia não é anúncio", () => {
  assert.equal(
    extractAdReferral({
      message: {
        extendedTextMessage: {
          text: "olha https://exemplo.com",
          contextInfo: {
            externalAdReply: { title: "Exemplo", sourceUrl: "https://exemplo.com" },
          },
        },
      },
    }),
    null,
  );
  assert.equal(extractAdReferral({ message: { conversation: "oi" } }), null);
  assert.equal(extractAdReferral(null), null);
});

test("rótulo da origem no CRM usa o título do anúncio", () => {
  assert.equal(adSourceLabel({ title: "Promo", adId: "1", body: null, sourceUrl: null, ctwaClid: null }), "Anúncio · Promo");
  assert.equal(adSourceLabel({ title: null, adId: "1", body: null, sourceUrl: null, ctwaClid: null }), "Anúncio");
});

test("janela de datas termina hoje e conta o dia de hoje", () => {
  assert.deepEqual(rangeDates(7, "2026-10-08"), { since: "2026-10-02", until: "2026-10-08" });
  assert.deepEqual(rangeDates(30, "2026-03-01"), { since: "2026-01-31", until: "2026-03-01" });
  const unix = rangeToUnix({ since: "2026-10-02", until: "2026-10-08" });
  assert.equal(unix.until - unix.since, 7 * 86400);
});

test("faixa de dias só aceita as opções da tela", () => {
  assert.equal(resolveRange("7", [7, 28], 28), 7);
  assert.equal(resolveRange("365", [7, 28], 28), 28);
  assert.equal(resolveRange(undefined, [7, 30, 90], 30), 30);
});

const image = { path: "posts/a.jpg", url: "https://x/a.jpg", type: "image" };
const video = { path: "posts/a.mp4", url: "https://x/a.mp4", type: "video" };

test("valida post do jeito que a Meta valida", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  assert.equal(validatePostDraft({ kind: "imagem", caption: "oi", media: [image], scheduledAt: null }, now), null);
  assert.match(validatePostDraft({ kind: "imagem", caption: "", media: [], scheduledAt: null }, now), /uma imagem/);
  assert.match(validatePostDraft({ kind: "reels", caption: "", media: [image], scheduledAt: null }, now), /um vídeo/);
  assert.match(validatePostDraft({ kind: "carrossel", caption: "", media: [image], scheduledAt: null }, now), /2 a 10/);
  assert.match(validatePostDraft({ kind: "carrossel", caption: "", media: [image, video], scheduledAt: null }, now), /só fotos/);
  assert.match(validatePostDraft({ kind: "imagem", caption: "x".repeat(2201), media: [image], scheduledAt: null }, now), /2200/);
  const tags = Array.from({ length: 31 }, (_, index) => `#tag${index}`).join(" ");
  assert.match(validatePostDraft({ kind: "imagem", caption: tags, media: [image], scheduledAt: null }, now), /30 hashtags/);
  assert.match(
    validatePostDraft({ kind: "imagem", caption: "", media: [image], scheduledAt: "2026-10-08T11:00:00Z" }, now),
    /à frente/,
  );
  assert.equal(
    validatePostDraft({ kind: "imagem", caption: "", media: [image], scheduledAt: "2026-10-09T11:00:00Z" }, now),
    null,
  );
});

test("conta hashtags com acento e ignora # no meio de palavra", () => {
  assert.equal(countHashtags("#marketing #advocacia #direitoCivil #ação"), 4);
  assert.equal(countHashtags("item#1 e C#"), 0);
});

test("post vence quando o horário passou ou está processando", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  assert.equal(isPostDue({ status: "agendado", scheduled_at: "2026-10-08T11:59:00Z" }, now), true);
  assert.equal(isPostDue({ status: "agendado", scheduled_at: "2026-10-08T12:30:00Z" }, now), false);
  assert.equal(isPostDue({ status: "publicando", scheduled_at: null }, now), true);
  assert.equal(isPostDue({ status: "rascunho", scheduled_at: "2026-10-01T00:00:00Z" }, now), false);
});

test("soma só as ações pedidas", () => {
  const actions = [
    { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "12" },
    { action_type: "link_click", value: "40" },
    { action_type: "lead", value: 3 },
  ];
  assert.equal(actionValue(actions, ["onsite_conversion.messaging_conversation_started_7d"]), 12);
  assert.equal(actionValue(actions, ["lead", "onsite_conversion.lead_grouped"]), 3);
  assert.equal(actionValue(undefined, ["lead"]), 0);
});

test("cruza gasto da campanha com leads e fechamentos do CRM", () => {
  const rows = buildCampaignRows(
    [
      { id: "c1", name: "Advogados SP", status: "ACTIVE", effective_status: "ACTIVE", daily_budget: "3000" },
      { id: "c2", name: "Antiga", status: "PAUSED", effective_status: "PAUSED" },
      { id: "c3", name: "Clínicas", status: "PAUSED", effective_status: "PAUSED" },
    ],
    [
      {
        campaign_id: "c1",
        spend: "300.00",
        impressions: "10000",
        clicks: "200",
        actions: [{ action_type: "onsite_conversion.messaging_conversation_started_7d", value: "20" }],
      },
      { campaign_id: "c3", spend: "100", impressions: "5000", clicks: "50" },
    ],
    new Map([
      ["ad1", "c1"],
      ["ad2", "c1"],
      ["ad3", "c3"],
    ]),
    [
      { ad_id: "ad1", stage: "fechado", value: "1297.00" },
      { ad_id: "ad2", stage: "em_conversa", value: null },
      { ad_id: "ad2", stage: "perdido", value: null },
      { ad_id: "desconhecido", stage: "fechado", value: 999 },
    ],
  );

  assert.deepEqual(rows.map((row) => row.id), ["c1", "c3"]);
  const advogados = rows[0];
  assert.equal(advogados.dailyBudget, 30);
  assert.equal(advogados.conversations, 20);
  assert.equal(advogados.crmLeads, 3);
  assert.equal(advogados.crmClosed, 1);
  assert.equal(advogados.crmRevenue, 1297);

  const summary = summarizeCampaigns(rows);
  assert.equal(summary.spend, 400);
  assert.equal(summary.costPerConversation, 20);
  assert.equal(summary.costPerCrmLead, 400 / 3);
  assert.equal(summary.costPerClose, 400);
  assert.equal(summary.roas, 1297 / 400);
  assert.equal(summary.ctr, (250 * 100) / 15000);
});

test("nome de arquivo do bucket sem acento nem espaço", () => {
  assert.equal(storageSafeName("Post Ação Final.PNG"), "post-acao-final.png");
  assert.equal(storageSafeName("???.jpg"), "arquivo.jpg");
});

test("datas da tela saem no horário de Brasília mesmo com servidor em UTC", () => {
  assert.equal(formatBrDateTime("2026-10-08T21:30:00Z"), "08/10 às 18:30");
});
