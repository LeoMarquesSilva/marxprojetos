# Pereira Garcia Portfolio Case Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar os dois projetos publicados da Pereira Garcia em um único case editorial, com screenshots reais dos heros, narrativa estruturada e fallback para projetos futuros.

**Architecture:** A RPC pública continua sendo a fonte de projetos publicados. Um módulo tipado local associa `site_path` a conteúdo editorial e produz cases agrupados mais itens não configurados; componentes focados renderizam a narrativa e controlam o fallback das capas. Um script Playwright gera WebPs estáticos a partir dos sites já sincronizados em `public/sites`, sem executar navegador em produção.

**Tech Stack:** Next.js 16.2.9 App Router, React 19.2.4, TypeScript, Tailwind CSS 4, Supabase RPC existente, Playwright 1.62.0, Node.js.

## Global Constraints

- Preservar o fluxo atual de publicação e os links fornecidos pelo Supabase.
- Não alterar schema, políticas ou funções do Supabase.
- Não expor briefing, e-mail, token de revisão ou outros dados privados.
- Não inventar métricas ou resultados.
- A URL manual de capa tem prioridade sobre o screenshot local.
- Projetos sem configuração editorial continuam visíveis no formato simples.
- Toda imagem significativa precisa de texto alternativo descritivo.
- Animações devem respeitar `prefers-reduced-motion`.
- Ler a documentação local do Next.js 16 em `node_modules/next/dist/docs/` antes de escrever componentes.
- Preservar alterações não relacionadas e stagear somente os arquivos desta entrega.

---

## File Structure

- Create: `src/lib/portfolio-cases.ts` — tipos, conteúdo aprovado, agrupamento e ordem de fontes de capa.
- Create: `scripts/test-portfolio-cases.cjs` — testes do modelo usando o TypeScript já instalado.
- Create: `scripts/capture-portfolio-covers.mjs` — servidor estático temporário e captura dos heros.
- Create: `src/components/portfolio-project-cover.tsx` — imagem com fallback manual → local → visual.
- Create: `src/components/portfolio-case-study.tsx` — composição editorial do case.
- Create: `public/portfolio/covers/pereira-garcia-site.webp` — hero do site institucional.
- Create: `public/portfolio/covers/pereira-garcia.webp` — hero da landing page.
- Modify: `src/app/portfolio/page.tsx` — integrar cases agrupados e manter itens simples.
- Modify: `package.json` — comandos de teste/captura e Playwright exato.
- Modify: `package-lock.json` — lock da dependência Playwright.

---

### Task 1: Modelo editorial e agrupamento

**Files:**
- Create: `src/lib/portfolio-cases.ts`
- Create: `scripts/test-portfolio-cases.cjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `PortfolioItem` de `src/app/actions/portfolio.ts`.
- Produces: `buildPortfolioPresentation(items: PortfolioItem[]): PortfolioPresentation`.
- Produces: `getPortfolioCoverSources(item: PortfolioItem): string[]`.
- Produces: `PortfolioCase`, `PortfolioCaseChapter` e `PortfolioPresentation`.

- [ ] **Step 1: Adicionar o comando de teste que ainda não tem implementação**

Em `package.json`, adicionar:

```json
"test:portfolio": "node scripts/test-portfolio-cases.cjs"
```

- [ ] **Step 2: Escrever o teste do comportamento**

Criar `scripts/test-portfolio-cases.cjs`:

```js
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
```

- [ ] **Step 3: Executar o teste para confirmar RED**

Run:

```powershell
npm.cmd run test:portfolio
```

Expected: FAIL porque `src/lib/portfolio-cases.ts` ainda não existe.

- [ ] **Step 4: Implementar tipos, conteúdo e agrupamento**

Criar `src/lib/portfolio-cases.ts` com a seguinte forma:

```ts
import type { PortfolioItem } from "@/app/actions/portfolio";

export type PortfolioChapterConfig = {
  sitePath: string;
  eyebrow: string;
  objective: string;
  solution: string;
  deliverables: string[];
  imageAlt: string;
};

