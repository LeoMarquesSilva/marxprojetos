import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

// O site público tem uma página só — o portfólio — e as seções são âncoras
// dentro dela. Listar âncoras no sitemap não ajuda: buscadores indexam a
// URL, não o fragmento.
//
// SITE_URL (sem barra final) alinha com o canonical que o Next emite na
// home — evita sinal misto entre sitemap e <link rel="canonical">.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
