import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWaMeUrl,
  fillTemplate,
  normalizeBrPhone,
} from "../src/lib/phone.ts";
import { extractWhatsAppText } from "../src/lib/whatsapp-message.ts";

test("normaliza telefones brasileiros formatados e com DDI", () => {
  assert.deepEqual(normalizeBrPhone("(19) 98198-4137"), {
    e164: "5519981984137",
    isMobile: true,
  });
  assert.deepEqual(normalizeBrPhone("+55 11 3456-7890"), {
    e164: "551134567890",
    isMobile: false,
  });
  assert.deepEqual(normalizeBrPhone("123"), {
    e164: null,
    isMobile: false,
  });
});

test("gera link wa.me com mensagem codificada", () => {
  assert.equal(
    buildWaMeUrl("5519981984137", "Olá, tudo bem?"),
    "https://wa.me/5519981984137?text=Ol%C3%A1%2C%20tudo%20bem%3F",
  );
});

test("preenche o template e garante o link do portfólio", () => {
  const result = fillTemplate("Olá, {{nome}} de {{cidade}}! {{site}}", {
    nome: "Acme",
    cidade: "Campinas",
    hasSite: false,
    portfolioUrl: "https://portfolio.example/",
  });

  assert.match(result, /Olá, Acme de Campinas!/);
  assert.match(result, /Acme ainda não tem site/);
  assert.match(result, /https:\/\/portfolio\.example\//);
});

test("extrai texto de mensagens embrulhadas e interativas", () => {
  assert.equal(
    extractWhatsAppText({
      ephemeralMessage: {
        message: {
          extendedTextMessage: { text: "Mensagem temporária" },
        },
      },
    }),
    "Mensagem temporária",
  );
  assert.equal(
    extractWhatsAppText({
      interactiveMessage: { body: { text: "Escolha uma opção" } },
    }),
    "Escolha uma opção",
  );
});

test("distingue mídia de eventos que não viram mensagem", () => {
  assert.equal(
    extractWhatsAppText({ imageMessage: { caption: "Comprovante" } }),
    "Comprovante",
  );
  assert.equal(extractWhatsAppText({ audioMessage: {} }), "[áudio]");
  assert.equal(extractWhatsAppText({ reactionMessage: { text: "👍" } }), null);
});
