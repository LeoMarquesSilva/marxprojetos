# External Portfolio Projects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Bismarchi | Pires, Beatriz Bertho Advocacia, and Confiara as individual external projects below the existing Pereira Garcia case, with real hero covers, editorial descriptions, and direct links.

**Architecture:** Keep operational projects and the Supabase RPC unchanged. A focused catalog module will adapt both existing Supabase items and three versioned external entries into one `PortfolioProjectCard` view model; a reusable server component will render that model. The existing Playwright capture script will accept local slugs and explicit external `slug=url` targets while isolating per-site failures.

**Tech Stack:** Next.js 16.2.9 App Router, React 19.2.4, TypeScript, Tailwind CSS 4, Node.js tests, Playwright 1.62.0.

## Global Constraints

- Preserve the existing Pereira Garcia case and the rest of `/portfolio`.
- Display external projects after existing Supabase-backed ungrouped projects.
- Keep the external order: Bismarchi | Pires, Beatriz Bertho Advocacia, Confiara.
- Open external project links in a new tab with `rel="noopener noreferrer"`.
- Store covers as WebP files under `public/portfolio/covers`.
- Use a 1440 × 960 viewport for cover capture.
- A failed external capture must not prevent the remaining targets from being attempted.
- Do not create or alter Supabase tables, RPCs, RLS policies, or project rows.
- Do not publish or deploy the application.
- Preserve all unrelated working-tree changes and stage only files named by the active task.
- Before editing Next.js code, read the relevant local guides in `node_modules/next/dist/docs/`.

---

## File Structure

- Create `src/lib/portfolio-projects.ts`: typed external catalog and adapter from `PortfolioItem` to display cards.
- Create `src/components/portfolio-project-card.tsx`: reusable card renderer for internal and external projects.
- Create `scripts/test-portfolio-projects.cjs`: catalog, order, URL, copy, and internal-adapter tests.
- Create `scripts/test-portfolio-project-card.cjs`: server-render test for external links and card content.
- Create `scripts/portfolio-cover-targets.mjs`: pure parser for local slugs and `slug=url` capture targets.
- Create `scripts/test-portfolio-cover-targets.mjs`: parser validation and URL tests.
- Modify `src/app/portfolio/page.tsx`: combine the existing presentation with the new card models and use the extracted component.
- Modify `scripts/capture-portfolio-covers.mjs`: capture local and external targets with failure isolation.
- Modify `package.json`: include new tests and the repeatable external cover command.
- Add `public/portfolio/covers/bismarchi-pires.webp`.
- Add `public/portfolio/covers/beatriz-bertho.webp`.
- Add `public/portfolio/covers/confiara.webp` if the public site is reachable; otherwise preserve the tested fallback and report the unavailable target.

---

### Task 1: Typed external project catalog

**Files:**
- Create: `src/lib/portfolio-projects.ts`
- Create: `scripts/test-portfolio-projects.cjs`
- Modify: `package.json`
- Read before editing: `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`

**Interfaces:**
- Consumes: `PortfolioItem` from `src/app/actions/portfolio.ts`
- Consumes: `getPortfolioCoverSources(item: PortfolioItem): string[]` from `src/lib/portfolio-cases.ts`
- Produces:

```ts
export type PortfolioProjectCard = {
  id: string;
  title: string;
  clientLabel: string;
  description: string | null;
  href: string | null;
  coverSources: string[];
  imageAlt: string;
};

export function buildPortfolioProjectCards(
  internalItems: PortfolioItem[],
): PortfolioProjectCard[];
```

- [ ] **Step 1: Write the failing catalog test**

Create `scripts/test-portfolio-projects.cjs`. Transpile
`src/lib/portfolio-projects.ts` with the same TypeScript/CommonJS loader used by
`scripts/test-portfolio-cases.cjs`. Mock `@/lib/portfolio-cases` with:

```js
{
  getPortfolioCoverSources: (item) => [
    `/portfolio/covers/${item.site_path}.webp`,
  ],
}
```

