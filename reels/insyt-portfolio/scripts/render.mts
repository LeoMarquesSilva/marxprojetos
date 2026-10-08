// Gera o MP4 final sem usar o ffmpeg empacotado do Remotion.
//
// Por quê: nesta máquina o Smart App Control do Windows bloqueia as DLLs não
// assinadas do ffmpeg (exit 3236495362 = 0xC0E90002), então `remotion render`
// renderiza os frames e morre na hora de montar o vídeo. Aqui:
//   1. o Remotion renderiza os frames em JPEG com o Chrome (isso funciona);
//   2. o próprio Chrome (assinado) codifica H.264 + AAC via WebCodecs, com o
//      Mediabunny, e mixa os efeitos sonoros nos tempos de timeline.ts.
// Em outra máquina, `npx remotion render PortfolioReel` também serve.
import { bundle } from "@remotion/bundler";
import { renderFrames, selectComposition } from "@remotion/renderer";
import { createReadStream } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import { BRAND_START, CLICK_AT, CTA_START, CUTS, FPS } from "../src/timeline";

const ROOT = path.resolve(".");
const FRAMES = path.join(ROOT, "out/frames");
const OUTPUT = path.join(ROOT, "out/insyt-portfolio-reel.mp4");

const cues = [
  ...CUTS.map((cut) => ({ file: "whoosh", frame: cut - 2, volume: 0.45 })),
  { file: "switch", frame: BRAND_START + 6, volume: 0.4 },
  { file: "mouse-click", frame: CTA_START + CLICK_AT - 2, volume: 0.7 },
  { file: "ding", frame: CTA_START + CLICK_AT + 6, volume: 0.35 },
];

// 1. Frames
const skipFrames = process.argv.includes("--skip-frames");
const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src/index.ts") });
const composition = await selectComposition({ serveUrl, id: "PortfolioReel" });
if (!skipFrames) {
  await rm(FRAMES, { recursive: true, force: true });
  await mkdir(FRAMES, { recursive: true });
  let last = -1;
  await renderFrames({
    composition,
    serveUrl,
    outputDir: FRAMES,
    imageFormat: "jpeg",
    jpegQuality: 94,
    inputProps: {},
    onStart: () => console.log(`renderizando ${composition.durationInFrames} frames…`),
    onFrameUpdate: (done) => {
      const pct = Math.floor((done / composition.durationInFrames) * 10);
      if (pct !== last) console.log(`frames ${done}/${composition.durationInFrames}`);
      last = pct;
    },
  });
}
const frameFiles = (await readdir(FRAMES)).filter((f) => f.endsWith(".jpeg")).sort();
if (frameFiles.length !== composition.durationInFrames) {
  throw new Error(`esperava ${composition.durationInFrames} frames, achei ${frameFiles.length}`);
}

// 2. Servidor local só para o Chrome ler os frames/sons e devolver o MP4
const TYPES: Record<string, string> = {
  ".jpeg": "image/jpeg",
  ".wav": "audio/wav",
  ".mjs": "text/javascript",
  ".html": "text/html",
};
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (req.method === "POST" && url.pathname === "/save") {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    await writeFile(OUTPUT, Buffer.concat(chunks));
    res.end("ok");
    return;
  }
  const map: Record<string, string> = {
    "/": path.join(ROOT, "scripts/encoder.html"),
    "/mediabunny.mjs": path.join(ROOT, "node_modules/mediabunny/dist/bundles/mediabunny.mjs"),
  };
  const file =
    map[url.pathname] ??
    (url.pathname.startsWith("/frames/")
      ? path.join(FRAMES, path.basename(url.pathname))
      : url.pathname.startsWith("/sfx/")
        ? path.join(ROOT, "public/sfx", path.basename(url.pathname))
        : null);
  if (!file) {
    res.statusCode = 404;
    res.end();
    return;
  }
  res.setHeader("Content-Type", TYPES[path.extname(file)] ?? "application/octet-stream");
  createReadStream(file)
    .on("error", () => {
      res.statusCode = 404;
      res.end();
    })
    .pipe(res);
});
await new Promise<void>((r) => server.listen(0, r));
const port = (server.address() as { port: number }).port;

// 3. Codificação no Chrome
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
page.on("console", (m) => console.log("[chrome]", m.text()));
await page.goto(`http://localhost:${port}/`);
await page.evaluate(
  async (args) => {
    // @ts-expect-error definido em encoder.html
    await window.encode(args);
  },
  {
    frames: frameFiles,
    fps: FPS,
    width: composition.width,
    height: composition.height,
    cues,
  },
);
await browser.close();
server.close();
await rm(FRAMES, { recursive: true, force: true });
console.log(`ok → ${path.relative(ROOT, OUTPUT)}`);
