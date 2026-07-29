/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");

const modulePath = path.resolve("src/lib/portfolio-projects.ts");
const source = fs.readFileSync(modulePath, "utf8");
// O portfólio é a página inicial do domínio: o lead que abre o link do
// e-mail cai direto na prova de trabalho, não numa tela de login.
const pageSource = fs.readFileSync(path.resolve("src/app/page.tsx"), "utf8");

assert.match(pageSource, /buildPortfolioProjectCards/);
assert.match(pageSource, /PortfolioProjectCardView/);
assert.doesNotMatch(pageSource, /function SimplePortfolioProject/);

// A página precisa alimentar os cards com os projetos externos do banco.
assert.match(pageSource, /getPublicExternalProjects/);
assert.match(pageSource, /getPublicPortfolioCases/);

// A porta de serviço fica no topo e troca de rótulo conforme a sessão.
assert.match(pageSource, /isLoggedIn \? "\/dashboard" : "\/login"/);
assert.match(pageSource, /isLoggedIn \? "Painel" : "Entrar"/);

// A raiz não pode voltar a mandar visitante direto para o login.
assert.doesNotMatch(pageSource, /redirect\("\/dashboard"\)/);

// Botão flutuante de WhatsApp, só quando há número cadastrado.
// Tolerante à formatação: o que importa é estar guardado por whatsappUrl.
assert.match(pageSource, /whatsappUrl \?\s*\(?\s*<WhatsAppFloatButton/);

// SEO: dados estruturados com escape, e o lockup horizontal no topo/rodapé.
assert.match(pageSource, /application\/ld\+json/);
assert.match(pageSource, /replace\(\/<\/g, "\\\\u003c"\)/);
assert.match(pageSource, /variant="horizontal-light"/);

// O catálogo hardcoded foi migrado para o banco e não pode voltar ao código.
assert.doesNotMatch(source, /EXTERNAL_PORTFOLIO_PROJECTS/);
assert.doesNotMatch(source, /bismarchipires\.com\.br/);

const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === "@/lib/portfolio-cases") {
    return {
      getPortfolioCoverSources: (item) => [
        `/portfolio/covers/${item.site_path}.webp`,
      ],
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

try {
  const loadedModule = new Module(modulePath);
  loadedModule.filename = modulePath;
  loadedModule.paths = Module._nodeModulePaths(path.dirname(modulePath));
  loadedModule._compile(compiled, modulePath);

  const internalItem = {
    id: "existing",
    title: "Projeto interno",
    client_name: "Cliente interno",
    client_company: "Empresa interna",
    portfolio_description: "Descrição do projeto interno.",
    portfolio_cover_url: null,
    site_path: "internal-site",
    portfolio_case_id: null,
    portfolio_eyebrow: null,
    portfolio_objective: null,
    portfolio_solution: null,
    portfolio_deliverables: [],
    portfolio_image_alt: null,
    portfolio_sort_order: 0,
    created_at: "2026-07-28T00:00:00.000Z",
  };

  const externalProjects = [
    {
      id: "ext-1",
      title: "Site Institucional — Bismarchi | Pires",
      client_label: "Bismarchi | Pires",
      description: "Um site institucional robusto para apresentar a atuação.",
      url: "https://www.bismarchipires.com.br/",
      cover_url: "/portfolio/covers/bismarchi-pires.webp",
      image_alt: "Hero do site Bismarchi Pires",
      sort_order: 0,
    },
    {
      id: "ext-2",
      title: "Site sem link",
      client_label: "Cliente reservado",
      description: null,
      url: null,
      cover_url: null,
      image_alt: null,
      sort_order: 1,
    },
    {
      id: "ext-3",
      title: "Plataforma de Compliance NR-1 — Confiara",
      client_label: "Confiara",
      description: "Uma plataforma SaaS multiempresa.",
      url: "https://www.confiara.com.br/",
      cover_url: "/portfolio/covers/confiara.webp",
      image_alt: "Hero da plataforma Confiara",
      highlights: ["Diagnóstico de riscos psicossociais (NR-1)", "Canal de denúncias"],
      sort_order: 2,
    },
  ];

  const cards = loadedModule.exports.buildPortfolioProjectCards(
    [internalItem],
    externalProjects,
  );

  assert.equal(cards.length, 4);

  // Internos vêm primeiro; externos preservam a ordem recebida do banco.
  assert.equal(cards[0].id, "internal:existing");
  assert.equal(cards[0].href, "/sites/internal-site/index.html");
  assert.equal(cards[0].clientLabel, "Empresa interna");
  assert.deepEqual(cards[0].highlights, []);

  assert.equal(cards[1].id, "external:ext-1");
  assert.equal(cards[1].title, "Site Institucional — Bismarchi | Pires");
  assert.equal(cards[1].clientLabel, "Bismarchi | Pires");
  assert.equal(cards[1].href, "https://www.bismarchipires.com.br/");
  assert.deepEqual(cards[1].coverSources, [
    "/portfolio/covers/bismarchi-pires.webp",
  ]);
  assert.equal(cards[1].imageAlt, "Hero do site Bismarchi Pires");
  assert.deepEqual(cards[1].highlights, []);

  // Externo sem URL vira "Case reservado" (href null); sem capa, o componente
  // cai no gradiente de fallback (coverSources vazio).
  assert.equal(cards[2].id, "external:ext-2");
  assert.equal(cards[2].href, null);
  assert.deepEqual(cards[2].coverSources, []);
  assert.equal(cards[2].description, null);
  assert.equal(cards[2].imageAlt, "Capa do projeto Site sem link");
  assert.deepEqual(cards[2].highlights, []);

  // Projeto que é mais que um site (um sistema/SaaS) leva diferenciais.
  assert.equal(cards[3].id, "external:ext-3");
  assert.deepEqual(cards[3].highlights, [
    "Diagnóstico de riscos psicossociais (NR-1)",
    "Canal de denúncias",
  ]);

  // Sem projetos externos cadastrados, só os internos aparecem.
  const internalOnly = loadedModule.exports.buildPortfolioProjectCards([
    internalItem,
  ]);
  assert.equal(internalOnly.length, 1);
  assert.equal(internalOnly[0].id, "internal:existing");

  console.log("Portfolio project tests passed.");
} finally {
  Module._load = originalLoad;
}