Call `buildPortfolioProjectCards` with one internal item and assert:

```js
assert.equal(cards.length, 4);
assert.equal(cards[0].id, "internal:existing");
assert.equal(cards[0].href, "/sites/internal-site/index.html");
assert.deepEqual(
  cards.slice(1).map((card) => card.clientLabel),
  ["Bismarchi | Pires", "Beatriz Bertho Advocacia", "Confiara"],
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
node scripts/test-portfolio-projects.cjs
```

Expected: FAIL because `src/lib/portfolio-projects.ts` does not exist.

- [ ] **Step 3: Implement the catalog and adapter**

Create `src/lib/portfolio-projects.ts` with a private, readonly external catalog
and the exported adapter. Use these exact editorial entries:

```ts
const EXTERNAL_PORTFOLIO_PROJECTS: readonly PortfolioProjectCard[] = [
  {
    id: "external:bismarchi-pires",
    title: "Site Institucional — Bismarchi | Pires",
    clientLabel: "Bismarchi | Pires",
    description:
      "Um site institucional robusto para apresentar a atuação em reestruturação empresarial e gestão de crises, reunindo áreas jurídicas, equipe e reconhecimentos em uma experiência de autoridade.",
    href: "https://www.bismarchipires.com.br/",
    coverSources: ["/portfolio/covers/bismarchi-pires.webp"],
    imageAlt:
      "Hero do site Bismarchi Pires, com posicionamento em gestão estratégica empresarial e advocacia de alta complexidade",
  },
  {
    id: "external:beatriz-bertho",
    title: "Landing Page — Beatriz Bertho Advocacia",
    clientLabel: "Beatriz Bertho Advocacia",
    description:
      "Uma landing page de advocacia preventiva em Direito Médico que transforma riscos complexos em uma jornada clara de serviços, método, credenciais e contato.",
    href: "https://beatrizberthoadv.com.br/",
    coverSources: ["/portfolio/covers/beatriz-bertho.webp"],
    imageAlt:
      "Hero da landing page Beatriz Bertho Advocacia, sobre prevenção de riscos jurídicos para médicos e clínicas",
  },
  {
    id: "external:confiara",
    title: "Site Institucional — Confiara",
    clientLabel: "Confiara",
    description:
      "Um site institucional estruturado para apresentar a marca, seus serviços e caminhos de contato em uma navegação direta, clara e responsiva.",
    href: "https://www.confiara.com.br/",
    coverSources: ["/portfolio/covers/confiara.webp"],
    imageAlt:
      "Hero do site institucional Confiara, com apresentação da marca, proposta de valor e chamada principal",
  },
];
```

Map internal items before the external array:

```ts
const internalCards = internalItems.map((item) => ({
  id: `internal:${item.id}`,
  title: item.title,
  clientLabel:
    item.client_company || item.client_name || "Projeto INSYT",
  description: item.portfolio_description,
  href: item.site_path ? `/sites/${item.site_path}/index.html` : null,
  coverSources: getPortfolioCoverSources(item),
  imageAlt: `Hero do projeto ${item.title}`,
}));

return [...internalCards, ...EXTERNAL_PORTFOLIO_PROJECTS];
```

Return fresh card objects for external entries so callers cannot mutate the
module-level catalog.

- [ ] **Step 4: Add the catalog test to the portfolio suite**

Change `test:portfolio` in `package.json` to run:

```json
"test:portfolio": "node scripts/test-portfolio-cases.cjs && node scripts/test-portfolio-projects.cjs && node scripts/test-portfolio-case-study.cjs"
```

- [ ] **Step 5: Run tests and lint**

Run:

