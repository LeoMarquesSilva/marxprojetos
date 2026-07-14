"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
}: {
  clientId: string;
  currentStage: CrmStage;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleChange(value: string | null) {
    if (!value) return;
    startTransition(async () => {
      const result = await updateCrmClientStage(clientId, value as CrmStage);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
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
  );
}
