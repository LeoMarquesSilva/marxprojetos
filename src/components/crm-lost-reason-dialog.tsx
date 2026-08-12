"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CrmLostReasonDialog({
  open,
  inputId = "crm-lost-reason",
  reason,
  isPending = false,
  onCancel,
  onReasonChange,
  onConfirm,
}: {
  open: boolean;
  inputId?: string;
  reason: string;
  isPending?: boolean;
  onCancel: () => void;
  onReasonChange: (reason: string) => void;
  onConfirm: (reason: string) => void;
}) {
  function confirm() {
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      toast.error("Informe o motivo da perda.");
      return;
    }
    onConfirm(normalizedReason);
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar motivo da perda</DialogTitle>
          <DialogDescription>
            Informe por que esta oportunidade foi perdida antes de movê-la no
            funil.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={inputId}>Motivo da perda *</Label>
          <Textarea
            id={inputId}
            autoFocus
            rows={3}
            placeholder="Ex: preço, prazo ou escolheu outro fornecedor..."
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            disabled={isPending}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={confirm} disabled={isPending}>
            Mover para perdido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
