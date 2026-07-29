import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site-url";

// Só o portfólio deve ser indexado. As áreas autenticadas e os links de
// revisão/briefing são privados: mesmo protegidos por login ou token, não
// faz sentido gastar rastreamento neles nem arriscar que uma URL de token
// vaze para um índice de busca.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/projects",
        "/crm",
        "/prospeccao",
        "/configuracoes",
        "/portfolio/gerenciar",
        "/login",
        "/r/",
        "/b/",
        "/sites/",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
