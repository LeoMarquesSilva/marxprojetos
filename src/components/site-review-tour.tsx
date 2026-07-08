"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronsUp,
  MessageSquare,
  MessageSquarePlus,
  MousePointerClick,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type TourTarget = "add-comment" | "collapse" | "comments" | null;

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
      "Clique em \"Adicionar comentário\", depois clique em qualquer ponto do site — ou arraste para marcar uma área inteira — e escreva o ajuste desejado.",
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
      "O botão \"Comentários\" mostra tudo que você já marcou, com a data de cada um.",
    target: "comments",
  },
  {
    icon: CheckCircle2,
    title: "Está tudo certo?",
    description:
      "Se não precisar de nenhum ajuste, abra os comentários e clique em \"Aprovar, sem ajustes\".",
    target: "comments",
  },
];

export function SiteReviewTour({
  open,
  onOpenChange,
  onTargetChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTargetChange: (target: TourTarget) => void;
}) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const Icon = current.icon;

  useEffect(() => {
    onTargetChange(open ? current.target : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  function handleOpenChange(next: boolean) {
    if (!next) setStep(0);
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-[#fff4f0] text-[var(--insyt-primary)]">
            <Icon className="size-5" />
          </div>
          <DialogTitle className="text-lg">{current.title}</DialogTitle>
          <DialogDescription className="text-[var(--insyt-slate)]">
            {current.description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step
                  ? "w-6 bg-[var(--insyt-primary)]"
                  : "w-1.5 bg-[var(--insyt-border)]"
              }`}
            />
          ))}
        </div>

        <DialogFooter className="!mt-2 flex-row items-center justify-between border-none bg-transparent p-0">
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleOpenChange(false)}
            >
              Pular
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => (isLast ? handleOpenChange(false) : setStep((s) => s + 1))}
          >
            {isLast ? "Entendi!" : "Próximo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
