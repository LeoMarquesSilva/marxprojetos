// Renderiza frames soltos para revisão visual: node scripts/stills.mjs 0 40 110 ...
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";

const frames = process.argv.slice(2).map(Number);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: "PortfolioReel" });
console.log("total frames", composition.durationInFrames);
for (const frame of frames) {
  await renderStill({ composition, serveUrl, frame, output: `out/stills/f${String(frame).padStart(4, "0")}.jpg`, imageFormat: "jpeg", jpegQuality: 80, scale: 0.5 });
  console.log("ok", frame);
}