```powershell
npm.cmd run test:portfolio
npm.cmd run lint -- src/lib/portfolio-projects.ts scripts/test-portfolio-projects.cjs
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit the catalog**

Stage only:

```powershell
git add -- src/lib/portfolio-projects.ts scripts/test-portfolio-projects.cjs package.json
git commit -m "Adiciona catalogo externo ao portfolio"
```

---

### Task 2: Reusable project card

**Files:**
- Create: `src/components/portfolio-project-card.tsx`
- Create: `scripts/test-portfolio-project-card.cjs`
- Modify: `package.json`
- Read before editing: `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`

**Interfaces:**
- Consumes: `PortfolioProjectCard` from `src/lib/portfolio-projects.ts`
- Consumes: `PortfolioProjectCover` from `src/components/portfolio-project-cover.tsx`
- Produces:

```ts
export function PortfolioProjectCardView({
  project,
  index,
}: {
  project: PortfolioProjectCard;
  index: number;
}): React.JSX.Element;
```

- [ ] **Step 1: Write the failing server-render test**

Create `scripts/test-portfolio-project-card.cjs` using the transpile and
`renderToStaticMarkup` pattern from
`scripts/test-portfolio-case-study.cjs`. Mock:

```js
if (request === "lucide-react") {
  return { ArrowUpRight: () => null, ExternalLink: () => null };
}
if (request === "@/components/portfolio-project-cover") {
  return { PortfolioProjectCover: () => null };
}
```

Render an external card and assert:

```js
assert.match(html, /Bismarchi \| Pires/);
assert.match(html, /Site Institucional/);
assert.match(html, /href="https:\/\/www\.bismarchipires\.com\.br\/"/);
assert.match(html, /target="_blank"/);
assert.match(html, /rel="noopener noreferrer"/);
assert.match(html, /Visitar projeto/);
assert.match(html, /Abrir projeto Site Institucional/);
```

Render a card with `href: null` and assert that it contains `Case reservado`
and does not contain `target="_blank"`.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
node scripts/test-portfolio-project-card.cjs
```

Expected: FAIL because the component file does not exist.

- [ ] **Step 3: Extract the card renderer**

Move the current `SimplePortfolioProject` markup from
`src/app/portfolio/page.tsx` into
`src/components/portfolio-project-card.tsx`. Replace field access with the
view-model fields:

```tsx
<PortfolioProjectCover
  key={project.coverSources.join("|")}
  sources={project.coverSources}
  alt={project.imageAlt}
/>
```

Use `project.href`, `project.clientLabel`, `project.title`, and
`project.description`. Keep the current aspect ratio, hover treatment,
keyboard focus rings, reduced-motion classes, and empty-link fallback.

- [ ] **Step 4: Add the component test to the suite**

Change `test:portfolio` in `package.json` to:

```json
"test:portfolio": "node scripts/test-portfolio-cases.cjs && node scripts/test-portfolio-projects.cjs && node scripts/test-portfolio-case-study.cjs && node scripts/test-portfolio-project-card.cjs"
```

- [ ] **Step 5: Run tests and lint**

Run:

