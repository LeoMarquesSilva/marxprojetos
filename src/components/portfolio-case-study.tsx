import { ExternalLink } from "lucide-react";
import { PortfolioProjectCover } from "@/components/portfolio-project-cover";
import {
  getPortfolioCoverSources,
  type PortfolioCase,
  type PortfolioCaseChapter,
} from "@/lib/portfolio-cases";
import { cn } from "@/lib/utils";

export function PortfolioCaseStudy({
  portfolioCase,
  priority = false,
}: {
  portfolioCase: PortfolioCase;
  priority?: boolean;
}) {
  return (
    <article
      aria-labelledby={`case-${portfolioCase.id}`}
      className="py-14 lg:py-24"
    >
      {/* Cartão contido, com selo sólido: sinaliza "um item dentro da seção".
          O cabeçalho da seção, acima, é texto solto sobre o fundo — são tipos
          diferentes de bloco, e não mais duas variações do mesmo. */}
      <div className="rounded-[2rem] border border-black/10 bg-white/70 p-7 sm:p-10">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-[var(--insyt-primary)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
            Case
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/40">
            {portfolioCase.chapters.length}{" "}
            {portfolioCase.chapters.length === 1 ? "projeto" : "projetos"}
          </span>
        </div>

        <div className="mt-7 grid gap-7 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <h3
            id={`case-${portfolioCase.id}`}
            className="text-balance text-3xl font-bold leading-[0.98] tracking-[-0.04em] sm:text-5xl"
          >
            {portfolioCase.client}
          </h3>
          <div>
            <p className="text-pretty leading-relaxed text-black/60">
              {portfolioCase.summary}
            </p>
            {portfolioCase.services.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
                {portfolioCase.services.map((service) => (
                  <span key={service}>{service}</span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="divide-y divide-black/15">
        {portfolioCase.chapters.map((chapter, index) => (
          <CaseChapter
            key={chapter.project.id}
            chapter={chapter}
            index={index}
            priority={priority && index === 0}
          />
        ))}
      </div>
    </article>
  );
}

function CaseChapter({
  chapter,
  index,
  priority,
}: {
  chapter: PortfolioCaseChapter;
  index: number;
  priority: boolean;
}) {
  const href = chapter.project.site_path
    ? `/sites/${chapter.project.site_path}/index.html`
    : null;
  const sources = getPortfolioCoverSources(chapter.project);

  return (
    <section
      aria-labelledby={`project-${chapter.project.id}`}
      className="grid gap-10 py-14 lg:grid-cols-12 lg:items-center lg:gap-12 lg:py-24"
    >
      <div
        className={cn(
          "group relative overflow-hidden rounded-[1.75rem] bg-[#dad3c6] shadow-[0_30px_90px_-45px_rgba(17,16,15,0.6)] lg:col-span-8",
          index % 2 === 1 && "lg:col-start-5",
        )}
      >
        <div
          aria-hidden="true"
          className="flex h-9 items-center gap-1.5 border-b border-black/10 bg-[#e9e4da] px-4"
        >
          <span className="size-2 rounded-full bg-black/15" />
          <span className="size-2 rounded-full bg-black/15" />
          <span className="size-2 rounded-full bg-black/15" />
        </div>
        <div className="aspect-[16/10] overflow-hidden">
          <PortfolioProjectCover
            key={sources.join("|")}
            sources={sources}
            alt={chapter.config.imageAlt}
            priority={priority}
          />
        </div>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir ${chapter.project.title}`}
            className="absolute inset-0 rounded-[1.75rem] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--insyt-primary)]"
          >
            <span className="absolute right-5 top-14 flex size-12 translate-y-2 items-center justify-center rounded-full bg-white text-black opacity-0 transition-[transform,opacity] duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 motion-reduce:transform-none motion-reduce:transition-none">
              <ExternalLink className="size-4" />
            </span>
          </a>
        ) : null}
      </div>

      <div
        className={cn(
          "lg:col-span-4 lg:row-start-1",
          index % 2 === 1 ? "lg:col-start-1" : "lg:col-start-9",
        )}
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--insyt-primary)]">
          {chapter.config.eyebrow}
        </p>
        <h4
          id={`project-${chapter.project.id}`}
          className="mt-4 text-balance text-3xl font-bold leading-[0.95] tracking-[-0.04em] sm:text-4xl"
        >
          {chapter.project.title}
        </h4>

        <dl className="mt-8 space-y-7">
          <div>
            <dt className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">
              Objetivo
            </dt>
            <dd className="mt-2 text-pretty leading-relaxed text-black/60">
              {chapter.config.objective}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">
              Solução
            </dt>
            <dd className="mt-2 text-pretty leading-relaxed text-black/60">
              {chapter.config.solution}
            </dd>
          </div>
        </dl>

        <ul className="mt-8 flex flex-wrap gap-2" aria-label="Entregas">
          {chapter.config.deliverables.map((deliverable) => (
            <li
              key={deliverable}
              className="rounded-md bg-black/[0.055] px-3 py-2 text-xs font-semibold text-black/60"
            >
              {deliverable}
            </li>
          ))}
        </ul>

        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 border-b border-black pb-1 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--insyt-primary)]"
          >
            Visitar projeto
            <ExternalLink className="size-3.5" />
          </a>
        ) : (
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-black/35">
            Case reservado
          </p>
        )}
      </div>
    </section>
  );
}
