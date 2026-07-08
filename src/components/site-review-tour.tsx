"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  ChevronsUp,
  MessageSquare,
  MessageSquarePlus,
  MousePointerClick,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TourTarget = "add-comment" | "collapse" | "comments" | "approve" | null;

const STEPS: {
  icon: typeof MessageSquarePlus;
  title: string;
  description: string;
  target: TourTarget;
}[] = [
  {
    icon: MessageSquarePlus,
    title: "Bem-vindo(a) à revisão do site!",
    description:
      "Aqui você vê o site já construído e pode nos dizer exatamente o que quer ajustar. Vamos te mostrar como funciona em poucos passos.",
    target: null,
  },
  {
    icon: MousePointerClick,
    title: "Marque o que quiser mudar",
    description:
      'Clique em "Adicionar comentário", depois clique em qualquer ponto do site — ou arraste para marcar uma área inteira — e escreva o ajuste desejado.',
    target: "add-comment",
  },
  {
    icon: ChevronsUp,
    title: "Veja o site inteiro",
    description:
      "Se essa barra de cima atrapalhar a visualização, clique aqui para recolhê-la. O site ocupa a tela toda e um botão fica disponível para trazer a barra de volta.",
    target: "collapse",
  },
  {
    icon: MessageSquare,
    title: "Acompanhe seus comentários",
    description:
      'O botão "Comentários" mostra tudo que você já marcou, com a data de cada um.',
    target: "comments",
  },
  {
    icon: CheckCircle2,
    title: "Está tudo certo?",
    description:
      'Se não precisar de nenhum ajuste, clique em "Aprovar, sem ajustes" aqui no painel.',
    target: "approve",
  },
];

const SPOTLIGHT_PADDING = 8;
const TOOLTIP_GAP = 14;
const TOOLTIP_WIDTH = 360;
const VIEWPORT_MARGIN = 16;

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type TooltipPosition = {
  top: number;
  left: number;
  placement: "top" | "bottom";
};

function measureTarget(target: TourTarget): SpotlightRect | null {
  if (!target) return null;

  const el = document.querySelector<HTMLElement>(`[data-tour-target="${target}"]`);
  if (!el) return null;

  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;

  return {
    top: rect.top - SPOTLIGHT_PADDING,
    left: rect.left - SPOTLIGHT_PADDING,
    width: rect.width + SPOTLIGHT_PADDING * 2,
    height: rect.height + SPOTLIGHT_PADDING * 2,
  };
}

function computeTooltipPosition(
  spotlight: SpotlightRect | null,
  centered: boolean,
): TooltipPosition {
  if (centered || !spotlight) {
    const top = Math.max(
      VIEWPORT_MARGIN,
      window.innerHeight / 2 - 160,
    );
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(
        window.innerWidth / 2 - TOOLTIP_WIDTH / 2,
        window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_MARGIN,
      ),
    );
    return { top, left, placement: "bottom" };
  }

  const spaceBelow =
    window.innerHeight - (spotlight.top + spotlight.height) - TOOLTIP_GAP;
  const spaceAbove = spotlight.top - TOOLTIP_GAP;
  const placeBelow = spaceBelow >= 220 || spaceBelow >= spaceAbove;

  let top: number;
  let placement: "top" | "bottom";

  if (placeBelow) {
    top = spotlight.top + spotlight.height + TOOLTIP_GAP;
    placement = "bottom";
  } else {
    top = spotlight.top - TOOLTIP_GAP - 220;
    placement = "top";
  }

  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(
      spotlight.left + spotlight.width / 2 - TOOLTIP_WIDTH / 2,
      window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_MARGIN,
    ),
  );

  top = Math.max(
    VIEWPORT_MARGIN,
    Math.min(top, window.innerHeight - 220 - VIEWPORT_MARGIN),
  );

  return { top, left, placement };
}

export function SiteReviewTour({
  open,
  onOpenChange,
  onTargetChange,
  onApproveStep,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTargetChange: (target: TourTarget) => void;
  onApproveStep?: (active: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [tooltip, setTooltip] = useState<TooltipPosition>({
    top: 0,
    left: 0,
    placement: "bottom",
  });
  const [mounted, setMounted] = useState(false);

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const Icon = current.icon;
  const hasSpotlight = open && current.target !== null;

  const updateLayout = useCallback(() => {
    const nextSpotlight = open ? measureTarget(current.target) : null;
    setSpotlight(nextSpotlight);
    setTooltip(
      computeTooltipPosition(nextSpotlight, open && current.target === null),
    );
    onTargetChange(open ? current.target : null);
    onApproveStep?.(open && current.target === "approve");
  }, [open, current.target, onTargetChange, onApproveStep]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    updateLayout();

    if (!open) return;

    const frame = window.requestAnimationFrame(updateLayout);
    const onLayout = () => updateLayout();
    const delayed =
      current.target === "approve"
        ? window.setTimeout(updateLayout, 320)
        : undefined;

    window.addEventListener("resize", onLayout);
    window.addEventListener("scroll", onLayout, true);

    return () => {
      window.cancelAnimationFrame(frame);
      if (delayed) window.clearTimeout(delayed);
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("scroll", onLayout, true);
    };
  }, [open, step, updateLayout, current.target]);

  function handleClose() {
    setStep(0);
    onOpenChange(false);
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200]" aria-modal="true" role="dialog">
      {hasSpotlight && spotlight ? (
        <>
          <div
            className="pointer-events-auto absolute rounded-xl border-2 border-[var(--insyt-primary)] bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.58)] transition-all duration-200"
            style={{
              top: spotlight.top,
              left: spotlight.left,
              width: spotlight.width,
              height: spotlight.height,
            }}
            onClick={handleClose}
          />
          <div
            className="pointer-events-none absolute rounded-xl ring-2 ring-[var(--insyt-primary)] ring-offset-2 ring-offset-transparent animate-pulse"
            style={{
              top: spotlight.top,
              left: spotlight.left,
              width: spotlight.width,
              height: spotlight.height,
            }}
          />
        </>
      ) : (
        <button
          type="button"
          aria-label="Fechar tour"
          className="absolute inset-0 cursor-default bg-black/58"
          onClick={handleClose}
        />
      )}

      <div
        className={cn(
          "absolute z-[201] w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-[var(--insyt-border)] bg-white p-5 shadow-2xl",
          tooltip.placement === "top" ? "origin-bottom" : "origin-top",
        )}
        style={{ top: tooltip.top, left: tooltip.left }}
      >
        <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-[#fff4f0] text-[var(--insyt-primary)]">
          <Icon className="size-5" />
        </div>

        <h2 className="text-lg font-semibold text-[var(--insyt-black)]">
          {current.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--insyt-slate)]">
          {current.description}
        </p>

        <div className="mt-4 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step
                  ? "w-6 bg-[var(--insyt-primary)]"
                  : "w-1.5 bg-[var(--insyt-border)]",
              )}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          {step > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep((s) => s - 1)}
            >
              Voltar
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
              Pular
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => (isLast ? handleClose() : setStep((s) => s + 1))}
          >
            {isLast ? "Entendi!" : "Próximo"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
