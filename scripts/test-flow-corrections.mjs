import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyNextStep,
  getBriefingAnswerValidationError,
  isBriefingAnswerFilled,
  isValidEmailAddress,
  normalizeBriefingAnswers,
  toggleMultiselectAnswer,
  validateAndNormalizeBriefingAnswers,
} from "../src/lib/flow-utils.ts";

test("multiselect obrigatório considera array vazio como não preenchido", () => {
  assert.equal(isBriefingAnswerFilled([]), false);
  assert.equal(isBriefingAnswerFilled([""]), false);
  assert.equal(isBriefingAnswerFilled(["Identidade visual"]), true);
});

test("multiselect serializa somente opções marcadas em um array", () => {
  const selected = toggleMultiselectAnswer(undefined, "Site institucional", true);
  const withSecond = toggleMultiselectAnswer(selected, "Landing page", true);
  const unchecked = toggleMultiselectAnswer(withSecond, "Site institucional", false);

  assert.deepEqual(selected, ["Site institucional"]);
  assert.deepEqual(withSecond, ["Site institucional", "Landing page"]);
  assert.deepEqual(unchecked, ["Landing page"]);
});

test("normalização preserva multiselect e converte links em listas limpas", () => {
  const normalized = normalizeBriefingAnswers(
    [
      { id: "servicos", type: "multiselect", label: "Serviços" },
      { id: "referencias", type: "links", label: "Referências" },
      { id: "arquivos", type: "file", label: "Arquivos" },
      { id: "site", type: "url", label: "Site" },
    ],
    {
      servicos: ["Site", "SEO"],
      referencias: " https://a.example \n\nhttps://b.example ",
      arquivos: " https://drive.google.com/example ",
      site: " https://example.com ",
    },
  );

  assert.deepEqual(normalized, {
    servicos: ["Site", "SEO"],
    referencias: ["https://a.example", "https://b.example"],
    arquivos: "https://drive.google.com/example",
    site: "https://example.com",
  });
});

test("validação obrigatória continua rejeitando respostas vazias", () => {
  const question = {
    id: "arquivo",
    type: "file",
    label: "Arquivo de referência",
    required: true,
  };

  assert.equal(
    getBriefingAnswerValidationError(question, "   "),
    "Preencha: Arquivo de referência",
  );
});

test("arquivo e URL aceitam somente endereços http/https absolutos", () => {
  const fileQuestion = {
    id: "arquivo",
    type: "file",
    label: "Arquivo de referência",
  };
  const urlQuestion = { id: "site", type: "url", label: "Site atual" };

  for (const value of [
    "drive.google.com/arquivo",
    "/arquivo",
    "ftp://example.com/arquivo",
    "javascript:alert(1)",
  ]) {
    assert.equal(
      getBriefingAnswerValidationError(fileQuestion, value),
      "Informe uma URL completa com http:// ou https:// em: Arquivo de referência",
    );
    assert.equal(
      getBriefingAnswerValidationError(urlQuestion, value),
      "Informe uma URL completa com http:// ou https:// em: Site atual",
    );
  }

  assert.equal(
    getBriefingAnswerValidationError(
      fileQuestion,
      " https://drive.google.com/arquivo ",
    ),
    null,
  );
  assert.equal(
    getBriefingAnswerValidationError(urlQuestion, "http://example.com"),
    null,
  );
});

test("links multiline ignoram vazios e validam cada URL", () => {
  const question = {
    id: "referencias",
    type: "links",
    label: "Referências",
  };

  assert.equal(
    getBriefingAnswerValidationError(
      question,
      " https://a.example \n\n http://b.example/path ",
    ),
    null,
  );
  assert.equal(
    getBriefingAnswerValidationError(
      question,
      "https://a.example\nsite-sem-protocolo\nhttps://b.example",
    ),
    "Informe apenas URLs completas com http:// ou https:// em: Referências (linha 2)",
  );
});

test("e-mails informados precisam ter formato plausível", () => {
  const question = { id: "email", type: "email", label: "E-mail de contato" };

  assert.equal(isValidEmailAddress(" contato@example.com "), true);
  assert.equal(isValidEmailAddress("contato@localhost"), false);
  assert.equal(isValidEmailAddress("contato example.com"), false);
  assert.equal(
    getBriefingAnswerValidationError(question, "contato@localhost"),
    "Informe um e-mail válido em: E-mail de contato",
  );
  assert.equal(
    getBriefingAnswerValidationError(question, " contato@example.com "),
    null,
  );
});

