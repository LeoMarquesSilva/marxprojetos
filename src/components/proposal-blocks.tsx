import { Check } from "lucide-react";
import { ProposalReveal } from "@/components/proposal-reveal";
import type { ProposalBlock } from "@/types/proposal";

// Cada tipo de bloco tem composição própria. É isso que separa uma proposta
// de um documento colado: preço não parece parágrafo, etapa tem numeração,
// pilar vira destaque.
//
// A animação de entrada é UMA por seção, nunca por parágrafo ou item. Com
// um observador por item, qualquer rolagem fora do comum (âncora, posição
// restaurada, rolagem muito rápida) deixava parte do texto parada em
// opacidade zero — e proposta com texto invisível é o pior defeito possível
// aqui. Uma seção é grande o bastante para o gatilho ser confiável.

function SectionShell({
  index,
  title,
  children,
  tone = "claro",
}: {
  index: number;
  title?: string;
  children: React.ReactNode;
  tone?: "claro" | "escuro";
}) {
  const dark = tone === "escuro";

  return (
    <section
      // O id é o que o rastreamento usa para saber até onde a pessoa leu.
      id={`bloco-${index}`}
      data-proposal-section={`bloco-${index}`}
      className={
        dark
          ? "scroll-mt-24 bg-[#11100f] px-5 py-20 text-white sm:px-10 lg:px-16 lg:py-28"
          : "scroll-mt-24 px-5 py-16 sm:px-10 lg:px-16 lg:py-24"
      }
    >
      <ProposalReveal className="mx-auto max-w-5xl">
        {title ? (
          <div className="mb-10 lg:mb-14">
            <span className="text-xs font-bold tabular-nums tracking-[0.2em] text-[var(--insyt-primary)]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h2 className="mt-4 text-balance text-4xl font-bold leading-[1.02] tracking-[-0.04em] sm:text-5xl">
              {title}
            </h2>
            <span
              className={
                dark
                  ? "mt-6 block h-px w-16 bg-white/20"
                  : "mt-6 block h-px w-16 bg-black/15"
              }
            />
          </div>
        ) : null}
        {children}
      </ProposalReveal>
    </section>
  );
}

function Intro({ children, dark }: { children: string; dark?: boolean }) {
  return (
    <p
      className={
        dark
          ? "mb-10 max-w-3xl text-pretty text-lg leading-[1.75] text-white/60"
          : "mb-10 max-w-3xl text-pretty text-lg leading-[1.75] text-black/65"
      }
    >
      {children}
    </p>
  );
}

function CheckItem({ children }: { children: string }) {
  return (
    <li className="flex items-start gap-3 border-b border-black/[0.07] py-3.5 text-[15px] leading-relaxed text-black/75">
      <Check className="mt-0.5 size-4 shrink-0 text-[var(--insyt-primary)]" />
      {children}
    </li>
  );
}

export function ProposalBlockView({
  block,
  index,
}: {
  block: ProposalBlock;
  index: number;
}) {
  switch (block.type) {
    case "texto":
      return (
        <SectionShell index={index} title={block.title}>
          <div className="max-w-3xl space-y-6">
            {block.paragraphs.map((paragraph, i) => (
              <p
                key={i}
                className="text-pretty text-lg leading-[1.75] text-black/65 sm:text-xl sm:leading-[1.7]"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </SectionShell>
      );

    case "lista":
      return (
        <SectionShell index={index} title={block.title}>
          {block.intro ? <Intro>{block.intro}</Intro> : null}
          <ul className="grid gap-x-10 gap-y-px sm:grid-cols-2">
            {block.items.map((item) => (
              <CheckItem key={item}>{item}</CheckItem>
            ))}
          </ul>
        </SectionShell>
      );

    case "definicoes":
      return (
        <SectionShell index={index} title={block.title}>
          {block.intro ? <Intro>{block.intro}</Intro> : null}
          <dl className="grid gap-4 sm:grid-cols-2">
            {block.items.map((item) => (
              <div
                key={item.term}
                className="h-full rounded-2xl border border-black/[0.09] bg-white/60 p-6 transition-colors hover:border-[var(--insyt-primary)]/40 sm:p-7"
              >
                <dt className="text-lg font-bold tracking-[-0.02em]">
                  {item.term}
                </dt>
                <dd className="mt-2.5 text-pretty text-[15px] leading-relaxed text-black/60">
                  {item.description}
                </dd>
              </div>
            ))}
          </dl>
        </SectionShell>
      );

    case "etapas":
      return (
        <SectionShell index={index} title={block.title} tone="escuro">
          <ol>
            {block.steps.map((step, i) => (
              <li
                key={step.title}
                className="grid gap-2 border-b border-white/10 py-7 sm:grid-cols-[72px_1fr] sm:gap-8 lg:grid-cols-[72px_260px_1fr]"
              >
                <span className="text-2xl font-bold tabular-nums text-[var(--insyt-primary)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-xl font-bold tracking-[-0.02em]">
                  {step.title}
                </h3>
                <p className="text-pretty leading-relaxed text-white/55">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </SectionShell>
      );

    case "investimento":
      return (
        <SectionShell index={index} title={block.title}>
          <div className="overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-[0_30px_80px_-50px_rgba(17,16,15,0.5)]">
            <div className="border-b border-black/[0.07] p-8 sm:p-12">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40">
                {block.label}
              </p>
              <p className="mt-4 text-[clamp(2.75rem,8vw,4.5rem)] font-bold leading-none tracking-[-0.05em]">
                {block.amount}
              </p>
            </div>
            <div className="bg-[#faf8f4] p-8 sm:p-12">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40">
                {block.paymentTitle ?? "Forma de pagamento"}
              </p>
              <div className="mt-6 space-y-4">
                {block.installments.map((installment) => (
                  <div
                    key={installment.label}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b border-black/[0.07] pb-4 last:border-0 last:pb-0"
                  >
                    <span className="text-black/60">{installment.label}</span>
                    <span className="text-xl font-bold tabular-nums tracking-[-0.02em]">
                      {installment.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionShell>
      );

    case "plano":
      return (
        <SectionShell index={index} title={block.title}>
          {block.intro ? <Intro>{block.intro}</Intro> : null}
          <div className="rounded-[2rem] border border-black/10 bg-white/70 p-8 sm:p-12">
            <p className="flex items-baseline gap-1.5">
              <span className="text-[clamp(2.5rem,7vw,3.75rem)] font-bold leading-none tracking-[-0.045em]">
                {block.price}
              </span>
              <span className="text-lg font-semibold text-black/40">
                {block.period}
              </span>
            </p>
            <ul className="mt-10 grid gap-x-10 gap-y-px sm:grid-cols-2">
              {block.items.map((item) => (
                <CheckItem key={item}>{item}</CheckItem>
              ))}
            </ul>
            {block.note ? (
              <p className="mt-8 text-sm leading-relaxed text-black/45">
                {block.note}
              </p>
            ) : null}
          </div>
        </SectionShell>
      );

    case "pilares":
      return (
        <SectionShell index={index} title={block.title}>
          {block.intro ? <Intro>{block.intro}</Intro> : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {block.pillars.map((pillar) => (
              <div
                key={pillar}
                className="flex h-full items-center rounded-2xl border border-black/10 bg-white/50 px-6 py-7 text-xl font-bold tracking-[-0.025em]"
              >
                {pillar}
              </div>
            ))}
          </div>
          {block.closing ? (
            <p className="mt-12 max-w-3xl text-pretty text-lg leading-[1.75] text-black/65">
              {block.closing}
            </p>
          ) : null}
        </SectionShell>
      );
  }
}
