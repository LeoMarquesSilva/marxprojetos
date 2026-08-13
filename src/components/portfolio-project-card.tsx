import { ArrowUpRight, ExternalLink } from "lucide-react";
import { PortfolioProjectCover } from "@/components/portfolio-project-cover";
import type { PortfolioProjectCard } from "@/lib/portfolio-projects";

export function PortfolioProjectCardView({
  project,
  index,
}: {
  project: PortfolioProjectCard;
  index: number;
}): React.JSX.Element {
  // Preview interno é do mesmo domínio; site publicado do cliente é externo
  // e precisa de rel de segurança.
  const externalProps = project.isExternal
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <article className="group grid gap-7 py-10 lg:grid-cols-[90px_1fr] lg:py-16">
      <p className="pt-2 text-sm font-bold text-black/35">
        / {String(index + 1).padStart(2, "0")}
      </p>
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1.45fr)_minmax(250px,0.55fr)] lg:items-end">
        <div className="relative aspect-[16/10] overflow-hidden rounded-[1.75rem] bg-[#dad3c6] shadow-[0_25px_70px_-35px_rgba(17,16,15,0.5)]">
          <PortfolioProjectCover
            key={project.coverSources.join("|")}
            sources={project.coverSources}
            alt={project.imageAlt}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent opacity-60" />
          {project.href ? (
            <a
              href={project.href}
              {...externalProps}
              className="absolute inset-0 rounded-[1.75rem] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--insyt-primary)]"
              aria-label={`Abrir projeto ${project.title}`}
            />
          ) : null}
          <span className="pointer-events-none absolute right-5 top-5 flex size-12 translate-y-2 items-center justify-center rounded-full bg-white text-black opacity-0 transition-[transform,opacity] duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 motion-reduce:transform-none motion-reduce:transition-none">
            <ArrowUpRight className="size-5" />
          </span>
        </div>

        <div className="pb-1">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--insyt-primary)]">
            {project.clientLabel}
          </p>
          <h3 className="mt-3 text-balance text-3xl font-bold leading-[0.95] tracking-[-0.04em] sm:text-4xl">
            {project.title}
          </h3>
          {project.description ? (
            <p className="mt-5 text-pretty text-base leading-relaxed text-black/55">
              {project.description}
            </p>
          ) : null}
          {project.highlights.length > 0 ? (
            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Diferenciais">
              {project.highlights.map((highlight) => (
                <li
                  key={highlight}
                  className="rounded-md bg-black/[0.055] px-3 py-2 text-xs font-semibold text-black/60"
                >
                  {highlight}
                </li>
              ))}
            </ul>
          ) : null}
          {project.href ? (
            <a
              href={project.href}
              {...externalProps}
              className="mt-7 inline-flex items-center gap-2 border-b border-black pb-1 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--insyt-primary)]"
            >
              Visitar projeto
              <ExternalLink className="size-3.5" />
            </a>
          ) : (
            <p className="mt-7 text-xs font-bold uppercase tracking-[0.16em] text-black/35">
              Case reservado
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
