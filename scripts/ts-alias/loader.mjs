// Resolve, fora do Next (testes e o robô do Maps), os imports que o Next
// resolve no build: o alias "@/..." e caminhos relativos sem extensão. Sem
// isso, um módulo de src/lib que importa outro não carregava no Node puro.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const srcRoot = new URL("../../src/", import.meta.url);

function withTsExtension(url) {
  if (/\.[cm]?[jt]sx?$/.test(url.pathname) && existsSync(fileURLToPath(url))) {
    return url;
  }
  for (const suffix of [".ts", ".tsx", "/index.ts"]) {
    const candidate = new URL(url.href + suffix);
    if (existsSync(fileURLToPath(candidate))) return candidate;
  }
  return url;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return nextResolve(withTsExtension(new URL(specifier.slice(2), srcRoot)).href, context);
  }

  const fromTs = context.parentURL && /\.tsx?$/.test(context.parentURL);
  if (fromTs && (specifier.startsWith("./") || specifier.startsWith("../"))) {
    return nextResolve(
      withTsExtension(new URL(specifier, context.parentURL)).href,
      context,
    );
  }

  return nextResolve(specifier, context);
}