```powershell
npm.cmd run test:portfolio
npm.cmd run lint -- src/components/portfolio-project-card.tsx scripts/test-portfolio-project-card.cjs
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit the reusable card**

Stage only:

```powershell
git add -- src/components/portfolio-project-card.tsx scripts/test-portfolio-project-card.cjs package.json
git commit -m "Extrai card editorial do portfolio"
```

---

### Task 3: Integrate external cards into the public page

**Files:**
- Modify: `src/app/portfolio/page.tsx`
- Test: `scripts/test-portfolio-projects.cjs`
- Test: `scripts/test-portfolio-project-card.cjs`

**Interfaces:**
- Consumes: `buildPortfolioProjectCards(items: PortfolioItem[]): PortfolioProjectCard[]`
- Consumes: `PortfolioProjectCardView`
- Produces: `/portfolio` with the Pereira Garcia case followed by existing internal cards and the three external cards.

- [ ] **Step 1: Add a source-level integration assertion**

Extend `scripts/test-portfolio-projects.cjs` to read
`src/app/portfolio/page.tsx` and assert:

```js
assert.match(pageSource, /buildPortfolioProjectCards/);
assert.match(pageSource, /PortfolioProjectCardView/);
assert.doesNotMatch(pageSource, /function SimplePortfolioProject/);
```

- [ ] **Step 2: Run the suite to verify it fails**

Run:

```powershell
npm.cmd run test:portfolio
```

Expected: FAIL because the page still contains `SimplePortfolioProject` and
does not consume the new adapter/component.

- [ ] **Step 3: Integrate the view models**

In `src/app/portfolio/page.tsx`:

1. remove the local `SimplePortfolioProject` function;
2. remove `PortfolioProjectCover`, `PortfolioItem`, `ArrowUpRight`, and
   `ExternalLink` imports if no longer used elsewhere;
3. import `PortfolioProjectCardView`;
4. import `buildPortfolioProjectCards`;
5. after `buildPortfolioPresentation(items)`, compute:

```ts
const projectCards = buildPortfolioProjectCards(
  presentation.ungroupedItems,
);
```

6. render:

```tsx
{projectCards.map((project, index) => (
  <PortfolioProjectCardView
    key={project.id}
    project={project}
    index={index}
  />
))}
```

Keep the empty-state logic based on both sources:

```ts
const hasPortfolioContent =
  presentation.cases.length > 0 || projectCards.length > 0;
```

The three catalog entries mean the public page remains populated even when the
Supabase RPC returns no published projects.

- [ ] **Step 4: Run tests and lint**

Run:

```powershell
npm.cmd run test:portfolio
npm.cmd run lint -- src/app/portfolio/page.tsx src/components/portfolio-project-card.tsx src/lib/portfolio-projects.ts
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit page integration**

Stage only:

```powershell
git add -- src/app/portfolio/page.tsx scripts/test-portfolio-projects.cjs
git commit -m "Exibe projetos externos no portfolio"
```

---

### Task 4: External cover capture pipeline

**Files:**
- Create: `scripts/portfolio-cover-targets.mjs`
- Create: `scripts/test-portfolio-cover-targets.mjs`
- Modify: `scripts/capture-portfolio-covers.mjs`
- Modify: `package.json`
- Add: `public/portfolio/covers/bismarchi-pires.webp`
- Add: `public/portfolio/covers/beatriz-bertho.webp`
- Add when reachable: `public/portfolio/covers/confiara.webp`
- Read before editing: `node_modules/next/dist/docs/01-app/01-getting-started/12-images.md`
- Read before editing: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/public-folder.md`

**Interfaces:**
- Produces:

```js
export function parseCaptureTargets(inputs, localBaseUrl) {
  // => Array<{ slug: string; url: string }>
}
```

- CLI format:

```text
node scripts/capture-portfolio-covers.mjs <slug> [slug...]
node scripts/capture-portfolio-covers.mjs <slug=https://domain/> [...]
```

- [ ] **Step 1: Write failing parser tests**

Create `scripts/test-portfolio-cover-targets.mjs`:

```js
import assert from "node:assert/strict";
import { parseCaptureTargets } from "./portfolio-cover-targets.mjs";

assert.deepEqual(
  parseCaptureTargets(
    [
      "pereira-garcia",
      "bismarchi-pires=https://www.bismarchipires.com.br/",
    ],
    "http://127.0.0.1:4321",
  ),
  [
    {
      slug: "pereira-garcia",
      url: "http://127.0.0.1:4321/sites/pereira-garcia/index.html",
    },
    {
      slug: "bismarchi-pires",
      url: "https://www.bismarchipires.com.br/",
    },
  ],
);

assert.throws(
  () => parseCaptureTargets(["Bad Slug=https://example.com"], "http://local"),
  /Invalid capture target/,
);
assert.throws(
  () => parseCaptureTargets(["safe=file:///etc/passwd"], "http://local"),
  /Invalid capture target/,
);
```

- [ ] **Step 2: Run the parser test to verify it fails**

Run:

```powershell
node scripts/test-portfolio-cover-targets.mjs
```

Expected: FAIL because `scripts/portfolio-cover-targets.mjs` does not exist.

- [ ] **Step 3: Implement strict target parsing**

Create `scripts/portfolio-cover-targets.mjs` with:

```js
const slugPattern = /^[a-z0-9-]+$/;

