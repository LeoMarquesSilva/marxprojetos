"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AnimatePresence, motion } from "motion/react";
import { Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ProposalAccept({
  token,
  clientName,
  initialAcceptedAt,
  initialAcceptedBy,
  whatsappUrl,
}: {
  token: string;
  clientName: string;
  initialAcceptedAt: string | null;
  initialAcceptedBy: string | null;
  whatsappUrl: string | null;
}) {
  const [acceptedAt, setAcceptedAt] = useState(initialAcceptedAt);
  const [acceptedBy, setAcceptedBy] = useState(initialAcceptedBy);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function accept() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Escreva seu nome para confirmar.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("accept_proposal", {
        p_token: token,
        p_name: trimmed,
      });

      if (rpcError || !data) {
        setError("Não consegui registrar agora. Tente de novo em instantes.");
        return;
      }

      setAcceptedAt(data as string);
      setAcceptedBy(trimmed);
    });
  }

  return (
    <section
      id="aceite"
      data-proposal-section="aceite"
      className="scroll-mt-24 bg-[#11100f] px-5 py-20 text-white sm:px-10 lg:px-16 lg:py-28"
    >
      <div className="mx-auto max-w-5xl">
        <AnimatePresence mode="wait" initial={false}>
          {acceptedAt ? (
            <motion.div
              key="aceita"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-start gap-6"
            >
              <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <Check className="size-7" />
              </span>
              <div>
                <h2 className="text-4xl font-bold leading-[1] tracking-[-0.04em] sm:text-5xl">
                  Proposta aceita
                </h2>
                <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/60">
                  {acceptedBy ? `Confirmada por ${acceptedBy}` : "Confirmada"} em{" "}
                  {format(new Date(acceptedAt), "d 'de' MMMM 'de' yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                  . Já recebi o aviso e entro em contato para começarmos.
                </p>
              </div>
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-sm font-bold text-black transition-colors hover:bg-white/85"
                >
                  Falar no WhatsApp
                </a>
              ) : null}
            </motion.div>
          ) : (
            <motion.div
              key="aceitar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end"
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--insyt-primary)]">
                  Próximo passo
                </p>
                <h2 className="mt-6 max-w-xl text-balance text-4xl font-bold leading-[1] tracking-[-0.04em] sm:text-5xl">
                  Vamos começar?
                </h2>
                <p className="mt-5 max-w-lg text-pretty text-lg leading-relaxed text-white/60">
                  Ao confirmar, eu recebo o aviso e já dou início à primeira
                  etapa. Qualquer ponto ainda pode ser ajustado depois — isso
                  não é contrato, é o seu sinal verde.
                </p>
              </div>

              <div className="rounded-[1.75rem] bg-white/[0.06] p-6 sm:p-8">
                <label
                  htmlFor="aceite-nome"
                  className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50"
                >
                  Seu nome
                </label>
                <input
                  id="aceite-nome"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") accept();
                  }}
                  placeholder={`Quem confirma por ${clientName}`}
                  className="mt-3 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3.5 text-base text-white outline-none transition-colors placeholder:text-white/30 focus:border-[var(--insyt-primary)] focus:bg-white/10"
                />

                {error ? (
                  <p role="alert" className="mt-3 text-sm text-[#ffb4a1]">
                    {error}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={accept}
                  disabled={isPending}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--insyt-primary)] px-6 py-4 text-sm font-bold transition-colors hover:bg-[var(--insyt-primary-dark)] disabled:opacity-60"
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Aceitar proposta
                </button>

                {whatsappUrl ? (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 block text-center text-sm text-white/50 transition-colors hover:text-white"
                  >
                    Prefiro conversar antes
                  </a>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
