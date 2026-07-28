import type { Metadata } from "next";
import {
  ArrowDown,
  ArrowUpRight,
  CheckCircle2,
  Layers3,
  MousePointer2,
  Sparkles,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { PortfolioCaseStudy } from "@/components/portfolio-case-study";
import { PortfolioProjectCardView } from "@/components/portfolio-project-card";
import { buttonVariants } from "@/components/ui/button";
import { getPublicPortfolio } from "@/app/actions/portfolio";
import {
  buildPortfolioPresentation,
} from "@/lib/portfolio-cases";
import { buildPortfolioProjectCards } from "@/lib/portfolio-projects";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Portfólio · INSYT",
  description:
    "Sites, landing pages e sistemas criados pela INSYT para transformar presença digital em oportunidade de negócio.",
  openGraph: {
    title: "Portfólio · INSYT",
    description:
      "Uma seleção de experiências digitais criadas para negócios que querem avançar.",
    type: "website",
  },
};

export default async function PortfolioPage() {
  const items = await getPublicPortfolio();
  const presentation = buildPortfolioPresentation(items);
  const projectCards = buildPortfolioProjectCards(
    presentation.ungroupedItems,
  );
  const hasPortfolioContent =
    presentation.cases.length > 0 || projectCards.length > 0;
  const contactUrl =
    process.env.NEXT_PUBLIC_PORTFOLIO_CONTACT_URL?.trim() || null;

  return (
    <div className="min-h-screen overflow-hidden bg-[#f4f0e8] text-[#11100f] selection:bg-[var(--insyt-primary)] selection:text-white">
      <header className="relative min-h-[92svh] overflow-hidden bg-[#11100f] px-5 text-white sm:px-10 lg:px-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.055]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        <div className="pointer-events-none absolute -right-32 -top-52 size-[38rem] rounded-full bg-[var(--insyt-primary)] opacity-20 blur-[120px]" />

        <nav className="relative mx-auto flex max-w-7xl items-center justify-between border-b border-white/10 py-6">
          <BrandLogo href="/portfolio" variant="light" showProduct={false} />
          <div className="hidden items-center gap-8 text-xs font-semibold uppercase tracking-[0.16em] text-white/55 sm:flex">
            <a className="transition-colors hover:text-white" href="#projetos">
              Projetos
            </a>
            <a className="transition-colors hover:text-white" href="#processo">
              Processo
            </a>
            {contactUrl ? (
              <a
                className="text-white"
                href={contactUrl}
                target="_blank"
                rel="noreferrer"
              >
                Conversar <ArrowUpRight className="ml-1 inline size-3" />
              </a>
            ) : null}
          </div>
        </nav>

        <div className="relative mx-auto flex min-h-[calc(92svh-89px)] max-w-7xl flex-col justify-between py-12 sm:py-16">
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--insyt-primary)]">
            <span className="h-px w-8 bg-current" />
            Estúdio digital independente
          </div>

          <div className="grid items-end gap-10 lg:grid-cols-[1fr_280px]">
            <h1 className="max-w-5xl text-[clamp(3.4rem,9vw,8.5rem)] font-bold leading-[0.82] tracking-[-0.065em]">
              Ideias que
              <br />
              viram <span className="text-[var(--insyt-primary)]">presença.</span>
            </h1>
            <div className="border-l border-white/15 pl-6">
              <p className="text-base leading-relaxed text-white/60">
                Criamos sites, landing pages e sistemas com estratégia, clareza
                e acabamento para negócios que querem ser lembrados.
              </p>
              <a
                href="#projetos"
                className="mt-8 inline-flex items-center gap-3 text-sm font-semibold text-white"
              >
                Conheça o trabalho
                <span className="flex size-9 items-center justify-center rounded-full border border-white/20">
                  <ArrowDown className="size-4" />
                </span>
              </a>
            </div>
          </div>

          <div className="mt-14 flex items-center justify-between border-t border-white/10 pt-5 text-[11px] font-medium uppercase tracking-[0.18em] text-white/35">
            <span>INSYT® — Brasil</span>
            <span>{new Date().getFullYear()}</span>
          </div>
        </div>
      </header>

      <main>
        <section
          id="projetos"
          className="px-5 py-24 sm:px-10 lg:px-16 lg:py-36"
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 border-b border-black/15 pb-10 lg:grid-cols-[1fr_1fr] lg:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--insyt-primary)]">
                  Trabalho selecionado
                </p>
                <h2 className="mt-4 text-5xl font-bold leading-none tracking-[-0.045em] sm:text-7xl">
                  Projetos com
                  <br />
                  intenção.
                </h2>
              </div>
              <p className="max-w-xl text-lg leading-relaxed text-black/55 lg:justify-self-end">
                Cada entrega parte de um problema real e termina em uma
                experiência direta, bonita e pronta para trabalhar pelo negócio.
              </p>
            </div>

            {!hasPortfolioContent ? (
              <div className="flex min-h-96 flex-col items-center justify-center border-b border-black/15 text-center">
                <Sparkles className="size-7 text-[var(--insyt-primary)]" />
                <h3 className="mt-5 text-2xl font-bold">
                  Novos trabalhos chegando.
                </h3>
                <p className="mt-2 text-black/50">
                  Estamos preparando a seleção de projetos para este espaço.
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-black/15">
                  {presentation.cases.map((portfolioCase, index) => (
                    <PortfolioCaseStudy
                      key={portfolioCase.id}
                      portfolioCase={portfolioCase}
                      priority={index === 0}
                    />
                  ))}
                </div>

                <div className="mt-16 divide-y divide-black/15 border-t border-black/15">
                  {projectCards.map((project, index) => (
                    <PortfolioProjectCardView
                      key={project.id}
                      project={project}
                      index={index}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        <section
          id="processo"
          className="bg-[#11100f] px-5 py-24 text-white sm:px-10 lg:px-16 lg:py-32"
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--insyt-primary)]">
                  Como trabalhamos
                </p>
                <h2 className="mt-5 text-5xl font-bold leading-[0.95] tracking-[-0.045em] sm:text-6xl">
                  Do primeiro insight
                  <br />
                  ao site no ar.
                </h2>
              </div>
              <div className="divide-y divide-white/10 border-t border-white/10">
                <ProcessStep
                  number="01"
                  icon={MousePointer2}
                  title="Entender"
                  text="Briefing guiado para organizar objetivos, público e o que realmente precisa ser comunicado."
                />
                <ProcessStep
                  number="02"
                  icon={Layers3}
                  title="Construir"
                  text="Estratégia, conteúdo, visual e tecnologia desenvolvidos como uma experiência única."
                />
                <ProcessStep
                  number="03"
                  icon={CheckCircle2}
                  title="Refinar"
                  text="Revisão colaborativa, acabamento responsivo e publicação com cada detalhe no lugar."
                />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[var(--insyt-primary)] px-5 py-20 text-white sm:px-10 lg:px-16 lg:py-28">
          <div className="mx-auto flex max-w-7xl flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="max-w-4xl text-5xl font-bold leading-[0.9] tracking-[-0.055em] sm:text-7xl">
              Seu próximo projeto pode começar aqui.
            </h2>
            {contactUrl ? (
              <a
                href={contactUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "w-fit bg-white text-black shadow-none hover:bg-[#11100f] hover:text-white",
                )}
              >
                Falar com a INSYT
                <ArrowUpRight className="size-4" />
              </a>
            ) : (
              <a
                href="#projetos"
                className="inline-flex w-fit items-center gap-2 border-b border-white pb-1 text-sm font-bold"
              >
                Rever projetos
                <ArrowUpRight className="size-4" />
              </a>
            )}
          </div>
        </section>
      </main>

      <footer className="bg-[#11100f] px-5 py-8 text-white sm:px-10 lg:px-16">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 border-t border-white/10 pt-8 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo href="/portfolio" variant="light" showProduct={false} />
          <p>Sites, landing pages e sistemas sob medida.</p>
          <p>© {new Date().getFullYear()} INSYT</p>
        </div>
      </footer>
    </div>
  );
}

function ProcessStep({
  number,
  icon: Icon,
  title,
  text,
}: {
  number: string;
  icon: typeof MousePointer2;
  title: string;
  text: string;
}) {
  return (
    <div className="grid gap-5 py-8 sm:grid-cols-[45px_48px_150px_1fr] sm:items-start">
      <span className="text-xs font-bold text-white/30">{number}</span>
      <span className="flex size-10 items-center justify-center rounded-full border border-white/15 text-[var(--insyt-primary)]">
        <Icon className="size-4" />
      </span>
      <h3 className="text-xl font-bold">{title}</h3>
      <p className="max-w-md text-sm leading-relaxed text-white/45">{text}</p>
    </div>
  );
}
