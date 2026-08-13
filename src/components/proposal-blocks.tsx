import type { ProposalBlock } from "@/types/proposal";

// Cada tipo de bloco tem sua própria composição. É isso que separa uma
// proposta de um documento colado: preço não parece parágrafo, etapa tem
// numeração, pilar vira destaque.

function SectionShell({
  index,
  title,
  children,
}: {
  index: number;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      // O id é o que o rastreamento usa para saber até onde a pessoa leu.
      id={`bloco-${index}`}
      data-proposal-section={`bloco-${index}`}
      className="scroll-mt-24 border-t border-black/10 py-14 first:border-t-0 sm:py-20"
    >
      {title ? (
        <div className="mb-8 flex items-baseline gap-4">
          <span className="text-xs font-bold tabular-nums text-[var(--insyt-primary)]">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h2 className="text-balance text-3xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-4xl">
            {title}
          </h2>
        </div>
      ) : null}
      {children}
    </section>
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
          <div className="max-w-3xl space-y-5">
            {block.paragraphs.map((paragraph, i) => (
              <p
                key={i}
                className="text-pretty text-lg leading-relaxed text-black/65"
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
          {block.intro ? (
            <p className="mb-7 max-w-3xl text-pretty text-lg leading-relaxed text-black/65">
              {block.intro}
            </p>
          ) : null}
          <ul className="grid max-w-4xl gap-x-10 gap-y-3 sm:grid-cols-2">
            {block.items.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 text-[15px] leading-relaxed text-black/70"
              >
                <span
                  aria-hidden="true"
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--insyt-primary)]"
                />
                {item}
              </li>
            ))}
          </ul>
        </SectionShell>
      );

    case "definicoes":
      return (
        <SectionShell index={index} title={block.title}>
          {block.intro ? (
            <p className="mb-9 max-w-3xl text-pretty text-lg leading-relaxed text-black/65">
              {block.intro}
            </p>
          ) : null}
          <dl className="grid gap-px overflow-hidden rounded-2xl bg-black/10 sm:grid-cols-2">
            {block.items.map((item) => (
              <div key={item.term} className="bg-[#f4f0e8] p-6">
                <dt className="text-base font-bold tracking-[-0.01em]">
                  {item.term}
                </dt>
                <dd className="mt-2 text-pretty text-sm leading-relaxed text-black/60">
                  {item.description}
                </dd>
              </div>
            ))}
          </dl>
        </SectionShell>
      );

    case "etapas":
      return (
        <SectionShell index={index} title={block.title}>
          <ol className="max-w-4xl divide-y divide-black/10 border-y border-black/10">
            {block.steps.map((step, i) => (
              <li
                key={step.title}
                className="grid gap-2 py-6 sm:grid-cols-[64px_220px_1fr] sm:items-baseline sm:gap-6"
              >
                <span className="text-sm font-bold tabular-nums text-[var(--insyt-primary)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-lg font-bold tracking-[-0.02em]">
                  {step.title}
                </h3>
                <p className="text-pretty leading-relaxed text-black/60">
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
          <div className="max-w-3xl overflow-hidden rounded-[1.75rem] bg-[#11100f] text-white">
            <div className="border-b border-white/10 p-8 sm:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                {block.label}
              </p>
              <p className="mt-3 text-5xl font-bold tracking-[-0.04em] sm:text-6xl">
                {block.amount}
              </p>
            </div>
            <div className="p-8 sm:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                {block.paymentTitle ?? "Forma de pagamento"}
              </p>
              <div className="mt-5 space-y-3">
                {block.installments.map((installment) => (
                  <div
                    key={installment.label}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 pb-3 last:border-0 last:pb-0"
                  >
                    <span className="text-white/70">{installment.label}</span>
                    <span className="text-lg font-bold tabular-nums">
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
          {block.intro ? (
            <p className="mb-8 max-w-3xl text-pretty text-lg leading-relaxed text-black/65">
              {block.intro}
            </p>
          ) : null}
          <div className="max-w-4xl rounded-[1.75rem] border border-black/10 bg-white/70 p-8 sm:p-10">
            <p className="text-4xl font-bold tracking-[-0.035em] sm:text-5xl">
              {block.price}
              <span className="ml-1 text-base font-semibold text-black/40">
                {block.period}
              </span>
            </p>
            <ul className="mt-8 grid gap-x-10 gap-y-3 sm:grid-cols-2">
              {block.items.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-[15px] leading-relaxed text-black/70"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--insyt-primary)]"
                  />
                  {item}
                </li>
              ))}
            </ul>
            {block.note ? (
              <p className="mt-8 border-t border-black/10 pt-6 text-sm leading-relaxed text-black/50">
                {block.note}
              </p>
            ) : null}
          </div>
        </SectionShell>
      );

    case "pilares":
      return (
        <SectionShell index={index} title={block.title}>
          {block.intro ? (
            <p className="max-w-3xl text-pretty text-lg leading-relaxed text-black/65">
              {block.intro}
            </p>
          ) : null}
          <div className="mt-10 flex flex-wrap gap-3">
            {block.pillars.map((pillar) => (
              <span
                key={pillar}
                className="rounded-full border border-black/15 px-5 py-2.5 text-sm font-semibold tracking-[-0.01em]"
              >
                {pillar}
              </span>
            ))}
          </div>
          {block.closing ? (
            <p className="mt-10 max-w-3xl text-pretty text-lg leading-relaxed text-black/65">
              {block.closing}
            </p>
          ) : null}
        </SectionShell>
      );
  }
}
