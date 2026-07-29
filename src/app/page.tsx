import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  CheckCircle2,
  Layers3,
  MessageCircle,
  MousePointer2,
  Sparkles,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { WhatsAppFloatButton } from "@/components/whatsapp-float-button";
import { PortfolioCaseStudy } from "@/components/portfolio-case-study";
import { PortfolioProjectCardView } from "@/components/portfolio-project-card";
import { buttonVariants } from "@/components/ui/button";
import {
  getPublicExternalProjects,
  getPublicPortfolio,
  getPublicPortfolioCases,
  getPublicSiteSettings,
} from "@/app/actions/portfolio";
import { insytBrand } from "@/lib/brand";
import { buildWaMeUrl } from "@/lib/phone";
import { absoluteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import {
  buildPortfolioPresentation,
} from "@/lib/portfolio-cases";
import { buildPortfolioProjectCards } from "@/lib/portfolio-projects";
import { cn } from "@/lib/utils";

// Título e descrição puxam para o nicho de propósito: busca premia
// especificidade, e é por "advocacia" que o público-alvo procura.
const SITE_TITLE = "INSYT · Sites e landing pages para escritórios de advocacia";
const SITE_DESCRIPTION =
  "Estúdio digital especializado em marketing jurídico. Sites, landing pages e sistemas sob medida para escritórios de advocacia que querem transformar presença digital em novos clientes.";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: [
    "marketing jurídico",
    "site para advogados",
    "site para escritório de advocacia",
    "landing page advocacia",
    "presença digital jurídica",
    "criação de sites",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: insytBrand.name,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export default async function PortfolioPage() {
  const supabase = await createClient();
  const [items, cases, externalProjects, settings, session] = await Promise.all([
    getPublicPortfolio(),
    getPublicPortfolioCases(),
    getPublicExternalProjects(),
    getPublicSiteSettings(),
    supabase.auth.getUser(),
  ]);

  // Quem já tem sessão vai direto para o painel; o lead vê "Entrar". Evita
  // mandar quem está logado para uma tela de login que só o redirecionaria.
  const isLoggedIn = Boolean(session.data.user);
  const presentation = buildPortfolioPresentation(items, cases);
  const projectCards = buildPortfolioProjectCards(
    presentation.ungroupedItems,
    externalProjects,
  );
  const hasPortfolioContent =
    presentation.cases.length > 0 || projectCards.length > 0;

  // WhatsApp com mensagem pronta converte melhor que formulário no Brasil, e
  // a mensagem já contextualizada ("vi seu portfólio") evita o lead ter que
  // explicar de onde veio.
  const whatsappUrl = settings?.whatsapp_number
    ? buildWaMeUrl(
        settings.whatsapp_number,
        settings.whatsapp_message ?? undefined,
      )
    : null;
  const ctaLabel = settings?.cta_label?.trim() || "Solicitar orçamento";
  const contactUrl =
    whatsappUrl ?? process.env.NEXT_PUBLIC_PORTFOLIO_CONTACT_URL?.trim() ?? null;
  const showAbout = Boolean(
    settings?.about_enabled && (settings?.about_name || settings?.about_bio),
  );

  // Dados estruturados: ajudam o buscador a entender que isto é um
  // prestador de serviço com responsável identificável, e habilitam
  // resultados enriquecidos.
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: insytBrand.name,
    url: absoluteUrl("/"),
    description: SITE_DESCRIPTION,
    areaServed: { "@type": "Country", name: "Brasil" },
    knowsAbout: [
      "Marketing jurídico",
      "Criação de sites",
      "Landing pages",
      "Presença digital para escritórios de advocacia",
    ],
    ...(settings?.about_name
      ? {
          founder: {
            "@type": "Person",
            name: settings.about_name,
            ...(settings.about_role ? { jobTitle: settings.about_role } : {}),
            ...(settings.about_linkedin_url
              ? { sameAs: [settings.about_linkedin_url] }
              : {}),
          },
        }
      : {}),
    ...(settings?.whatsapp_number
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "sales",
            telephone: `+${settings.whatsapp_number}`,
            availableLanguage: "Portuguese",
          },
        }
      : {}),
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#f4f0e8] text-[#11100f] selection:bg-[var(--insyt-primary)] selection:text-white">
      {/* O conteúdo vem do banco e é editável pela tela, então escapamos "<"
          para que nenhum texto consiga fechar a tag e injetar script. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
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

        <nav className="relative mx-auto flex max-w-7xl items-center justify-between gap-4 border-b border-white/10 py-6">
          <BrandLogo href="/" variant="horizontal-light" showProduct={false} />
          <div className="flex items-center gap-5 text-xs font-semibold uppercase tracking-[0.16em] sm:gap-8">
            <div className="hidden items-center gap-8 text-white/55 sm:flex">
              <a className="transition-colors hover:text-white" href="#projetos">
                Projetos
              </a>
              <a className="transition-colors hover:text-white" href="#processo">
                Processo
              </a>
              {showAbout ? (
                <a className="transition-colors hover:text-white" href="#sobre">
                  Sobre
                </a>
              ) : null}
              {contactUrl ? (
                <a
                  className="text-white"
                  href={contactUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {ctaLabel} <ArrowUpRight className="ml-1 inline size-3" />
                </a>
              ) : null}
            </div>
            {/* Porta de serviço: discreta o bastante para não competir com o
                CTA, mas sempre acessível — inclusive no celular. */}
            <Link
              href={isLoggedIn ? "/dashboard" : "/login"}
              className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 text-white/50 transition-colors hover:border-white/35 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--insyt-primary)] sm:min-h-9"
            >
              {isLoggedIn ? "Painel" : "Entrar"}
            </Link>
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

        {showAbout ? (
          <section
            id="sobre"
            className="px-5 py-24 sm:px-10 lg:px-16 lg:py-32"
          >
            <div className="mx-auto max-w-7xl">
              <div className="grid gap-12 border-t border-black/15 pt-14 lg:grid-cols-[0.85fr_1.15fr]">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--insyt-primary)]">
                    Quem faz
                  </p>
                  <div className="mt-7 flex items-center gap-5">
                    {settings?.about_photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={settings.about_photo_url}
                        alt={`Foto de ${settings.about_name ?? "responsável"}`}
                        className="size-20 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-[#e3ddd1] text-2xl font-bold text-[var(--insyt-primary)]">
                        {(settings?.about_name ?? "IN")
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join("")
                          .toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <h2 className="text-3xl font-bold leading-none tracking-[-0.04em] sm:text-4xl">
                        {settings?.about_name}
                      </h2>
                      {settings?.about_role ? (
                        <p className="mt-2 text-sm leading-relaxed text-black/55">
                          {settings.about_role}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="lg:pt-14">
                  {settings?.about_bio ? (
                    <p className="text-pretty text-lg leading-relaxed text-black/60">
                      {settings.about_bio}
                    </p>
                  ) : null}

                  <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                    {settings?.about_linkedin_url ? (
                      <a
                        href={settings.about_linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 border-b border-black pb-1 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--insyt-primary)]"
                      >
                        Ver perfil no LinkedIn
                        <ArrowUpRight className="size-3.5" />
                      </a>
                    ) : null}
                    {whatsappUrl ? (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-black/50 transition-colors hover:text-[var(--insyt-primary)]"
                      >
                        <MessageCircle className="size-4" />
                        Falar direto no WhatsApp
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="bg-[var(--insyt-primary)] px-5 py-20 text-white sm:px-10 lg:px-16 lg:py-28">
          <div className="mx-auto flex max-w-7xl flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <h2 className="text-5xl font-bold leading-[0.9] tracking-[-0.055em] sm:text-7xl">
                Seu próximo projeto pode começar aqui.
              </h2>
              {whatsappUrl ? (
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
                  Me chame no WhatsApp e conte o que seu escritório precisa. Eu
                  respondo pessoalmente.
                </p>
              ) : null}
            </div>
            {contactUrl ? (
              <a
                href={contactUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "w-fit shrink-0 bg-white text-black shadow-none hover:bg-[#11100f] hover:text-white",
                )}
              >
                {whatsappUrl ? <MessageCircle className="size-4" /> : null}
                {ctaLabel}
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

      {/* pb generoso: o botão flutuante fica no canto inferior direito e
          cobriria a assinatura do rodapé. */}
      <footer className="bg-[#11100f] px-5 pb-24 pt-16 text-white sm:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 border-t border-white/10 pt-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
            <div>
              <BrandLogo href="/" variant="horizontal-light" showProduct={false} />
              <p className="mt-6 max-w-xs text-sm leading-relaxed text-white/45">
                Estúdio digital independente. Sites, landing pages e sistemas
                sob medida para escritórios de advocacia que querem ser
                lembrados.
              </p>
            </div>

            <nav aria-label="Navegação do rodapé">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/35">
                Navegar
              </h2>
              <ul className="mt-6 space-y-4 text-sm text-white/60">
                <li>
                  <a className="transition-colors hover:text-white" href="#projetos">
                    Projetos
                  </a>
                </li>
                <li>
                  <a className="transition-colors hover:text-white" href="#processo">
                    Processo
                  </a>
                </li>
                {showAbout ? (
                  <li>
                    <a className="transition-colors hover:text-white" href="#sobre">
                      Sobre
                    </a>
                  </li>
                ) : null}
              </ul>
            </nav>

            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/35">
                Contato
              </h2>
              <ul className="mt-6 space-y-4 text-sm text-white/60">
                {whatsappUrl ? (
                  <li>
                    <a
                      className="inline-flex items-center gap-2 transition-colors hover:text-white"
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="size-4" />
                      WhatsApp
                    </a>
                  </li>
                ) : null}
                {settings?.about_linkedin_url ? (
                  <li>
                    <a
                      className="transition-colors hover:text-white"
                      href={settings.about_linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      LinkedIn
                    </a>
                  </li>
                ) : null}
                <li>
                  <Link
                    className="transition-colors hover:text-white"
                    href={isLoggedIn ? "/dashboard" : "/login"}
                  >
                    {isLoggedIn ? "Painel" : "Entrar"}
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} {insytBrand.name}. Todos os direitos
              reservados.
            </p>
            <p>Feito no Brasil</p>
          </div>
        </div>
      </footer>

      {whatsappUrl ? <WhatsAppFloatButton href={whatsappUrl} /> : null}
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
