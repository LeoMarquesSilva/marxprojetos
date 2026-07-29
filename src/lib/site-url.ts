// Origem pública do site, usada por metadata, robots e sitemap.
// Em produção vem de NEXT_PUBLIC_APP_URL; sem ela, o build ainda funciona
// apontando para o localhost do desenvolvimento.
//
// Já aconteceu duas vezes (uma vez com um link em formato markdown colado
// por engano, outra com o nome de outra variável colado no lugar do valor)
// de NEXT_PUBLIC_APP_URL vir com um valor que não é uma URL válida. Como
// layout.tsx usa isso dentro de `new URL(...)` na metadata do App Router,
// e essa metadata é avaliada para TODA rota durante o build — inclusive
// /_not-found — um valor inválido aqui derruba o build inteiro, não só
// uma página. Por isso valida e cai para um padrão seguro em vez de deixar
// o `new URL(...)` de quem consome isso estourar.
const FALLBACK_SITE_URL = "http://localhost:3000";

function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return FALLBACK_SITE_URL;

  try {
    return new URL(raw).toString().replace(/\/+$/, "");
  } catch {
    console.error(
      `NEXT_PUBLIC_APP_URL não é uma URL válida (valor: ${JSON.stringify(raw)}). ` +
        `Usando ${FALLBACK_SITE_URL} para não derrubar o build — corrija a variável na Vercel.`,
    );
    return FALLBACK_SITE_URL;
  }
}

export const SITE_URL = resolveSiteUrl();

export function absoluteUrl(path = "/") {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