test("validação agregada usa perguntas do servidor e normaliza como o formulário", () => {
  const questionsFromServer = [
    {
      id: "objetivo",
      type: "textarea",
      label: "Objetivo",
      required: true,
    },
    { id: "arquivo", type: "file", label: "Arquivo" },
    { id: "referencias", type: "links", label: "Referências" },
    { id: "email", type: "email", label: "E-mail" },
  ];

  assert.deepEqual(
    validateAndNormalizeBriefingAnswers(questionsFromServer, {
      arquivo: "https://drive.example/arquivo",
    }),
    { error: "Preencha: Objetivo" },
  );

  assert.deepEqual(
    validateAndNormalizeBriefingAnswers(questionsFromServer, {
      objetivo: "Novo site",
      arquivo: " drive.example/arquivo ",
      referencias: "https://a.example\nsite-sem-protocolo",
      email: "contato@localhost",
    }),
    {
      error:
        "Informe uma URL completa com http:// ou https:// em: Arquivo",
    },
  );

  assert.deepEqual(
    validateAndNormalizeBriefingAnswers(questionsFromServer, {
      objetivo: "Novo site",
      arquivo: " https://drive.example/arquivo ",
      referencias: " https://a.example \n\nhttp://b.example ",
      email: " contato@example.com ",
    }),
    {
      answers: {
        objetivo: "Novo site",
        arquivo: "https://drive.example/arquivo",
        referencias: ["https://a.example", "http://b.example"],
        email: "contato@example.com",
      },
    },
  );
});

test("validação agregada rejeita perguntas ou respostas malformadas com erro seguro", () => {
  assert.deepEqual(validateAndNormalizeBriefingAnswers("forjado", {}), {
    error: "Não foi possível validar as perguntas deste briefing.",
  });
  assert.deepEqual(
    validateAndNormalizeBriefingAnswers(
      [{ id: "site", type: "tipo-forjado", label: "Site" }],
      {},
    ),
    { error: "Não foi possível validar as perguntas deste briefing." },
  );
  assert.deepEqual(
    validateAndNormalizeBriefingAnswers(
      [{ id: "site", type: "url", label: "Site" }],
      [],
    ),
    { error: "As respostas enviadas são inválidas." },
  );
});

test("validação agregada rejeita tipos incompatíveis e opções forjadas", () => {
  const questions = [
    {
      id: "servicos",
      type: "multiselect",
      label: "Serviços",
      required: true,
      options: ["Site", "SEO"],
    },
    {
      id: "objetivo",
      type: "select",
      label: "Objetivo",
      required: true,
      options: ["Leads", "Vendas"],
    },
  ];

  assert.deepEqual(
    validateAndNormalizeBriefingAnswers(questions, {
      servicos: {},
      objetivo: "Leads",
    }),
    { error: "Resposta inválida em: Serviços" },
  );
  assert.deepEqual(
    validateAndNormalizeBriefingAnswers(questions, {
      servicos: ["Site", "Opção forjada"],
      objetivo: "Leads",
    }),
    { error: "Selecione apenas opções válidas em: Serviços" },
  );
  assert.deepEqual(
    validateAndNormalizeBriefingAnswers(questions, {
      servicos: ["Site"],
      objetivo: "Opção forjada",
    }),
    { error: "Selecione uma opção válida em: Objetivo" },
  );
});

test("próximo passo distingue prazo atrasado e próximo", () => {
  const now = new Date("2026-08-11T15:00:00.000Z");

  assert.equal(classifyNextStep("2026-08-10T12:00:00.000Z", now), "overdue");
  assert.equal(classifyNextStep("2026-08-11T12:00:00.000Z", now), "upcoming");
  assert.equal(classifyNextStep("2026-08-12T12:00:00.000Z", now), "upcoming");
  assert.equal(classifyNextStep(null, now), null);
});

test("próximo passo usa a virada do dia civil de São Paulo entre 21h e 24h BRT", () => {
  const dueOnAugust11 = "2026-08-11T12:00:00.000Z";

  assert.equal(
    classifyNextStep(dueOnAugust11, new Date("2026-08-12T00:00:00.000Z")),
    "upcoming",
    "21h BRT ainda pertence a 11 de agosto",
  );
  assert.equal(
    classifyNextStep(dueOnAugust11, new Date("2026-08-12T02:59:59.999Z")),
    "upcoming",
    "23h59 BRT ainda pertence a 11 de agosto",
  );
  assert.equal(
    classifyNextStep(dueOnAugust11, new Date("2026-08-12T03:00:00.000Z")),
    "overdue",
    "meia-noite BRT inicia 12 de agosto",
  );
});
