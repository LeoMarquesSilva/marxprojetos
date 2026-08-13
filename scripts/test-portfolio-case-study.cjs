/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const componentPath = path.resolve(
  "src/components/portfolio-case-study.tsx",
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
    return { ExternalLink: () => null };
  }
  if (request === "@/components/portfolio-project-cover") {
    return { PortfolioProjectCover: () => null };
  }
  if (request === "@/lib/portfolio-cases") {
    return {
      getPortfolioCoverSources: (project) => [
        `/portfolio/covers/${project.site_path}.webp`,
      ],
      getPortfolioProjectLink: (project) =>
        project.portfolio_live_url
          ? { href: project.portfolio_live_url, isExternal: true }
          : project.site_path
            ? { href: `/sites/${project.site_path}/index.html`, isExternal: false }
            : null,
    };
  }
  if (request === "@/lib/utils") {
    return {
      cn: (...inputs) => inputs.filter(Boolean).join(" "),
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

try {
  const loadedModule = new Module(componentPath);
  loadedModule.filename = componentPath;
  loadedModule.paths = Module._nodeModulePaths(path.dirname(componentPath));
  loadedModule._compile(compiled, componentPath);

  const portfolioCase = {
    id: "pereira-garcia",
    client: "Pereira Garcia Advocacia",
    summary: "Presença digital com autoridade e clareza.",
    services: ["Estratégia", "UX/UI"],
    chapters: [
      {
        project: {
          id: "institutional",
          title: "Site institucional",
          site_path: "pereira-garcia-site",
        },
        config: {
          eyebrow: "Site institucional",
          objective: "Consolidar a autoridade do escritório.",
          solution: "Uma experiência sóbria e editorial.",
          deliverables: ["UX/UI", "SEO local"],
          imageAlt: "Hero do site institucional",
        },
      },
      {
        project: {
          id: "holding",
          title: "Landing page de Holding",
          site_path: "pereira-garcia",
        },
        config: {
          eyebrow: "Landing page",
          objective: "Explicar um serviço jurídico complexo.",
          solution: "Uma página focada em conversão.",
          deliverables: ["Copy", "Formulário de leads"],
          imageAlt: "Hero da landing page",
        },
      },
    ],
  };

  const html = renderToStaticMarkup(
    React.createElement(loadedModule.exports.PortfolioCaseStudy, {
      portfolioCase,
      priority: true,
    }),
  );

  // O case é um cartão contido com selo, para não se confundir com o
  // cabeçalho da seção que vem logo acima dele na página.
  assert.match(html, />Case</);
  assert.match(html, /rounded-\[2rem\][^"]*bg-white\/70/);
  assert.match(html, /2 projetos/);
  assert.match(html, /Pereira Garcia Advocacia/);
  assert.equal((html.match(/Objetivo/g) ?? []).length, 2);
  assert.ok(html.indexOf("Site institucional") < html.indexOf("Landing page"));
  assert.match(
    html,
    /href="\/sites\/pereira-garcia-site\/index\.html"/,
  );
  assert.match(html, /href="\/sites\/pereira-garcia\/index\.html"/);
  assert.match(html, /SEO local/);
  assert.match(html, /Formulário de leads/);
  console.log("Portfolio case study tests passed.");
} finally {
  Module._load = originalLoad;
}
