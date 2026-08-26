const ADMIN_ROUTE_PREFIXES = [
  "/dashboard",
  "/projects",
  "/crm",
  "/prospeccao",
  // Só a área de montar propostas é privada; /p/<token> é o link do cliente.
  "/propostas",
  "/portfolio/gerenciar",
  "/configuracoes",
] as const;

// /sites é dois mundos sob o mesmo prefixo: /sites e /sites/<id> são a
// listagem e a página de configuração de um projeto (autenticadas), mas
// /sites/<slug>/<arquivo> é o build estático do site do cliente, servido de
// public/sites/<slug>/ — precisa ser público. É esse caminho que o iframe
// da revisão (/r/<token>) carrega — sem esse recorte, o cliente sem login
// caía na tela de login da INSYT dentro do iframe, em vez de ver o site.
const SITES_ADMIN_PATTERN = /^\/sites(\/[^/]+)?$/;

export function isAdminRoute(pathname: string): boolean {
  if (SITES_ADMIN_PATTERN.test(pathname)) return true;
  return ADMIN_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
