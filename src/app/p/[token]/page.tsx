import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BrandLogo } from "@/components/brand-logo";
import { ProposalBlockView } from "@/components/proposal-blocks";
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
    title: proposal
      ? `${proposal.title} · ${proposal.client_name}`
      : "Proposta",
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
      <ProposalTracker token={token} />

      <header className="bg-[#11100f] px-5 pb-20 pt-6 text-white sm:px-10 lg:px-16 lg:pb-28">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-6">
            <BrandLogo href="/" variant="horizontal-light" showProduct={false} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              Proposta comercial
            </span>
          </div>

          <div className="pt-16 lg:pt-24">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--insyt-primary)]">
              {proposal.client_name}
            </p>
            <h1 className="mt-6 max-w-3xl text-balance text-4xl font-bold leading-[1.02] tracking-[-0.045em] sm:text-6xl">
              {proposal.title}
            </h1>
            {proposal.subtitle ? (
              <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-white/60">
                {proposal.subtitle}
              </p>
            ) : null}

            <div className="mt-12 flex flex-wrap gap-x-10 gap-y-3 border-t border-white/10 pt-6 text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
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
              <span className="ml-auto">{insytBrand.name} Studio</span>
            </div>
          </div>
        </div>
      </header>

      <main className="px-5 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-5xl">
          {proposal.content.map((block, index) => (
            <ProposalBlockView key={block.id} block={block} index={index} />
          ))}
        </div>
      </main>

      <section className="bg-[var(--insyt-primary)] px-5 py-20 text-white sm:px-10 lg:px-16 lg:py-24">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-4xl font-bold leading-[0.95] tracking-[-0.045em] sm:text-5xl">
              Vamos conversar?
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-white/75">
              Qualquer ponto desta proposta pode ser ajustado. É só me chamar.
            </p>
          </div>
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-white px-7 py-4 text-sm font-bold text-black transition-colors hover:bg-[#11100f] hover:text-white"
            >
              Falar no WhatsApp
            </a>
          ) : null}
        </div>
      </section>

      <footer className="bg-[#11100f] px-5 py-8 text-white sm:px-10 lg:px-16">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 border-t border-white/10 pt-8 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
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
