"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarX, Loader2, RefreshCw, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteMarketingPost,
  publishMarketingPostNow,
  unscheduleMarketingPost,
} from "@/app/actions/marketing";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { MarketingPost } from "@/types/marketing";

export function MarketingPostActions({ post }: { post: MarketingPost }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function publishNow() {
    startTransition(async () => {
      const result = await publishMarketingPostNow(post.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          result.status === "publicado"
            ? "Publicado no Instagram."
            : "A Meta ainda está processando. Tente atualizar em instantes.",
        );
      }
      router.refresh();
    });
  }

  function unschedule() {
    startTransition(async () => {
      const result = await unscheduleMarketingPost(post.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Agendamento cancelado. O post virou rascunho.");
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteMarketingPost(post.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Post apagado do sistema.");
      router.refresh();
    });
  }

  if (isPending) {
    return <Loader2 className="size-4 animate-spin text-[var(--insyt-muted)]" />;
  }

  return (
    <div className="flex items-center gap-1">
      {post.status === "publicando" ? (
        <Button type="button" variant="ghost" size="icon-sm" title="Verificar agora" onClick={publishNow}>
          <RefreshCw className="size-3.5" />
        </Button>
      ) : null}
      {post.status === "rascunho" || post.status === "agendado" || post.status === "erro" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title={post.status === "erro" ? "Tentar de novo" : "Publicar agora"}
          onClick={publishNow}
        >
          <Send className="size-3.5" />
        </Button>
      ) : null}
      {post.status === "agendado" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Cancelar agendamento"
          onClick={unschedule}
        >
          <CalendarX className="size-3.5" />
        </Button>
      ) : null}
      {post.status !== "publicando" ? (
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button type="button" variant="ghost" size="icon-sm" title="Apagar post">
                <Trash2 className="size-3.5" />
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apagar este post?</AlertDialogTitle>
              <AlertDialogDescription>
                {post.status === "publicado"
                  ? "Some só daqui do sistema. O post continua no Instagram — para tirar de lá, apague pelo app."
                  : "O post e a mídia enviada são apagados. Isso não tem volta."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={remove}>Apagar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
