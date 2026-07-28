/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const componentPath = path.resolve(
  "src/components/portfolio-project-card.tsx",
);
const source = fs.readFileSync(componentPath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === "lucide-react") {
    return { ArrowUpRight: () => null, ExternalLink: () => null };
  }
  if (request === "@/components/portfolio-project-cover") {
    return { PortfolioProjectCover: () => null };
  }
  return originalLoad.call(this, request, parent, isMain);
};

try {
  const loadedModule = new Module(componentPath);
  loadedModule.filename = componentPath;
  loadedModule.paths = Module._nodeModulePaths(path.dirname(componentPath));
  loadedModule._compile(compiled, componentPath);

  const externalHtml = renderToStaticMarkup(
    React.createElement(loadedModule.exports.PortfolioProjectCardView, {
      project: {
        id: "external:bismarchi-pires",
        title: "Site Institucional",
        clientLabel: "Bismarchi | Pires",
        description: "Presença digital institucional.",
        href: "https://www.bismarchipires.com.br/",
        coverSources: ["/portfolio/covers/bismarchi-pires.webp"],
        imageAlt: "Hero do site Bismarchi Pires",
        highlights: [],
      },
      index: 0,
    }),
  );

  assert.match(externalHtml, /Bismarchi \| Pires/);
  assert.match(externalHtml, /Site Institucional/);
  assert.match(externalHtml, /href="https:\/\/www\.bismarchipires\.com\.br\/"/);
  assert.match(externalHtml, /target="_blank"/);
  assert.match(externalHtml, /rel="noopener noreferrer"/);
  assert.match(externalHtml, /Visitar projeto/);
  assert.match(externalHtml, /Abrir projeto Site Institucional/);
  assert.doesNotMatch(externalHtml, /aria-label="Diferenciais"/);

  const reservedHtml = renderToStaticMarkup(
    React.createElement(loadedModule.exports.PortfolioProjectCardView, {
      project: {
        id: "internal:reserved",
        title: "Case reservado",
        clientLabel: "Projeto INSYT",
        description: null,
        href: null,
        coverSources: ["/portfolio/covers/reserved.webp"],
        imageAlt: "Capa do case reservado",
        highlights: [],
      },
      index: 1,
    }),
  );

  assert.match(reservedHtml, /Case reservado/);
  assert.doesNotMatch(reservedHtml, /target="_blank"/);

  // Projetos mais substanciais (um sistema/SaaS, não só um site) podem levar
  // diferenciais em destaque, na mesma linguagem visual das entregas do case.
  const saasHtml = renderToStaticMarkup(
    React.createElement(loadedModule.exports.PortfolioProjectCardView, {
      project: {
        id: "external:confiara",
        title: "Plataforma de Compliance NR-1 — Confiara",
        clientLabel: "Confiara",
        description: "Uma plataforma SaaS multiempresa.",
        href: "https://www.confiara.com.br/",
        coverSources: ["/portfolio/covers/confiara.webp"],
        imageAlt: "Hero da plataforma Confiara",
        highlights: [
          "Diagnóstico de riscos psicossociais (NR-1)",
          "Canal de denúncias com protocolo rastreável",
        ],
      },
      index: 2,
    }),
  );

  assert.match(saasHtml, /aria-label="Diferenciais"/);
  assert.match(saasHtml, /Diagnóstico de riscos psicossociais \(NR-1\)/);
  assert.match(saasHtml, /Canal de denúncias com protocolo rastreável/);

  console.log("Portfolio project card tests passed.");
} finally {
  Module._load = originalLoad;
}
