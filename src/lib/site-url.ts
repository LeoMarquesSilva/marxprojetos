// Origem pública do site, usada por metadata, robots e sitemap.
// Em produção vem de NEXT_PUBLIC_APP_URL; sem ela, o build ainda funciona
// apontando para o localhost do desenvolvimento.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
).replace(/\/+$/, "");

export function absoluteUrl(path = "/") {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