export type PortfolioCaseConfig = {
  id: string;
  client: string;
  summary: string;
  services: string[];
  chapters: PortfolioChapterConfig[];
};

export type PortfolioCaseChapter = {
  project: PortfolioItem;
  config: PortfolioChapterConfig;
};

export type PortfolioCase = Omit<PortfolioCaseConfig, "chapters"> & {
  chapters: PortfolioCaseChapter[];
};

export type PortfolioPresentation = {
  cases: PortfolioCase[];
  ungroupedItems: PortfolioItem[];
};
```

Configurar o case `pereira-garcia` com os textos aprovados e esta ordem:

```ts
const PORTFOLIO_CASE_CONFIGS: PortfolioCaseConfig[] = [
  {
    id: "pereira-garcia",
    client: "Pereira Garcia Advocacia",
    summary:
      "Uma presença digital construída para traduzir mais de quatro décadas de experiência jurídica em autoridade, clareza e novos pontos de contato.",
    services: ["Estratégia", "Conteúdo", "UX/UI", "Desenvolvimento"],
    chapters: [
      {
        sitePath: "pereira-garcia-site",
        eyebrow: "Site institucional",
        objective:
          "Consolidar a autoridade do escritório e organizar sua atuação para empresas familiares.",
        solution:
          "Uma experiência sóbria e editorial, com navegação clara, história, equipe, áreas jurídicas e contato.",
        deliverables: [
          "Estratégia de conteúdo",
          "UX/UI",
          "Desenvolvimento responsivo",
          "SEO local",
          "Páginas institucionais",
        ],
        imageAlt:
          "Hero do site institucional Pereira Garcia Advocacia, com navegação, posicionamento jurídico e chamada para consulta",
      },
      {
        sitePath: "pereira-garcia",
        eyebrow: "Landing page de Holding",
        objective:
          "Transformar um serviço jurídico complexo em uma proposta fácil de entender e agir.",
        solution:
          "Uma página focada em conversão, estruturada por benefícios, tipos de holding, método, dúvidas frequentes e formulário de qualificação.",
        deliverables: [
          "Arquitetura de conversão",
          "Copy",
          "UX/UI",
          "Formulário de leads",
          "Integração com WhatsApp",
          "SEO técnico",
        ],
        imageAlt:
          "Hero da landing page de Holding Familiar da Pereira Garcia, com proposta de valor e formulário de análise inicial",
      },
    ],
  },
];
```

Implementar o agrupamento e a ordem de fontes:

```ts
export function buildPortfolioPresentation(
  items: PortfolioItem[],
): PortfolioPresentation {
  const itemsByPath = new Map(
    items.flatMap((item) =>
      item.site_path ? [[item.site_path, item] as const] : [],
    ),
  );
  const groupedIds = new Set<string>();

  const cases = PORTFOLIO_CASE_CONFIGS.flatMap((config) => {
    const chapters = config.chapters.flatMap((chapterConfig) => {
      const project = itemsByPath.get(chapterConfig.sitePath);
      if (!project) return [];
      groupedIds.add(project.id);
      return [{ project, config: chapterConfig }];
    });

    if (chapters.length === 0) return [];

    return [
      {
        id: config.id,
        client: config.client,
        summary: config.summary,
        services: config.services,
        chapters,
      },
    ];
  });

  return {
    cases,
    ungroupedItems: items.filter((item) => !groupedIds.has(item.id)),
  };
}

