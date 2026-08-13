/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");

const modulePath = path.resolve("src/lib/portfolio-cases.ts");
const source = fs.readFileSync(modulePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;

const loadedModule = new Module(modulePath);
loadedModule.filename = modulePath;
loadedModule.paths = Module._nodeModulePaths(path.dirname(modulePath));
loadedModule._compile(compiled, modulePath);

const {
  buildPortfolioPresentation,
  getPortfolioCoverSources,
  getPortfolioProjectLink,
} = loadedModule.exports;

const CASE_ID = "11111111-1111-1111-1111-111111111111";

function project(overrides) {
  return {
    id: overrides.id,
    title: overrides.title,
    client_name: "Pereira Garcia Advocacia",
    client_company: "Pereira Garcia Advocacia",
    portfolio_description: null,
    portfolio_cover_url: null,
    site_path: overrides.site_path,
    portfolio_case_id: null,
    portfolio_eyebrow: null,
    portfolio_objective: null,
    portfolio_solution: null,
    portfolio_deliverables: [],
    portfolio_image_alt: null,
    portfolio_sort_order: 0,
    created_at: "2026-06-29T14:58:55.000Z",
    ...overrides,
  };
}

const pereiraCase = {
  id: CASE_ID,
  client: "Pereira Garcia Advocacia",
  summary: "Resumo do case.",
  services: ["Estratégia", "UX/UI"],
  sort_order: 0,
};

const institutionalProject = project({
  id: "institutional",
  title: "Site Institucional — Pereira Garcia Advocacia",
  site_path: "pereira-garcia-site",
  portfolio_cover_url: "https://cdn.example.com/manual.webp",
  portfolio_case_id: CASE_ID,
  portfolio_eyebrow: "Site institucional",
  portfolio_objective: "Consolidar a autoridade do escritório.",
  portfolio_solution: "Uma experiência sóbria e editorial.",
  portfolio_deliverables: ["UX/UI", "SEO local"],
  portfolio_image_alt: "Hero do site institucional",
  portfolio_sort_order: 0,
});
const holdingProject = project({
  id: "holding",
  title: "Landing Page Holding — Pereira Garcia Advocacia",
  site_path: "pereira-garcia",
  portfolio_case_id: CASE_ID,
  portfolio_eyebrow: "Landing page de Holding",
  portfolio_sort_order: 1,
});
const futureProject = project({
  id: "future",
  title: "Projeto futuro",
  site_path: "cliente-futuro",
});

// A RPC já devolve os projetos ordenados por portfolio_sort_order, então a
// ordem dos capítulos deve seguir a ordem de entrada.
const result = buildPortfolioPresentation(
  [institutionalProject, holdingProject, futureProject],
  [pereiraCase],
);

assert.equal(result.cases.length, 1);
assert.equal(result.cases[0].id, CASE_ID);
assert.equal(result.cases[0].client, "Pereira Garcia Advocacia");
assert.equal(result.cases[0].summary, "Resumo do case.");
assert.deepEqual(result.cases[0].services, ["Estratégia", "UX/UI"]);
assert.deepEqual(
  result.cases[0].chapters.map((chapter) => chapter.project.site_path),
  ["pereira-garcia-site", "pereira-garcia"],
);

// O conteúdo editorial vem das colunas do próprio projeto.
assert.deepEqual(result.cases[0].chapters[0].config, {
  eyebrow: "Site institucional",
  objective: "Consolidar a autoridade do escritório.",
  solution: "Uma experiência sóbria e editorial.",
  deliverables: ["UX/UI", "SEO local"],
  imageAlt: "Hero do site institucional",
});

// Campos editoriais vazios não quebram o card; imageAlt cai num texto derivado.
assert.equal(result.cases[0].chapters[1].config.objective, "");
assert.deepEqual(result.cases[0].chapters[1].config.deliverables, []);
assert.equal(
  result.cases[0].chapters[1].config.imageAlt,
  "Hero do projeto Landing Page Holding — Pereira Garcia Advocacia",
);

assert.equal(result.ungroupedItems.length, 1);
assert.equal(result.ungroupedItems[0].id, "future");

assert.deepEqual(getPortfolioCoverSources(institutionalProject), [
  "https://cdn.example.com/manual.webp",
  "/portfolio/covers/pereira-garcia-site.webp",
]);

// Case sem nenhum projeto publicado não deve aparecer.
const partial = buildPortfolioPresentation([holdingProject], [pereiraCase]);
assert.equal(partial.cases.length, 1);
assert.equal(partial.cases[0].chapters.length, 1);
assert.equal(partial.cases[0].chapters[0].project.id, "holding");
assert.deepEqual(partial.ungroupedItems, []);

const emptyCase = buildPortfolioPresentation([futureProject], [pereiraCase]);
assert.deepEqual(emptyCase.cases, []);
assert.equal(emptyCase.ungroupedItems.length, 1);

// Projeto apontando para um case que não existe mais vira card simples em vez
// de sumir da página.
const orphan = buildPortfolioPresentation(
  [project({ id: "orphan", title: "Órfão", site_path: "orfao", portfolio_case_id: "nao-existe" })],
  [pereiraCase],
);
assert.deepEqual(orphan.cases, []);
assert.equal(orphan.ungroupedItems.length, 1);
assert.equal(orphan.ungroupedItems[0].id, "orphan");

// Destino do card: o site publicado do cliente ganha do preview interno.
// Enquanto o projeto não está no ar, o preview continua valendo.
assert.deepEqual(
  getPortfolioProjectLink({
    site_path: "pereira-garcia-site",
    portfolio_live_url: "https://www.pereiragarciaadvocacia.com.br/",
  }),
  { href: "https://www.pereiragarciaadvocacia.com.br/", isExternal: true },
);

assert.deepEqual(
  getPortfolioProjectLink({ site_path: "so-preview", portfolio_live_url: null }),
  { href: "/sites/so-preview/index.html", isExternal: false },
);

// URL só com espaços não conta como publicada.
assert.deepEqual(
  getPortfolioProjectLink({ site_path: "so-preview", portfolio_live_url: "   " }),
  { href: "/sites/so-preview/index.html", isExternal: false },
);

// Sem preview e sem site publicado, o card fica sem link ("Case reservado").
assert.equal(
  getPortfolioProjectLink({ site_path: null, portfolio_live_url: null }),
  null,
);

// Site publicado vale mesmo sem preview interno.
assert.deepEqual(
  getPortfolioProjectLink({
    site_path: null,
    portfolio_live_url: "https://exemplo.com.br/",
  }),
  { href: "https://exemplo.com.br/", isExternal: true },
);

console.log("Portfolio case tests passed.");
