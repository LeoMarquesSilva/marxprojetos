"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteCrmClient } from "@/app/actions/crm";

export function CrmDeleteClientButton({ clientId }: { clientId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!window.confirm("Excluir este cliente? Isso remove tarefas e anotações também.")) {
      return;
    }
    startTransition(async () => {
      const result = await deleteCrmClient(clientId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      router.push("/crm");
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={handleDelete}
      disabled={isPending}
      title="Excluir cliente"
    >
      {isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </Button>
  );
}