export function parseCaptureTargets(inputs, localBaseUrl) {
  if (inputs.length === 0) {
    throw new Error("Provide at least one portfolio capture target.");
  }

  return inputs.map((input) => {
    const separator = input.indexOf("=");
    const slug = separator === -1 ? input : input.slice(0, separator);
    const externalUrl =
      separator === -1 ? null : input.slice(separator + 1);

    if (!slugPattern.test(slug)) {
      throw new Error(`Invalid capture target: ${input}`);
    }

    if (separator !== -1 && !externalUrl) {
      throw new Error(`Invalid capture target: ${input}`);
    }

    if (externalUrl) {
      const url = new URL(externalUrl);
      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error(`Invalid capture target: ${input}`);
      }
      return { slug, url: url.href };
    }

    return {
      slug,
      url: `${localBaseUrl}/sites/${slug}/index.html`,
    };
  });
}
```

Treat an empty URL after `=` as invalid instead of silently using the local
site.

- [ ] **Step 4: Refactor capture execution**

In `scripts/capture-portfolio-covers.mjs`:

1. import `parseCaptureTargets`;
2. start the local server as today so local slugs continue working;
3. create a browser context with `ignoreHTTPSErrors: true`;
4. parse all arguments after the server port is known;
5. navigate each target with `waitUntil: "domcontentloaded"` and a 30-second
   timeout;
6. wait for `document.fonts.ready` with a 10-second timeout race;
7. attempt to dismiss visible cookie controls whose text is exactly `Entendi`,
   `Aceitar`, or `Aceitar todos`;
8. wait for visible images inside `header`, `main > section:first-of-type`, or
   `section.hero`, but cap the wait at 10 seconds;
9. capture the top viewport with:

```js
await page.screenshot({
  path: resolve(outputRoot, `${target.slug}.webp`),
  type: "webp",
  quality: 88,
  clip: { x: 0, y: 0, width: 1440, height: 960 },
});
```

10. wrap each target in its own `try/catch`, collect failures, and continue;
11. after closing browser/server, print every failed slug and set
    `process.exitCode = 1` if any failed.

- [ ] **Step 5: Add tests and repeatable scripts**

Change `test:portfolio` to:

```json
"test:portfolio": "node scripts/test-portfolio-cases.cjs && node scripts/test-portfolio-projects.cjs && node scripts/test-portfolio-case-study.cjs && node scripts/test-portfolio-project-card.cjs && node scripts/test-portfolio-cover-targets.mjs"
```

Keep `portfolio:covers` for the two Pereira Garcia local slugs and add:

```json
"portfolio:covers:external": "node scripts/capture-portfolio-covers.mjs bismarchi-pires=https://www.bismarchipires.com.br/ beatriz-bertho=https://beatrizberthoadv.com.br/ confiara=https://www.confiara.com.br/"
```

- [ ] **Step 6: Run parser tests and lint**

Run:

```powershell
npm.cmd run test:portfolio
npm.cmd run lint -- scripts/portfolio-cover-targets.mjs scripts/test-portfolio-cover-targets.mjs scripts/capture-portfolio-covers.mjs
```

Expected: both commands exit 0.

- [ ] **Step 7: Generate the external covers**

Run:

```powershell
npm.cmd run portfolio:covers:external
```

Expected when all sites are reachable:

```text
[bismarchi-pires] captured
[beatriz-bertho] captured
[confiara] captured
```

If Confiara remains unavailable, verify that the first two WebPs were still
created, leave `confiara.webp` absent so the tested gradient fallback is used,
and report the failed URL without fabricating a screenshot.

- [ ] **Step 8: Inspect every generated image**

Open each generated WebP and confirm:

- the logo/header and primary hero message are visible;
- there is no cookie banner obscuring the main content;
- text is not clipped horizontally;
- no browser error page was captured;
- the image is exactly 1440 pixels wide.

Regenerate a target after adjusting only its deterministic wait/dismiss logic
if it fails inspection.

- [ ] **Step 9: Commit the capture pipeline and covers**

Stage only:

```powershell
git add -- scripts/portfolio-cover-targets.mjs scripts/test-portfolio-cover-targets.mjs scripts/capture-portfolio-covers.mjs package.json public/portfolio/covers/bismarchi-pires.webp public/portfolio/covers/beatriz-bertho.webp
```

Add `public/portfolio/covers/confiara.webp` only if it was successfully
generated and inspected. Commit:

```powershell
git commit -m "Gera capas dos projetos externos"
```

---

### Task 5: Production verification

**Files:**
- Verify: `src/app/portfolio/page.tsx`
- Verify: `src/components/portfolio-project-card.tsx`
- Verify: `src/lib/portfolio-projects.ts`
- Verify: `public/portfolio/covers/*.webp`

**Interfaces:**
- Consumes the finished implementation.
- Produces evidence that the public page, tests, links, and production build are healthy.

- [ ] **Step 1: Run the complete portfolio test suite**

Run:

```powershell
npm.cmd run test:portfolio
```

Expected: every portfolio test prints its pass message and the command exits 0.

- [ ] **Step 2: Run focused lint**

Run:

```powershell
npm.cmd run lint -- src/app/portfolio/page.tsx src/components/portfolio-project-card.tsx src/components/portfolio-project-cover.tsx src/components/portfolio-case-study.tsx src/lib/portfolio-cases.ts src/lib/portfolio-projects.ts scripts/capture-portfolio-covers.mjs scripts/portfolio-cover-targets.mjs scripts/test-portfolio-cases.cjs scripts/test-portfolio-projects.cjs scripts/test-portfolio-case-study.cjs scripts/test-portfolio-project-card.cjs scripts/test-portfolio-cover-targets.mjs
```

Expected: exit 0 with no ESLint errors.

- [ ] **Step 3: Build production**

Run:

```powershell
npm.cmd run build
```

Expected: Next.js compilation, TypeScript, page data, and static generation all
complete with exit 0.

- [ ] **Step 4: Verify the production page in a browser**

Start production on an unused local port and inspect `/portfolio` at:

- desktop: 1440 × 1000;
- mobile: 390 × 844.

Assert:

```js
{
  externalProjectCount: 3,
  externalOrder: [
    "Site Institucional — Bismarchi | Pires",
    "Landing Page — Beatriz Bertho Advocacia",
    "Site Institucional — Confiara",
  ],
  horizontalOverflow: 0,
  nextDialogVisible: false,
  consoleErrors: [],
  pageErrors: [],
}
```

Scroll each external card into view so lazy covers load. Confirm every existing
cover has `naturalWidth > 0`; confirm Confiara uses the visual fallback if its
cover could not be generated.

- [ ] **Step 5: Verify external URLs**

Request or open:

```text
https://www.bismarchipires.com.br/
https://beatrizberthoadv.com.br/
https://www.confiara.com.br/
```

Record the actual response of each domain. A remote outage is not an
application build failure, but it must be reported and must not remove the
portfolio card.

- [ ] **Step 6: Check repository scope**

Run:

```powershell
git diff --check
git diff --cached --name-only
git status --short
git log -8 --oneline
```

Expected: no staged files, no whitespace errors, implementation commits present,
and all unrelated pre-existing changes preserved.

- [ ] **Step 7: Finish the development branch**

Invoke `superpowers:verification-before-completion`, then
`superpowers:finishing-a-development-branch`. Because the user selected inline
execution on `master`, preserve the normal repository and do not push or deploy
without a new explicit request.
