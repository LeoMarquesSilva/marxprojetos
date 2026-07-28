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
} = loadedModule.exports;

function project(overrides) {
  return {
    id: overrides.id,
    title: overrides.title,
    client_name: "Pereira Garcia Advocacia",
    client_company: "Pereira Garcia Advocacia",
    portfolio_description: null,
    portfolio_cover_url: null,
    site_path: overrides.site_path,
    created_at: "2026-06-29T14:58:55.000Z",
    ...overrides,
  };
}

const institutionalProject = project({
  id: "institutional",
  title: "Site Institucional — Pereira Garcia Advocacia",
  site_path: "pereira-garcia-site",
  portfolio_cover_url: "https://cdn.example.com/manual.webp",
});
const holdingProject = project({
  id: "holding",
  title: "Landing Page Holding — Pereira Garcia Advocacia",
  site_path: "pereira-garcia",
});
const futureProject = project({
  id: "future",
  title: "Projeto futuro",
  site_path: "cliente-futuro",
});

const result = buildPortfolioPresentation([
  holdingProject,
  futureProject,
  institutionalProject,
]);

assert.equal(result.cases.length, 1);
assert.equal(result.cases[0].id, "pereira-garcia");
assert.deepEqual(
  result.cases[0].chapters.map((chapter) => chapter.project.site_path),
  ["pereira-garcia-site", "pereira-garcia"],
);
assert.equal(result.ungroupedItems.length, 1);
assert.deepEqual(
  getPortfolioCoverSources(institutionalProject),
  [
    "https://cdn.example.com/manual.webp",
    "/portfolio/covers/pereira-garcia-site.webp",
  ],
);

const partial = buildPortfolioPresentation([holdingProject]);
assert.equal(partial.cases[0].chapters.length, 1);
assert.equal(partial.cases[0].chapters[0].project.id, "holding");
assert.deepEqual(partial.ungroupedItems, []);

console.log("Portfolio case tests passed.");
