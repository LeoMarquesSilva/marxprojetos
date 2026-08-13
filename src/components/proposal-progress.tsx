"use client";

import { motion, useScroll, useSpring } from "motion/react";

/**
 * Barra fina de progresso no topo. Além do acabamento, dá ao cliente a
 * noção de quanto falta — proposta longa sem essa pista parece
 * interminável e é onde a leitura costuma ser abandonada.
 */
export function ProposalProgress() {
  const { scrollYProgress } = useScroll();
  const width = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      // aria-hidden: é enfeite de rolagem, não informação para leitor de tela.
      aria-hidden="true"
      style={{ scaleX: width }}
      className="fixed inset-x-0 top-0 z-50 h-[3px] origin-left bg-[var(--insyt-primary)]"
    />
  );
}
