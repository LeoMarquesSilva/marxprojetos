"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { toggleAdCampaign } from "@/app/actions/marketing";
import { Switch } from "@/components/ui/switch";

/** Liga/pausa a campanha na Meta. Criar e editar anúncio fica no Gerenciador. */
export function MarketingCampaignToggle({
  campaignId,
  active,
  name,
}: {
  campaignId: string;
  active: boolean;
  name: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function change(next: boolean) {
    startTransition(async () => {
      const result = await toggleAdCampaign(campaignId, next);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(next ? `${name} reativada.` : `${name} pausada.`);
      router.refresh();
    });
  }

  return (
    <Switch
      checked={active}
      disabled={isPending}
      onCheckedChange={change}
      aria-label={active ? `Pausar ${name}` : `Reativar ${name}`}
    />
  );
}
