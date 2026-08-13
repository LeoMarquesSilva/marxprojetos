const ADMIN_ROUTE_PREFIXES = [
  "/dashboard",
  "/projects",
  "/crm",
  "/prospeccao",
  // Só a área de montar propostas é privada; /p/<token> é o link do cliente.
  "/propostas",
  "/portfolio/gerenciar",
  "/configuracoes",
  "/sites",
] as const;

export function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