export function getPortfolioCoverSources(item: PortfolioItem): string[] {
  const localCover = item.site_path
    ? `/portfolio/covers/${item.site_path}.webp`
    : null;

  return [...new Set([item.portfolio_cover_url, localCover].filter(Boolean))] as string[];
}
```

- [ ] **Step 5: Executar o teste para confirmar GREEN**

Run:

```powershell
npm.cmd run test:portfolio
```

Expected: PASS sem warnings.

- [ ] **Step 6: Validar lint do módulo**

Run:

```powershell
npm.cmd run lint -- src/lib/portfolio-cases.ts
```

Expected: exit code 0.

- [ ] **Step 7: Commitar somente o modelo e seu teste**

```powershell
git add -- package.json scripts/test-portfolio-cases.cjs src/lib/portfolio-cases.ts
git commit -m "Adiciona modelo editorial do portfolio"
```

---

### Task 2: Pipeline reproduzível de screenshots

**Files:**
- Create: `scripts/capture-portfolio-covers.mjs`
- Create: `public/portfolio/covers/pereira-garcia-site.webp`
- Create: `public/portfolio/covers/pereira-garcia.webp`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: slugs passados após `npm run portfolio:covers --`.
- Produces: `public/portfolio/covers/<slug>.webp`.
- Produces: comando `portfolio:covers`.

- [ ] **Step 1: Confirmar a versão e o fluxo oficial do Playwright**

Consultar a documentação oficial antes da instalação:

- `https://playwright.dev/docs/release-notes`
- `https://playwright.dev/docs/browsers`

A versão aprovada para o plano é `1.62.0`, publicada no npm em 28/07/2026.

- [ ] **Step 2: Escrever a prova de comportamento antes da implementação**

Adicionar em `package.json`:

```json
"portfolio:covers": "node scripts/capture-portfolio-covers.mjs pereira-garcia-site pereira-garcia"
```

Executar:

```powershell
npm.cmd run portfolio:covers
```

Expected: FAIL porque `scripts/capture-portfolio-covers.mjs` ainda não existe.

- [ ] **Step 3: Instalar a dependência exata e o Chromium**

Run:

```powershell
npm.cmd install --save-dev --save-exact playwright@1.62.0
npx.cmd playwright install chromium
```

Expected: `package.json` contém `"playwright": "1.62.0"` e o navegador está
disponível.

- [ ] **Step 4: Implementar o servidor estático temporário**

Criar `scripts/capture-portfolio-covers.mjs` com:

```js
import { createServer } from "node:http";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  statSync,
} from "node:fs";
import { extname, resolve, sep } from "node:path";
import { chromium } from "playwright";

const publicRoot = resolve(process.cwd(), "public");
const outputRoot = resolve(publicRoot, "portfolio", "covers");
const slugs = process.argv.slice(2);

if (slugs.length === 0 || slugs.some((slug) => !/^[a-z0-9-]+$/.test(slug))) {
  console.error("Use: node scripts/capture-portfolio-covers.mjs <slug> [slug...]");
  process.exit(1);
}
```

Adicionar o handler HTTP completo:

```js
const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".woff2", "font/woff2"],
  [".webp", "image/webp"],
]);

function servePublicFile(request, response) {
  if (!["GET", "HEAD"].includes(request.method ?? "")) {
    response.writeHead(405).end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(request.url ?? "/", "http://127.0.0.1").pathname,
    );
  } catch {
    response.writeHead(400).end();
    return;
  }

  let filePath = resolve(publicRoot, pathname.replace(/^\/+/, ""));
  if (filePath !== publicRoot && !filePath.startsWith(publicRoot + sep)) {
    response.writeHead(403).end();
    return;
  }

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = resolve(filePath, "index.html");
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404).end();
    return;
  }

  response.writeHead(200, {
    "Content-Type":
      contentTypes.get(extname(filePath).toLowerCase()) ??
      "application/octet-stream",
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  createReadStream(filePath).pipe(response);
}
```

- [ ] **Step 5: Implementar a captura e cleanup**

O fluxo principal deve usar `try/finally`:

