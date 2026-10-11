"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Moldura dos modais da prospecção: centralizados, cabeçalho com borda,
// corpo com rolagem e rodapé fixo — o mesmo padrão dos modais de finanças.
export function ProspectingDialogShell({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-3xl bg-white p-0",
          wide ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}
      >
        <DialogHeader className="border-b border-[var(--insyt-border)] px-6 py-5 pr-12">
          <DialogTitle className="text-2xl font-bold text-[var(--insyt-black)]">
            {title}
          </DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">{children}</div>

        {footer ? (
          <div className="border-t border-[var(--insyt-border)] px-6 py-4">{footer}</div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
