import { notFound } from "next/navigation";
import { PublicBriefingForm } from "@/components/public-briefing-form";
import { BrandLogo } from "@/components/brand-logo";
import { fetchBriefingByToken } from "@/app/actions/briefing";

export default async function PublicBriefingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const briefing = await fetchBriefingByToken(token);

  if (!briefing) notFound();

  return (
    <div className="min-h-screen bg-[var(--insyt-canvas)]">
      <header className="border-b border-[var(--insyt-border)] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-3xl items-center justify-between px-4">
          <BrandLogo showProduct={false} href={undefined} />
          <span className="rounded-full bg-[#fff4f0] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--insyt-primary-dark)]">
            Formulário seguro
          </span>
        </div>
      </header>

      <div className="insyt-grid-bg border-b border-[var(--insyt-border)]">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--insyt-primary)]">
            Briefing do projeto
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-[var(--insyt-black)]">
            {briefing.title}
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10">
        <PublicBriefingForm token={token} briefing={briefing} />
      </div>
    </div>
  );
}
