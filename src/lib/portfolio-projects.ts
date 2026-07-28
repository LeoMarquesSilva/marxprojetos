import type { PortfolioItem } from "@/app/actions/portfolio";
import { getPortfolioCoverSources } from "@/lib/portfolio-cases";

export type PortfolioProjectCard = {
  id: string;
  title: string;
  clientLabel: string;
  description: string | null;
  href: string | null;
  coverSources: string[];
  imageAlt: string;
};

const EXTERNAL_PORTFOLIO_PROJECTS: readonly PortfolioProjectCard[] = [
  {
    id: "external:bismarchi-pires",
    title: "Site Institucional â€” Bismarchi | Pires",
    clientLabel: "Bismarchi | Pires",
    description:
      "Um site institucional robusto para apresentar a atuaÃ§Ã£o em reestruturaÃ§Ã£o empresarial e gestÃ£o de crises, reunindo Ã¡reas jurÃ­dicas, equipe e reconhecimentos em uma experiÃªncia de autoridade.",
    href: "https://www.bismarchipires.com.br/",
    coverSources: ["/portfolio/covers/bismarchi-pires.webp"],
    imageAlt:
      "Hero do site Bismarchi Pires, com posicionamento em gestÃ£o estratÃ©gica empresarial e advocacia de alta complexidade",
  },
  {
    id: "external:beatriz-bertho",
    title: "Landing Page â€” Beatriz Bertho Advocacia",
    clientLabel: "Beatriz Bertho Advocacia",
    description:
      "Uma landing page de advocacia preventiva em Direito MÃ©dico que transforma riscos complexos em uma jornada clara de serviÃ§os, mÃ©todo, credenciais e contato.",
    href: "https://beatrizberthoadv.com.br/",
    coverSources: ["/portfolio/covers/beatriz-bertho.webp"],
    imageAlt:
      "Hero da landing page Beatriz Bertho Advocacia, sobre prevenÃ§Ã£o de riscos jurÃ­dicos para mÃ©dicos e clÃ­nicas",
  },
  {
    id: "external:confiara",
    title: "Site Institucional â€” Confiara",
    clientLabel: "Confiara",
    description:
      "Um site institucional estruturado para apresentar a marca, seus serviÃ§os e caminhos de contato em uma navegaÃ§Ã£o direta, clara e responsiva.",
    href: "https://www.confiara.com.br/",
    coverSources: ["/portfolio/covers/confiara.webp"],
    imageAlt:
      "Hero do site institucional Confiara, com apresentaÃ§Ã£o da marca, proposta de valor e chamada principal",
  },
];

export function buildPortfolioProjectCards(
  internalItems: PortfolioItem[],
): PortfolioProjectCard[] {
  const internalCards = internalItems.map((item) => ({
    id: `internal:${item.id}`,
    title: item.title,
    clientLabel:
      item.client_company || item.client_name || "Projeto INSYT",
    description: item.portfolio_description,
    href: item.site_path ? `/sites/${item.site_path}/index.html` : null,
    coverSources: getPortfolioCoverSources(item),
    imageAlt: `Hero do projeto ${item.title}`,
  }));

  return [
    ...internalCards,
    ...EXTERNAL_PORTFOLIO_PROJECTS.map((project) => ({
      ...project,
      coverSources: [...project.coverSources],
    })),
  ];
}
