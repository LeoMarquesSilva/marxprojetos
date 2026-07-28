import { createServer } from "node:http";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  statSync,
} from "node:fs";
import { extname, resolve, sep } from "node:path";
import { chromium } from "playwright";
import { parseCaptureTargets } from "./portfolio-cover-targets.mjs";

const publicRoot = resolve(process.cwd(), "public");
const outputRoot = resolve(publicRoot, "portfolio", "covers");
const inputs = process.argv.slice(2);
const systemChromePath =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

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

mkdirSync(outputRoot, { recursive: true });
const server = createServer(servePublicFile);
await new Promise((resolveListen) =>
  server.listen(0, "127.0.0.1", resolveListen),
);

const address = server.address();
if (!address || typeof address === "string") {
  server.close();
  throw new Error("Could not start the temporary portfolio server.");
}

let browser;
let context;
const failures = [];

try {
  const localBaseUrl = `http://127.0.0.1:${address.port}`;
  const targets = parseCaptureTargets(inputs, localBaseUrl);

  console.log("Launching Chromium");
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    if (!existsSync(systemChromePath)) throw error;
    console.warn("Bundled Chromium unavailable; using system Chrome.");
    browser = await chromium.launch({
      executablePath: systemChromePath,
      headless: true,
    });
  }
  console.log("Chromium launched");
  context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  });

  for (const target of targets) {
    let page;

    try {
      page = await context.newPage();
      console.log(`[${target.slug}] navigating ${target.url}`);
      await page.goto(target.url, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      console.log(`[${target.slug}] navigation complete`);

      await Promise.race([
        page.evaluate(async () => {
          await document.fonts.ready;
        }),
        page.waitForTimeout(10_000),
      ]);
      console.log(`[${target.slug}] font wait complete`);

      for (const label of ["Entendi", "Aceitar", "Aceitar todos"]) {
        const controls = page.getByText(label, { exact: true });
        const count = await controls.count();

        for (let index = 0; index < count; index += 1) {
          const control = controls.nth(index);
          if (await control.isVisible()) {
            await control.click({ timeout: 2_000 }).catch(() => {});
          }
        }
      }

      await page
        .waitForFunction(
          () => {
            const heading = document.querySelector(
              "main > section:first-of-type h1, main > section:first-of-type h2, section.hero h1, section.hero h2, h1",
            );

            return Boolean(
              heading?.textContent?.trim() &&
                Number.parseFloat(getComputedStyle(heading).opacity) >= 0.95,
            );
          },
          undefined,
          { timeout: 10_000 },
        )
        .catch(() => {});

      await page
        .waitForFunction(
          () =>
            Array.from(
              document.querySelectorAll(
                "header img, main > section:first-of-type img, section.hero img",
              ),
            )
              .filter((image) => {
                const style = getComputedStyle(image);
                const bounds = image.getBoundingClientRect();
                return (
                  style.display !== "none" &&
                  style.visibility !== "hidden" &&
                  bounds.width > 0 &&
                  bounds.height > 0
                );
              })
              .every((image) => image.complete),
          undefined,
          { timeout: 10_000 },
        )
        .catch(() => {});
      console.log(`[${target.slug}] image wait complete`);

      await page.screenshot({
        path: resolve(outputRoot, `${target.slug}.webp`),
        type: "webp",
        quality: 88,
        clip: { x: 0, y: 0, width: 1440, height: 960 },
      });
      console.log(`[${target.slug}] captured`);
    } catch (error) {
      failures.push({ target, error });
    } finally {
      if (page) await page.close();
    }
  }
} finally {
  if (context) await context.close();
  if (browser) await browser.close();
  await new Promise((resolveClose, rejectClose) =>
    server.close((error) => (error ? rejectClose(error) : resolveClose())),
  );
}

for (const { target, error } of failures) {
  console.error(
    `[${target.slug}] failed ${target.url}: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
}

if (failures.length > 0) {
  process.exitCode = 1;
}
