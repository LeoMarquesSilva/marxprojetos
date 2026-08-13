import type {
  PortfolioExternalProject,
  PortfolioItem,
} from "@/app/actions/portfolio";
import {
  getPortfolioCoverSources,
  getPortfolioProjectLink,
} from "@/lib/portfolio-cases";

export type PortfolioProjectCard = {
  id: string;
  title: string;
  clientLabel: string;
  description: string | null;
  href: string | null;
  /** Preview interno abre na mesma aba; site do cliente abre em nova. */
  isExternal: boolean;
  coverSources: string[];
  imageAlt: string;
  highlights: string[];
};

// Une os projetos internos que não fazem parte de um case com os projetos
// externos cadastrados no banco. Ambos usam o mesmo card na página pública.
export function buildPortfolioProjectCards(
  internalItems: PortfolioItem[],
  externalProjects: PortfolioExternalProject[] = [],
): PortfolioProjectCard[] {
  const internalCards = internalItems.map((item) => {
    const link = getPortfolioProjectLink(item);
    return {
      id: `internal:${item.id}`,
      title: item.title,
      clientLabel: item.client_company || item.client_name || "Projeto INSYT",
      description: item.portfolio_description,
      href: link?.href ?? null,
      isExternal: link?.isExternal ?? false,
      coverSources: getPortfolioCoverSources(item),
      imageAlt: item.portfolio_image_alt ?? `Hero do projeto ${item.title}`,
      highlights: [],
    };
  });

  const externalCards = externalProjects.map((project) => ({
    id: `external:${project.id}`,
    title: project.title,
    clientLabel: project.client_label,
    description: project.description,
    href: project.url,
    isExternal: true,
    coverSources: project.cover_url ? [project.cover_url] : [],
    imageAlt: project.image_alt ?? `Capa do projeto ${project.title}`,
    highlights: project.highlights ?? [],
  }));

  return [...internalCards, ...externalCards];
}
