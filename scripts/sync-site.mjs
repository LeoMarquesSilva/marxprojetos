#!/usr/bin/env node
// Copies a built Astro `dist/` folder into public/sites/<slug>/ so the
// review page (/r/[token]) can iframe it same-origin.
//
// Usage: node scripts/sync-site.mjs <path-to-astro-dist> <slug>

import { cpSync, rmSync, existsSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join, extname } from "node:path";

const [, , srcArg, slugArg] = process.argv;

if (!srcArg || !slugArg) {
  console.error("Usage: node scripts/sync-site.mjs <path-to-astro-dist> <slug>");
  process.exit(1);
}

if (!/^[a-z0-9-]+$/.test(slugArg)) {
  console.error("slug must be lowercase letters, numbers and hyphens only");
  process.exit(1);
}

const src = resolve(process.cwd(), srcArg);
const dest = resolve(process.cwd(), "public", "sites", slugArg);

if (!existsSync(src)) {
  console.error(`Source folder not found: ${src}`);
  process.exit(1);
}

// Clear out existing contents without removing the destination directory
// itself: on Windows, a running dev server can hold a handle on the folder
// that blocks rmSync on the directory entry, even though individual files
// can still be deleted/overwritten fine.
if (existsSync(dest)) {
  for (const entry of readdirSync(dest)) {
    rmSync(join(dest, entry), { recursive: true, force: true });
  }
} else {
  mkdirSync(dest, { recursive: true });
}
cpSync(src, dest, { recursive: true });

// Astro builds assume root hosting (href="/images/..."), but we serve each
// site nested under /sites/<slug>/. Rewrite root-absolute references in the
// copied HTML/CSS so assets resolve correctly, without touching the Astro
// project itself.
const prefix = `/sites/${slugArg}`;
let rewritten = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (![".html", ".css"].includes(extname(full))) continue;

    const original = readFileSync(full, "utf8");
    const updated = original
      .replace(/(href|src)="\/(?!\/)([^"]*)"/g, (_m, attr, path) => `${attr}="${prefix}/${path}"`)
      .replace(/srcset="([^"]*)"/g, (_m, value) =>
        `srcset="${value
          .split(",")
          .map((part) => part.replace(/^(\s*)\/(?!\/)/, `$1${prefix}/`))
          .join(",")}"`,
      )
      .replace(/url\((['"]?)\/(?!\/)([^'")]*)\1\)/g, (_m, quote, path) => `url(${quote}${prefix}/${path}${quote})`);

    if (updated !== original) {
      writeFileSync(full, updated, "utf8");
      rewritten++;
    }
  }
}

walk(dest);

console.log(`Copied ${src} -> ${dest}`);
console.log(`Rewrote root-absolute asset paths in ${rewritten} file(s).`);
console.log(`Review site path for this project: ${slugArg}`);
console.log("Redeploy site-creator for this to go live in production.");
