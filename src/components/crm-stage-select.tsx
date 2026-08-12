"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CrmLostReasonDialog } from "@/components/crm-lost-reason-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateCrmClientStage } from "@/app/actions/crm";
import { STAGE_COLUMNS, STAGE_LABELS, type CrmStage } from "@/types/crm";

export function CrmStageSelect({
  clientId,
  currentStage,
  lostReason,
}: {
  clientId: string;
  currentStage: CrmStage;
  lostReason: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const [lostReasonInput, setLostReasonInput] = useState("");
  const router = useRouter();

  function commitStage(stage: CrmStage, reason?: string) {
    startTransition(async () => {
      const result = await updateCrmClientStage(clientId, stage, reason);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setLostDialogOpen(false);
      router.refresh();
    });
  }

  function handleChange(value: string | null) {
    if (!value) return;
    const stage = value as CrmStage;
    if (stage === "perdido") {
      setLostReasonInput(lostReason ?? "");
      setLostDialogOpen(true);
      return;
    }
    commitStage(stage);
  }

  return (
    <>
      <Select value={currentStage} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger className="w-44">
          <SelectValue>
            {(value: CrmStage | null) => (value ? STAGE_LABELS[value] : "")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {STAGE_COLUMNS.map((stage) => (
            <SelectItem key={stage} value={stage}>
              {STAGE_LABELS[stage]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <CrmLostReasonDialog
        open={lostDialogOpen}
        inputId="crm-detail-lost-reason"
        reason={lostReasonInput}
        isPending={isPending}
        onReasonChange={setLostReasonInput}
        onCancel={() => setLostDialogOpen(false)}
        onConfirm={(reason) => commitStage("perdido", reason)}
      />
    </>
  );
}
