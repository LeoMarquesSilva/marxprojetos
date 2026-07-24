import { ExternalLink, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { buttonVariants } from "@/components/ui/button";
import { getPublicPortfolio } from "@/app/actions/portfolio";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Portfólio · INSYT",
  description: "Trabalhos entregues pela INSYT — sites e sistemas sob medida.",
};

export default async function PortfolioPage() {
  const items = await getPublicPortfolio();

  return (
    <div className="min-h-screen bg-[var(--insyt-canvas)]">
      <header className="relative overflow-hidden bg-[var(--insyt-black)] px-6 py-16 text-white sm:px-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(247,66,17,0.28),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(191,54,22,0.18),transparent_35%)]" />
        <div className="relative mx-auto max-w-5xl">
          <BrandLogo href="/portfolio" variant="light" showProduct={false} />
          <p className="mt-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[var(--insyt-primary)]">
            <Sparkles className="size-3.5" />
            Portfólio
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            Sites e sistemas que já colocamos no ar.
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16 sm:px-12">
        {items.length === 0 ? (
          <p className="text-center text-[var(--insyt-slate)]">
            Nenhum trabalho publicado no portfólio ainda.
          </p>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2">
            {items.map((item) => (
              <article
                key={item.id}
                className="insyt-card flex flex-col overflow-hidden p-0"
              >
                <div
                  className="aspect-video w-full bg-cover bg-center"
                  style={
                    item.portfolio_cover_url
                      ? { backgroundImage: `url(${item.portfolio_cover_url})` }
                      : {
                          backgroundImage:
                            "linear-gradient(135deg, var(--insyt-primary), var(--insyt-primary-dark))",
                        }
                  }
                />
                <div className="flex flex-1 flex-col gap-3 p-6">
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-[var(--insyt-black)]">
                      {item.title}
                    </h2>
                    {item.client_company || item.client_name ? (
                      <p className="text-sm text-[var(--insyt-muted)]">
                        {item.client_company || item.client_name}
                      </p>
                    ) : null}
                  </div>
                  {item.portfolio_description ? (
                    <p className="flex-1 text-sm leading-relaxed text-[var(--insyt-slate)]">
                      {item.portfolio_description}
                    </p>
                  ) : null}
                  {item.site_path ? (
                    <a
                      href={`/sites/${item.site_path}/index.html`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "mt-2 w-fit",
                      )}
                    >
                      Ver site
                      <ExternalLink className="size-3.5" />
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-[var(--insyt-border)] px-6 py-8 text-center text-sm text-[var(--insyt-muted)] sm:px-12">
        © INSYT · Sites, landing pages e sistemas sob medida.
      </footer>
    </div>
  );
}
