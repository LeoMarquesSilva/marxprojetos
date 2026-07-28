import type {
  PortfolioCaseRecord,
  PortfolioItem,
} from "@/app/actions/portfolio";

export type PortfolioChapterConfig = {
  eyebrow: string;
  objective: string;
  solution: string;
  deliverables: string[];
  imageAlt: string;
};

export type PortfolioCaseChapter = {
  project: PortfolioItem;
  config: PortfolioChapterConfig;
};

export type PortfolioCase = {
  id: string;
  client: string;
  summary: string;
  services: string[];
  chapters: PortfolioCaseChapter[];
};

export type PortfolioPresentation = {
  cases: PortfolioCase[];
  ungroupedItems: PortfolioItem[];
};

function toChapter(project: PortfolioItem): PortfolioCaseChapter {
  return {
    project,
    config: {
      eyebrow: project.portfolio_eyebrow ?? "",
      objective: project.portfolio_objective ?? "",
      solution: project.portfolio_solution ?? "",
      deliverables: project.portfolio_deliverables ?? [],
      imageAlt: project.portfolio_image_alt ?? `Hero do projeto ${project.title}`,
    },
  };
}

// Agrupa os projetos publicados nos cases definidos no banco. Um projeto sem
// case (ou apontando para um case inexistente) cai em `ungroupedItems` e é
// exibido como card simples.
export function buildPortfolioPresentation(
  items: PortfolioItem[],
  cases: PortfolioCaseRecord[],
): PortfolioPresentation {
  const chaptersByCase = new Map<string, PortfolioCaseChapter[]>();
  const knownCaseIds = new Set(cases.map((entry) => entry.id));
  const ungroupedItems: PortfolioItem[] = [];

  for (const item of items) {
    const caseId = item.portfolio_case_id;

    if (caseId && knownCaseIds.has(caseId)) {
      const chapters = chaptersByCase.get(caseId) ?? [];
      chapters.push(toChapter(item));
      chaptersByCase.set(caseId, chapters);
      continue;
    }

    ungroupedItems.push(item);
  }

  const builtCases = cases.flatMap((entry) => {
    const chapters = chaptersByCase.get(entry.id) ?? [];
    if (chapters.length === 0) return [];

    return [
      {
        id: entry.id,
        client: entry.client,
        summary: entry.summary ?? "",
        services: entry.services ?? [],
        chapters,
      },
    ];
  });

  return { cases: builtCases, ungroupedItems };
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