```js
mkdirSync(outputRoot, { recursive: true });
const server = createServer(servePublicFile);
await new Promise((resolveListen) =>
  server.listen(0, "127.0.0.1", resolveListen),
);

const address = server.address();
let browser;

try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
  });

  for (const slug of slugs) {
    await page.goto(
      `http://127.0.0.1:${address.port}/sites/${slug}/index.html`,
      { waitUntil: "networkidle" },
    );
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images)
          .filter((image) => !image.complete)
          .map(
            (image) =>
              new Promise((resolveImage) => {
                image.addEventListener("load", resolveImage, { once: true });
                image.addEventListener("error", resolveImage, { once: true });
              }),
          ),
      );
    });

    const hero = page.locator("section.hero").first();
    const box = await hero.boundingBox();
    const captureHeight = Math.min(
      960,
      Math.ceil((box?.y ?? 0) + (box?.height ?? 960)),
    );

    await page.screenshot({
      path: resolve(outputRoot, `${slug}.webp`),
      type: "webp",
      quality: 88,
      clip: { x: 0, y: 0, width: 1440, height: captureHeight },
    });
    console.log(`Captured ${slug}`);
  }
} finally {
  if (browser) await browser.close();
  await new Promise((resolveClose, rejectClose) =>
    server.close((error) => (error ? rejectClose(error) : resolveClose())),
  );
}
```

- [ ] **Step 6: Executar a captura**

Run:

```powershell
npm.cmd run portfolio:covers
```

Expected:

```text
Captured pereira-garcia-site
Captured pereira-garcia
```

- [ ] **Step 7: Validar os artefatos**

Run:

```powershell
node -e "const fs=require('node:fs'); for (const name of ['pereira-garcia-site','pereira-garcia']) { const p='public/portfolio/covers/'+name+'.webp'; const size=fs.statSync(p).size; if(size<10000) throw new Error(p+' is too small'); console.log(p, size) }"
```

Expected: os dois arquivos existem e têm mais de 10 KB.

- [ ] **Step 8: Inspecionar visualmente os dois WebPs**

Abrir ambos os arquivos com a ferramenta de visualização local e confirmar:

- hero correto;
- sem tela de loading;
- sem fontes quebradas;
- sem corte do título ou CTA principal.

- [ ] **Step 9: Commitar pipeline e imagens**

```powershell
git add -- package.json package-lock.json scripts/capture-portfolio-covers.mjs public/portfolio/covers/pereira-garcia-site.webp public/portfolio/covers/pereira-garcia.webp
git commit -m "Gera capas reais para o portfolio"
```

---

### Task 3: Componentes do case editorial

**Files:**
- Create: `src/components/portfolio-project-cover.tsx`
- Create: `src/components/portfolio-case-study.tsx`

**Interfaces:**
- Consumes: `PortfolioCase` e `getPortfolioCoverSources`.
- Produces: `PortfolioProjectCover`.
- Produces: `PortfolioCaseStudy({ portfolioCase, priority })`.

- [ ] **Step 1: Ler a documentação local desta versão do Next.js**

Run:

```powershell
Get-Content -Raw node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md
Get-Content -Raw node_modules/next/dist/docs/01-app/01-getting-started/12-images.md
Get-Content -Raw node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/public-folder.md
```

Expected: leitura completa antes de criar os componentes.

- [ ] **Step 2: Criar o componente cliente de imagem com fallback**

Criar `src/components/portfolio-project-cover.tsx`:

```tsx
"use client";

import { useState } from "react";

export function PortfolioProjectCover({
  sources,
  alt,
  priority = false,
}: {
  sources: string[];
  alt: string;
  priority?: boolean;
}) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const source = sources[sourceIndex];

  if (!source) {
    return (
      <div
        role="img"
        aria-label={alt}
        className="h-full w-full bg-[radial-gradient(circle_at_72%_18%,rgba(247,66,17,.75),transparent_32%),linear-gradient(145deg,#25211f,#0e0e0d_70%)]"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- runtime fallback supports arbitrary manual cover URLs
    <img
      src={source}
      alt={alt}
      width={1440}
      height={960}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      className="h-full w-full object-cover object-top"
      onError={() => setSourceIndex((index) => index + 1)}
    />
  );
}
```

- [ ] **Step 3: Criar a moldura e a narrativa editorial**

Criar `src/components/portfolio-case-study.tsx` com:

```tsx
import { ExternalLink } from "lucide-react";
import { PortfolioProjectCover } from "@/components/portfolio-project-cover";
import {
  getPortfolioCoverSources,
  type PortfolioCase,
  type PortfolioCaseChapter,
} from "@/lib/portfolio-cases";
import { cn } from "@/lib/utils";

