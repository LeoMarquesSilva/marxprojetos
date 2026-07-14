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
//
// Astro's default "directory" build format means page routes have no file
// extension (e.g. href="/sobre" -> dist/sobre/index.html). Next's public/
// folder only serves exact file paths, it won't resolve a directory to its
// index.html the way a normal static host does. So page-route links (no
// extension) get "/index.html" appended in addition to the slug prefix;
// asset links (have an extension) are only prefixed.
const prefix = `/sites/${slugArg}`;
let rewritten = 0;

function rewritePageOrAssetPath(rawPath) {
  const match = rawPath.match(/^([^?#]*)([?#].*)?$/);
  const path = match[1];
  const suffix = match[2] ?? "";
  const withoutTrailingSlash = path.endsWith("/") ? path.slice(0, -1) : path;
  const lastSegment = withoutTrailingSlash.split("/").pop() ?? "";
  const isAsset = lastSegment.includes(".");

  if (isAsset) return `${prefix}/${path}${suffix}`;
  return withoutTrailingSlash
    ? `${prefix}/${withoutTrailingSlash}/index.html${suffix}`
    : `${prefix}/index.html${suffix}`;
}

// Client-side redirects (e.g. a lead form doing
// `window.location.href = "/obrigado"` after a successful submit) end up as
// plain JS string literals, often inlined directly into the page HTML by
// Astro and sometimes staged through a const first (`const l="/obrigado"`),
// so matching the assignment shape isn't reliable. Instead, rewrite any
// quoted string that exactly matches a route we know exists in this build
// (computed from the top-level page directories below) — narrow enough to
// avoid touching unrelated strings that happen to start with "/".
function rewriteKnownRouteLiterals(content, knownRoutes) {
  if (knownRoutes.length === 0) return content;
  const alternation = knownRoutes
    .map((r) => r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const pattern = new RegExp(`(['"])\\/(${alternation})\\/?\\1`, "g");
  return content.replace(pattern, (_m, quote, route) => `${quote}${rewritePageOrAssetPath(route)}${quote}`);
}

// Top-level page routes that exist in this build (e.g. "sobre", "contato"),
// used to safely rewrite bare JS string literals that reference them.
const knownRoutes = readdirSync(dest)
  .filter((entry) => statSync(join(dest, entry)).isDirectory())
  .filter((entry) => existsSync(join(dest, entry, "index.html")));

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    const ext = extname(full);
    if (![".html", ".css", ".js"].includes(ext)) continue;

    const original = readFileSync(full, "utf8");
    let updated = original;

    if (ext === ".html" || ext === ".css") {
      updated = updated
        .replace(
          /(href|src)="\/(?!\/)([^"]*)"/g,
          (_m, attr, path) => `${attr}="${rewritePageOrAssetPath(path)}"`,
        )
        .replace(/srcset="([^"]*)"/g, (_m, value) =>
          `srcset="${value
            .split(",")
            .map((part) =>
              part.replace(/^(\s*)\/(?!\/)([^\s]*)/, (_p, lead, p) => `${lead}${prefix}/${p}`),
            )
            .join(",")}"`,
        )
        .replace(/url\((['"]?)\/(?!\/)([^'")]*)\1\)/g, (_m, quote, path) => `url(${quote}${prefix}/${path}${quote})`);
    }

    if (ext === ".html" || ext === ".js") {
      updated = rewriteKnownRouteLiterals(updated, knownRoutes);
    }

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
