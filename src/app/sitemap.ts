import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site-url";

// O site público tem uma página só — o portfólio — e as seções são âncoras
// dentro dela. Listar âncoras no sitemap não ajuda: buscadores indexam a
// URL, não o fragmento.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: absoluteUrl("/"),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
