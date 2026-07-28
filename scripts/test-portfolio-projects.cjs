/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");

const modulePath = path.resolve("src/lib/portfolio-projects.ts");
const source = fs.readFileSync(modulePath, "utf8");
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

  const cards = loadedModule.exports.buildPortfolioProjectCards([
    {
      id: "existing",
      title: "Projeto interno",
      client_name: "Cliente interno",
      client_company: "Empresa interna",
      portfolio_description: "Descri\u00e7\u00e3o do projeto interno.",
      portfolio_cover_url: null,
      site_path: "internal-site",
      created_at: "2026-07-28T00:00:00.000Z",
    },
  ]);

  assert.equal(cards.length, 4);
  assert.equal(cards[0].id, "internal:existing");
  assert.equal(cards[0].href, "/sites/internal-site/index.html");
  assert.deepEqual(
    cards.slice(1).map((card) => card.clientLabel),
    ["Bismarchi | Pires", "Beatriz Bertho Advocacia", "Confiara"],
  );
  assert.deepEqual(
    cards.slice(1).map((card) => card.title),
    [
      "Site Institucional — Bismarchi | Pires",
      "Landing Page — Beatriz Bertho Advocacia",
      "Site Institucional — Confiara",
    ],
  );
  assert.deepEqual(
    cards.slice(1).map((card) => card.description),
    [
      "Um site institucional robusto para apresentar a atuação em reestruturação empresarial e gestão de crises, reunindo áreas jurídicas, equipe e reconhecimentos em uma experiência de autoridade.",
      "Uma landing page de advocacia preventiva em Direito Médico que transforma riscos complexos em uma jornada clara de serviços, método, credenciais e contato.",
      "Um site institucional estruturado para apresentar a marca, seus serviços e caminhos de contato em uma navegação direta, clara e responsiva.",
    ],
  );
  assert.deepEqual(
    cards.slice(1).map((card) => card.imageAlt),
    [
      "Hero do site Bismarchi Pires, com posicionamento em gestão estratégica empresarial e advocacia de alta complexidade",
      "Hero da landing page Beatriz Bertho Advocacia, sobre prevenção de riscos jurídicos para médicos e clínicas",
      "Hero do site institucional Confiara, com apresentação da marca, proposta de valor e chamada principal",
    ],
  );
  assert.deepEqual(
    cards.slice(1).map((card) => card.href),
    [
      "https://www.bismarchipires.com.br/",
      "https://beatrizberthoadv.com.br/",
      "https://www.confiara.com.br/",
    ],
  );
  assert.deepEqual(
    cards.slice(1).map((card) => card.coverSources[0]),
    [
      "/portfolio/covers/bismarchi-pires.webp",
      "/portfolio/covers/beatriz-bertho.webp",
      "/portfolio/covers/confiara.webp",
    ],
  );
  assert.ok(cards.slice(1).every((card) => card.description.length > 40));
  assert.ok(cards.slice(1).every((card) => card.imageAlt.length > 20));

  console.log("Portfolio project tests passed.");
} finally {
  Module._load = originalLoad;
}
