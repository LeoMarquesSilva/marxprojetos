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
  console.error(
    "Use: node scripts/capture-portfolio-covers.mjs <slug> [slug...]",
  );
  process.exit(1);
}

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

try {
  console.log("Launching Chromium");
  browser = await chromium.launch({ headless: true });
  console.log("Chromium launched");
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
  });

  for (const slug of slugs) {
    console.log(`[${slug}] navigating`);
    await page.goto(
      `http://127.0.0.1:${address.port}/sites/${slug}/index.html`,
      { waitUntil: "domcontentloaded" },
    );
    console.log(`[${slug}] navigation complete`);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    console.log(`[${slug}] fonts ready`);
    await page.evaluate(async () => {
      await Promise.all(
        Array.from(document.querySelectorAll("header img, section.hero img"))
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
    console.log(`[${slug}] images ready`);

    const hero = page.locator("section.hero").first();
    const box = await hero.boundingBox();
    console.log(`[${slug}] hero measured`);
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
    console.log(`[${slug}] captured`);
  }
} finally {
  if (browser) await browser.close();
  await new Promise((resolveClose, rejectClose) =>
    server.close((error) => (error ? rejectClose(error) : resolveClose())),
  );
}
