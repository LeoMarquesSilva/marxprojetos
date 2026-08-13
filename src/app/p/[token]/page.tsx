import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDown, Check } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ProposalAccept } from "@/components/proposal-accept";
import { ProposalBlockView } from "@/components/proposal-blocks";
import { ProposalProgress } from "@/components/proposal-progress";
import { ProposalReveal } from "@/components/proposal-reveal";
import { ProposalTracker } from "@/components/proposal-tracker";
import { getProposalByToken } from "@/app/actions/proposals";
import { getPublicSiteSettings } from "@/app/actions/portfolio";
import { buildWaMeUrl } from "@/lib/phone";
import { insytBrand } from "@/lib/brand";

// O título vem da proposta: sem isso a aba do cliente mostrava "Briefing
// Studio · INSYT", herdado do layout — nome de ferramenta interna na tela
// de quem está recebendo uma proposta comercial.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const proposal = await getProposalByToken(token);

  return {
    title: proposal ? `${proposal.title} · ${proposal.client_name}` : "Proposta",
    // Documento comercial privado: fica fora de buscador mesmo com o link
    // em mãos.
    robots: { index: false, follow: false },
  };
}

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [proposal, settings] = await Promise.all([
    getProposalByToken(token),
    getPublicSiteSettings(),
  ]);

  if (!proposal) notFound();

  const whatsappUrl = settings?.whatsapp_number
    ? buildWaMeUrl(
        settings.whatsapp_number,
        `Olá! Sobre a proposta "${proposal.title}"...`,
      )
    : null;

  return (
    <div className="min-h-screen bg-[#f4f0e8] text-[#11100f] selection:bg-[var(--insyt-primary)] selection:text-white">
      <ProposalProgress />
      <ProposalTracker token={token} />

      <header className="relative flex min-h-svh flex-col overflow-hidden bg-[#11100f] px-5 text-white sm:px-10 lg:px-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        <div className="pointer-events-none absolute -right-40 -top-56 size-[40rem] rounded-full bg-[var(--insyt-primary)] opacity-20 blur-[130px]" />

        <div className="relative mx-auto flex w-full max-w-5xl items-center justify-between gap-4 border-b border-white/10 py-6">
          <BrandLogo href="/" variant="horizontal-light" showProduct={false} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
            Proposta comercial
          </span>
        </div>

        <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col justify-between gap-12 py-14 sm:py-20">
          <ProposalReveal>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--insyt-primary)]">
              {proposal.client_name}
            </p>
          </ProposalReveal>

          <div>
            <ProposalReveal delay={0.08}>
              <h1 className="max-w-4xl text-balance text-[clamp(2.5rem,7vw,5rem)] font-bold leading-[1] tracking-[-0.05em]">
                {proposal.title}
              </h1>
            </ProposalReveal>
            {proposal.subtitle ? (
              <ProposalReveal delay={0.16}>
                <p className="mt-8 max-w-2xl text-pretty text-lg leading-relaxed text-white/55 sm:text-xl">
                  {proposal.subtitle}
                </p>
              </ProposalReveal>
            ) : null}

            {proposal.accepted_at ? (
              <ProposalReveal delay={0.24}>
                <span className="mt-10 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-400">
                  <Check className="size-4" />
                  Proposta aceita
                </span>
              </ProposalReveal>
            ) : (
              <ProposalReveal delay={0.24}>
                <a
                  href="#bloco-0"
                  className="mt-10 inline-flex items-center gap-3 text-sm font-semibold text-white"
                >
                  Ler a proposta
                  <span className="flex size-9 items-center justify-center rounded-full border border-white/20">
                    <ArrowDown className="size-4" />
                  </span>
                </a>
              </ProposalReveal>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-white/10 pt-6 text-[11px] font-medium uppercase tracking-[0.16em] text-white/35">
            <span>
              {format(new Date(proposal.created_at), "d 'de' MMMM 'de' yyyy", {
                locale: ptBR,
              })}
            </span>
            {proposal.valid_until ? (
              <span>
                Válida até{" "}
                {format(new Date(`${proposal.valid_until}T12:00:00`), "d MMM yyyy", {
                  locale: ptBR,
                })}
              </span>
            ) : null}
            <span className="sm:ml-auto">{insytBrand.name} Studio</span>
          </div>
        </div>
      </header>

      <main>
        {proposal.content.map((block, index) => (
          <ProposalBlockView key={block.id} block={block} index={index} />
        ))}
      </main>

      <ProposalAccept
        token={token}
        clientName={proposal.client_name}
        initialAcceptedAt={proposal.accepted_at}
        initialAcceptedBy={proposal.accepted_by_name}
        whatsappUrl={whatsappUrl}
      />

      <footer className="bg-[#0b0a0a] px-5 py-10 text-white sm:px-10 lg:px-16">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo href="/" variant="horizontal-light" showProduct={false} />
          <p>Proposta preparada para {proposal.client_name}</p>
          <p>
            © {new Date().getFullYear()} {insytBrand.name}
          </p>
        </div>
      </footer>
    </div>
  );
}