export function PortfolioCaseStudy({
  portfolioCase,
  priority = false,
}: {
  portfolioCase: PortfolioCase;
  priority?: boolean;
}) {
  return (
    <article
      aria-labelledby={`case-${portfolioCase.id}`}
      className="py-14 lg:py-24"
    >
      <div className="grid gap-8 border-b border-black/15 pb-12 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--insyt-primary)]">
            Case selecionado
          </p>
          <h3
            id={`case-${portfolioCase.id}`}
            className="mt-4 max-w-xl text-4xl font-bold leading-[0.95] tracking-[-0.045em] sm:text-6xl"
          >
            {portfolioCase.client}
          </h3>
        </div>
        <div className="lg:justify-self-end">
          <p className="max-w-2xl text-lg leading-relaxed text-black/60">
            {portfolioCase.summary}
          </p>
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
            {portfolioCase.services.map((service) => (
              <span key={service}>{service}</span>
            ))}
            <span className="text-[var(--insyt-primary)]">
              {portfolioCase.chapters.length} projetos
            </span>
          </div>
        </div>
      </div>

      <div className="divide-y divide-black/15">
        {portfolioCase.chapters.map((chapter, index) => (
          <CaseChapter
            key={chapter.project.id}
            chapter={chapter}
            index={index}
            priority={priority && index === 0}
          />
        ))}
      </div>
    </article>
  );
}

