import type { PortfolioItem } from "@/app/actions/portfolio";

export type PortfolioChapterConfig = {
  sitePath: string;
  eyebrow: string;
  objective: string;
  solution: string;
  deliverables: string[];
  imageAlt: string;
};

export type PortfolioCaseConfig = {
  id: string;
  client: string;
  summary: string;
  services: string[];
  chapters: PortfolioChapterConfig[];
};

export type PortfolioCaseChapter = {
  project: PortfolioItem;
  config: PortfolioChapterConfig;
};

export type PortfolioCase = Omit<PortfolioCaseConfig, "chapters"> & {
  chapters: PortfolioCaseChapter[];
};

export type PortfolioPresentation = {
  cases: PortfolioCase[];
  ungroupedItems: PortfolioItem[];
};

const PORTFOLIO_CASE_CONFIGS: PortfolioCaseConfig[] = [
  {
    id: "pereira-garcia",
    client: "Pereira Garcia Advocacia",
    summary:
      "Uma presença digital construída para traduzir mais de quatro décadas de experiência jurídica em autoridade, clareza e novos pontos de contato.",
    services: ["Estratégia", "Conteúdo", "UX/UI", "Desenvolvimento"],
    chapters: [
      {
        sitePath: "pereira-garcia-site",
        eyebrow: "Site institucional",
        objective:
          "Consolidar a autoridade do escritório e organizar sua atuação para empresas familiares.",
        solution:
          "Uma experiência sóbria e editorial, com navegação clara, história, equipe, áreas jurídicas e contato.",
        deliverables: [
          "Estratégia de conteúdo",
          "UX/UI",
          "Desenvolvimento responsivo",
          "SEO local",
          "Páginas institucionais",
        ],
        imageAlt:
          "Hero do site institucional Pereira Garcia Advocacia, com navegação, posicionamento jurídico e chamada para consulta",
      },
      {
        sitePath: "pereira-garcia",
        eyebrow: "Landing page de Holding",
        objective:
          "Transformar um serviço jurídico complexo em uma proposta fácil de entender e agir.",
        solution:
          "Uma página focada em conversão, estruturada por benefícios, tipos de holding, método, dúvidas frequentes e formulário de qualificação.",
        deliverables: [
          "Arquitetura de conversão",
          "Copy",
          "UX/UI",
          "Formulário de leads",
          "Integração com WhatsApp",
          "SEO técnico",
        ],
        imageAlt:
          "Hero da landing page de Holding Familiar da Pereira Garcia, com proposta de valor e formulário de análise inicial",
      },
    ],
  },
];

export function buildPortfolioPresentation(
  items: PortfolioItem[],
): PortfolioPresentation {
  const itemsByPath = new Map(
    items.flatMap((item) =>
      item.site_path ? [[item.site_path, item] as const] : [],
    ),
  );
  const groupedIds = new Set<string>();

  const cases = PORTFOLIO_CASE_CONFIGS.flatMap((config) => {
    const chapters = config.chapters.flatMap((chapterConfig) => {
      const project = itemsByPath.get(chapterConfig.sitePath);
      if (!project) return [];

      groupedIds.add(project.id);
      return [{ project, config: chapterConfig }];
    });

    if (chapters.length === 0) return [];

    return [
      {
        id: config.id,
        client: config.client,
        summary: config.summary,
        services: config.services,
        chapters,
      },
    ];
  });

  return {
    cases,
    ungroupedItems: items.filter((item) => !groupedIds.has(item.id)),
  };
}

export function getPortfolioCoverSources(item: PortfolioItem): string[] {
  const localCover = item.site_path
    ? `/portfolio/covers/${item.site_path}.webp`
    : null;

  return [
    ...new Set(
      [item.portfolio_cover_url, localCover].filter(
        (source): source is string => Boolean(source),
      ),
    ),
  ];
}
