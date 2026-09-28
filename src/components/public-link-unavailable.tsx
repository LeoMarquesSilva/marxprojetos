import { LinkIcon } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

// Tela que o cliente vê quando o link público (/b/<token> ou /r/<token>)
// não abre mais — briefing arquivado ou marcado como revisado, revisão
// desativada, ou token digitado errado. Sem ela caía no 404 padrão do
// Next, em inglês, sem nenhuma indicação do que fazer.
export function PublicLinkUnavailable({ description }: { description: string }) {
  return (
    <div className="min-h-screen bg-[var(--insyt-canvas)]">
      <header className="border-b border-[var(--insyt-border)] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-3xl items-center px-4">
          <BrandLogo showProduct={false} href={undefined} />
        </div>
      </header>
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-24 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-[#fff4f0] text-[var(--insyt-primary)]">
          <LinkIcon className="size-5" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--insyt-black)]">
          Este link não está disponível
        </h1>
        <p className="max-w-md text-[var(--insyt-slate)]">{description}</p>
      </div>
    </div>
  );
}