function CaseChapter({
  chapter,
  index,
  priority,
}: {
  chapter: PortfolioCaseChapter;
  index: number;
  priority: boolean;
}) {
  const href = chapter.project.site_path
    ? `/sites/${chapter.project.site_path}/index.html`
    : null;
  const sources = getPortfolioCoverSources(chapter.project);

  return (
    <section
      aria-labelledby={`project-${chapter.project.id}`}
      className="grid gap-10 py-14 lg:grid-cols-12 lg:items-center lg:gap-12 lg:py-24"
    >
      <div
        className={cn(
          "group relative overflow-hidden rounded-[1.75rem] bg-[#dad3c6] shadow-[0_30px_90px_-45px_rgba(17,16,15,0.6)] lg:col-span-8",
          index % 2 === 1 && "lg:col-start-5",
        )}
      >
        <div
          aria-hidden="true"
          className="flex h-9 items-center gap-1.5 border-b border-black/10 bg-[#e9e4da] px-4"
        >
          <span className="size-2 rounded-full bg-black/15" />
          <span className="size-2 rounded-full bg-black/15" />
          <span className="size-2 rounded-full bg-black/15" />
        </div>
        <div className="aspect-[16/10] overflow-hidden">
          <PortfolioProjectCover
            key={sources.join("|")}
            sources={sources}
            alt={chapter.config.imageAlt}
            priority={priority}
          />
        </div>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir ${chapter.project.title}`}
            className="absolute inset-0 rounded-[1.75rem] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--insyt-primary)]"
          >
            <span className="absolute right-5 top-14 flex size-12 translate-y-2 items-center justify-center rounded-full bg-white text-black opacity-0 transition-[transform,opacity] duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 motion-reduce:transform-none motion-reduce:transition-none">
              <ExternalLink className="size-4" />
            </span>
          </a>
        ) : null}
      </div>

      <div
        className={cn(
          "lg:col-span-4 lg:row-start-1",
          index % 2 === 1 ? "lg:col-start-1" : "lg:col-start-9",
        )}
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--insyt-primary)]">
          {chapter.config.eyebrow}
        </p>
        <h4
          id={`project-${chapter.project.id}`}
          className="mt-4 text-3xl font-bold leading-[0.95] tracking-[-0.04em] sm:text-4xl"
        >
          {chapter.project.title}
        </h4>

        <dl className="mt-8 space-y-7">
          <div>
            <dt className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">
              Objetivo
            </dt>
            <dd className="mt-2 leading-relaxed text-black/60">
              {chapter.config.objective}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">
              Solução
            </dt>
            <dd className="mt-2 leading-relaxed text-black/60">
              {chapter.config.solution}
            </dd>
          </div>
        </dl>

        <ul className="mt-8 flex flex-wrap gap-2" aria-label="Entregas">
          {chapter.config.deliverables.map((deliverable) => (
            <li
              key={deliverable}
              className="rounded-md bg-black/[0.055] px-3 py-2 text-xs font-semibold text-black/60"
            >
              {deliverable}
            </li>
          ))}
        </ul>

        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 border-b border-black pb-1 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--insyt-primary)]"
          >
            Visitar projeto
            <ExternalLink className="size-3.5" />
          </a>
        ) : (
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-black/35">
            Case reservado
          </p>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Validar lint dos componentes**

Run:

```powershell
npm.cmd run lint -- src/components/portfolio-project-cover.tsx src/components/portfolio-case-study.tsx
```

Expected: exit code 0.

- [ ] **Step 5: Commitar componentes**

```powershell
git add -- src/components/portfolio-project-cover.tsx src/components/portfolio-case-study.tsx
git commit -m "Cria apresentacao editorial de cases"
```

---

### Task 4: Integrar o case à página pública

**Files:**
- Modify: `src/app/portfolio/page.tsx`

**Interfaces:**
- Consumes: `buildPortfolioPresentation(items)`.
- Consumes: `PortfolioCaseStudy`.
- Preserva: estado vazio, processo, CTA, footer e item simples para projetos não configurados.

- [ ] **Step 1: Confirmar o teste de apresentação antes da integração**

Run:

```powershell
npm.cmd run test:portfolio
```

Expected: PASS, comprovando agrupamento, ordem e fallback.

- [ ] **Step 2: Preparar a apresentação no Server Component**

Adicionar imports:

```tsx
import { PortfolioCaseStudy } from "@/components/portfolio-case-study";
import { PortfolioProjectCover } from "@/components/portfolio-project-cover";
import {
  buildPortfolioPresentation,
  getPortfolioCoverSources,
} from "@/lib/portfolio-cases";
import {
  getPublicPortfolio,
  type PortfolioItem,
} from "@/app/actions/portfolio";
```

Substituir o import existente de `getPublicPortfolio` pelo import combinado
acima, sem manter duas declarações para o mesmo módulo.

Após buscar os itens:

```tsx
const presentation = buildPortfolioPresentation(items);
```

- [ ] **Step 3: Substituir apenas a renderização da lista**

Dentro de `#projetos`, manter cabeçalho e estado vazio. Para conteúdo:

```tsx
<>
  <div className="divide-y divide-black/15">
    {presentation.cases.map((portfolioCase, index) => (
      <PortfolioCaseStudy
        key={portfolioCase.id}
        portfolioCase={portfolioCase}
        priority={index === 0}
      />
    ))}
  </div>

  {presentation.ungroupedItems.length > 0 ? (
    <div className="mt-16 divide-y divide-black/15 border-t border-black/15">
      {presentation.ungroupedItems.map((item, index) => (
        <SimplePortfolioProject
          key={item.id}
          item={item}
          index={index}
        />
      ))}
    </div>
  ) : null}
</>
```

Extrair o markup simples atual para esta função local no fim do arquivo:

```tsx
function SimplePortfolioProject({
  item,
  index,
}: {
  item: PortfolioItem;
  index: number;
}) {
  const href = item.site_path
    ? `/sites/${item.site_path}/index.html`
    : null;
  const sources = getPortfolioCoverSources(item);

  return (
    <article className="group grid gap-7 py-10 lg:grid-cols-[90px_1fr] lg:py-16">
      <p className="pt-2 text-sm font-bold text-black/35">
        / {String(index + 1).padStart(2, "0")}
      </p>
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1.45fr)_minmax(250px,0.55fr)] lg:items-end">
        <div className="relative aspect-[16/10] overflow-hidden rounded-[1.75rem] bg-[#dad3c6] shadow-[0_25px_70px_-35px_rgba(17,16,15,0.5)]">
          <PortfolioProjectCover
            key={sources.join("|")}
            sources={sources}
            alt={`Hero do projeto ${item.title}`}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent opacity-60" />
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 rounded-[1.75rem] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--insyt-primary)]"
              aria-label={`Abrir projeto ${item.title}`}
            />
          ) : null}
          <span className="pointer-events-none absolute right-5 top-5 flex size-12 translate-y-2 items-center justify-center rounded-full bg-white text-black opacity-0 transition-[transform,opacity] duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 motion-reduce:transform-none motion-reduce:transition-none">
            <ArrowUpRight className="size-5" />
          </span>
        </div>

        <div className="pb-1">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--insyt-primary)]">
            {item.client_company || item.client_name || "Projeto INSYT"}
          </p>
          <h3 className="mt-3 text-3xl font-bold leading-[0.95] tracking-[-0.04em] sm:text-4xl">
            {item.title}
          </h3>
          {item.portfolio_description ? (
            <p className="mt-5 text-base leading-relaxed text-black/55">
              {item.portfolio_description}
            </p>
          ) : null}
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-7 inline-flex items-center gap-2 border-b border-black pb-1 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--insyt-primary)]"
            >
              Visitar projeto
              <ExternalLink className="size-3.5" />
            </a>
          ) : (
            <p className="mt-7 text-xs font-bold uppercase tracking-[0.16em] text-black/35">
              Case reservado
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Remover imports que ficaram sem uso**

Remover ícones e helpers usados exclusivamente pelo markup antigo. Não alterar
hero, seção de processo, CTA ou footer.

- [ ] **Step 5: Executar teste e lint**

Run:

```powershell
npm.cmd run test:portfolio
npm.cmd run lint -- src/app/portfolio/page.tsx src/components/portfolio-case-study.tsx src/components/portfolio-project-cover.tsx src/lib/portfolio-cases.ts
```

Expected: ambos exit code 0.

- [ ] **Step 6: Commitar integração**

```powershell
git add -- src/app/portfolio/page.tsx
git commit -m "Apresenta Pereira Garcia como case unico"
```

---

### Task 5: Verificação visual e de produção

**Files:**
- Verify only: todos os arquivos da entrega.

**Interfaces:**
- Consumes: aplicação final.
- Produces: evidência de funcionamento desktop/mobile, links e build.

- [ ] **Step 1: Ler o skill de verificação em navegador**

Ler `vercel:agent-browser-verify` antes de iniciar o servidor de
desenvolvimento.

- [ ] **Step 2: Executar a suíte focada**

Run:

```powershell
npm.cmd run test:portfolio
npm.cmd run lint -- src/app/portfolio/page.tsx src/components/portfolio-case-study.tsx src/components/portfolio-project-cover.tsx src/lib/portfolio-cases.ts scripts/capture-portfolio-covers.mjs
```

Expected: todos os comandos terminam com exit code 0.

- [ ] **Step 3: Executar build de produção**

Run:

```powershell
npm.cmd run build
```

Expected: compilação, TypeScript e geração de páginas terminam com exit code
0.

- [ ] **Step 4: Verificar desktop**

Abrir `/portfolio` em viewport 1440×1000 e confirmar:

- apenas um case “Pereira Garcia Advocacia”;
- dois capítulos na ordem institucional → Holding;
- heros corretos e nítidos;
- objetivo, solução e entregas aprovados;
- links abrem os respectivos sites;
- nenhum erro ou hydration warning no console.

- [ ] **Step 5: Verificar mobile**

Repetir em viewport 390×844 e confirmar:

- ausência de overflow horizontal;
- imagem antes do texto em cada capítulo;
- títulos sem cortes;
- CTAs acessíveis;
- navegação e seções posteriores preservadas.

- [ ] **Step 6: Conferir escopo Git**

Run:

```powershell
git status --short
git diff --check
git log -5 --oneline
```

Expected: nenhum arquivo temporário; alterações preexistentes não relacionadas
permanecem preservadas.
