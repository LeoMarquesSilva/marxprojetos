"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * Entrada suave conforme a seção aparece na tela.
 *
 * Dois cuidados que existem porque proposta em branco é o pior defeito
 * possível aqui:
 *
 * 1. A animação só liga DEPOIS de montar. Se já renderizasse com opacidade
 *    zero, o HTML do servidor sairia invisível — e um cliente com JS
 *    bloqueado ou conexão ruim veria uma proposta vazia.
 *
 * 2. O observador tem rede de segurança. `whileInView` com `once` só revela
 *    quem cruza a tela; num salto de rolagem (âncora "Ler a proposta",
 *    posição restaurada pelo navegador, arrastar a barra até o fim) as
 *    seções puladas nunca chegam a intersectar e ficariam invisíveis para
 *    sempre. Por isso, além do observador, um listener de rolagem revela
 *    na hora qualquer bloco que já tenha ficado para trás.
 *
 * Também respeita "reduzir movimento" do sistema.
 */
export function ProposalReveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element || !mounted || reduceMotion) return;

    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      setRevealed(true);
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) reveal();
        }
      },
      // Margem generosa: o bloco entra animado um pouco antes de aparecer.
      { rootMargin: "200px 0px 200px 0px" },
    );

    // Já ficou acima da tela? Então a pessoa passou por aqui num salto —
    // mostrar direto, sem animação de entrada que ninguém veria.
    const onScroll = () => {
      if (element.getBoundingClientRect().bottom < 0) reveal();
    };

    observer.observe(element);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [mounted, reduceMotion]);

  if (!mounted || reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={revealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
