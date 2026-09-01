// Comentários guardam `page_path` como o caminho real do iframe no momento
// do clique — algo como "/sites/outeiral-advocacia/impacto-social/index.html"
// (ou só "/sites/<slug>/index.html" na home), por causa da reescrita de
// links feita em scripts/sync-site.mjs para servir o build aninhado sob
// /sites/<slug>/. Isso é ótimo para navegar de volta à página exata, mas é
// ilegível numa lista de comentários — aqui vira "Impacto Social", "Início".
export function reviewPageLabel(pagePath: string): string {
  const withoutIndex = pagePath.replace(/\/index\.html$/, "");
  const segments = withoutIndex.split("/").filter(Boolean);
  // Descarta "sites" e o slug do site; o resto é a rota de verdade.
  const routeSegments = segments[0] === "sites" ? segments.slice(2) : segments;

  if (routeSegments.length === 0) return "Início";
  return routeSegments
    .map((segment) => segment.replace(/-/g, " "))
    .join(" / ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
