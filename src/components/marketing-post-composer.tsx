"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Save,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import { saveMarketingPost } from "@/app/actions/marketing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CAPTION_LIMIT,
  CAROUSEL_MAX,
  HASHTAG_LIMIT,
  countHashtags,
  storageSafeName,
} from "@/lib/marketing";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  POST_KIND_LABELS,
  type MarketingMedia,
  type MarketingPost,
  type MarketingPostKind,
} from "@/types/marketing";

const BUCKET = "marketing-media";
// Feed do Instagram aceita de 4:5 (retrato) a 1,91:1 (paisagem).
const MIN_RATIO = 0.8;
const MAX_RATIO = 1.91;
const MAX_IMAGE_WIDTH = 1440;

type Mode = "publicar" | "agendar" | "rascunho";

function defaultScheduleValue() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return toLocalInput(date);
}

function toLocalInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Não deu para abrir ${file.name}.`));
    image.src = url;
  });
}

/**
 * A Meta só publica JPEG de até 8 MB e 1440 px de largura. Reencodar no
 * navegador resolve PNG/WebP/HEIC-convertido e fotos grandes de câmera.
 */
async function prepareImage(file: File): Promise<{ blob: Blob; ratio: number }> {
  const image = await loadImage(file);
  const ratio = image.naturalWidth / image.naturalHeight;
  const scale = Math.min(1, MAX_IMAGE_WIDTH / image.naturalWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("O navegador não conseguiu processar a imagem.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(image.src);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9),
  );
  if (!blob) throw new Error("O navegador não conseguiu gerar o JPEG.");
  return { blob, ratio };
}

function videoDuration(file: File) {
  return new Promise<number>((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(Number.NaN);
    };
    video.src = url;
  });
}

/** Sem `post`, cria um novo; com `post`, edita rascunho/agendado/erro. */
export function MarketingPostComposer({ post }: { post?: MarketingPost }) {
  const router = useRouter();
  const editing = Boolean(post);
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<MarketingPostKind>("imagem");
  const [media, setMedia] = useState<MarketingMedia[]>([]);
  const [caption, setCaption] = useState("");
  const [mode, setMode] = useState<Mode>("publicar");
  const [scheduleAt, setScheduleAt] = useState(defaultScheduleValue());
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  function openComposer() {
    if (post) {
      setKind(post.kind);
      setMedia(post.media);
      setCaption(post.caption);
      setMode(post.scheduled_at && post.status === "agendado" ? "agendar" : "publicar");
      setScheduleAt(
        post.scheduled_at ? toLocalInput(new Date(post.scheduled_at)) : defaultScheduleValue(),
      );
    } else {
      setKind("imagem");
      setMedia([]);
      setCaption("");
      setMode("publicar");
      setScheduleAt(defaultScheduleValue());
    }
    setOpen(true);
  }

  function changeKind(next: MarketingPostKind) {
    if (next === kind) return;
    // Trocar de foto para reels (ou vice-versa) invalida a mídia já escolhida.
    const keep = media.filter((item) =>
      next === "reels" ? item.type === "video" : item.type === "image",
    );
    setMedia(next === "imagem" ? keep.slice(0, 1) : next === "reels" ? keep.slice(0, 1) : keep);
    setKind(next);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const supabase = createClient();
    const month = new Date().toISOString().slice(0, 7);
    const limit = kind === "carrossel" ? CAROUSEL_MAX - media.length : 1;
    const chosen = Array.from(files).slice(0, Math.max(0, limit));
    if (chosen.length === 0) {
      toast.error(`O carrossel já tem ${CAROUSEL_MAX} fotos.`);
      return;
    }

    setUploading(true);
    const uploaded: MarketingMedia[] = [];
    try {
      for (const file of chosen) {
        let body: Blob = file;
        let contentType = file.type;
        let type: MarketingMedia["type"] = "image";

        if (kind === "reels") {
          if (!["video/mp4", "video/quicktime"].includes(file.type)) {
            throw new Error("Reels precisa ser um vídeo MP4 ou MOV.");
          }
          const duration = await videoDuration(file);
          if (Number.isFinite(duration) && (duration < 3 || duration > 15 * 60)) {
            throw new Error("Reels precisa ter de 3 segundos a 15 minutos.");
          }
          type = "video";
        } else {
          if (!file.type.startsWith("image/")) {
            throw new Error(`${file.name} não é uma imagem.`);
          }
          const prepared = await prepareImage(file);
          if (prepared.ratio < MIN_RATIO - 0.01 || prepared.ratio > MAX_RATIO + 0.01) {
            throw new Error(
              `${file.name} está fora do formato aceito pelo feed (de 4:5 em pé até 1,91:1 deitado). Recorte e envie de novo.`,
            );
          }
          body = prepared.blob;
          contentType = "image/jpeg";
        }

        const baseName = storageSafeName(file.name).replace(/\.[a-z0-9]+$/, "");
        const extension = type === "image" ? "jpg" : file.type === "video/quicktime" ? "mov" : "mp4";
        const path = `posts/${month}/${nanoid(10)}-${baseName}.${extension}`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, body, { contentType, upsert: false, cacheControl: "31536000" });
        if (error) throw new Error(`Falha no envio de ${file.name}: ${error.message}`);
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        uploaded.push({ path, url: data.publicUrl, type });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no envio.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }

    if (uploaded.length > 0) {
      setMedia((current) => (kind === "carrossel" ? [...current, ...uploaded] : uploaded));
    }
  }

  function removeMedia(index: number) {
    const removed = media[index];
    setMedia((current) => current.filter((_, position) => position !== index));
    // Arquivo que ainda não está salvo em post nenhum é lixo no bucket.
    const saved = post?.media.some((item) => item.path === removed.path);
    if (!saved) void createClient().storage.from(BUCKET).remove([removed.path]);
  }

  function moveMedia(index: number, offset: number) {
    setMedia((current) => {
      const next = [...current];
      const target = index + offset;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function save(saveMode: Mode) {
    const scheduledAt =
      saveMode === "agendar" ? new Date(scheduleAt).toISOString() : null;
    startTransition(async () => {
      const result = await saveMarketingPost(
        { kind, caption, media, mode: saveMode, scheduledAt },
        post?.id,
      );
      if (result.error) {
        toast.error(result.error);
        if (result.post) {
          setOpen(false);
          router.refresh();
        }
        return;
      }
      toast.success(
        saveMode === "rascunho"
          ? "Rascunho salvo."
          : saveMode === "agendar"
            ? "Post agendado."
            : result.post?.status === "publicado"
              ? "Publicado no Instagram."
              : "Enviado. A Meta está processando o vídeo — publica em alguns minutos.",
      );
      setOpen(false);
      router.refresh();
    });
  }

  const hashtags = countHashtags(caption);
  const accept = kind === "reels" ? "video/mp4,video/quicktime" : "image/*";
  const canAddMore =
    kind === "carrossel" ? media.length < CAROUSEL_MAX : media.length === 0;

  return (
    <>
      {editing ? (
        <Button type="button" variant="ghost" size="icon-sm" title="Editar post" onClick={openComposer}>
          <Pencil className="size-3.5" />
        </Button>
      ) : (
        <Button
          type="button"
          onClick={openComposer}
          className="border-white/15 bg-white/10 text-white hover:bg-white/15"
        >
          <Plus className="size-4" />
          Novo post
        </Button>
      )}

      <Dialog open={open} onOpenChange={(next) => !isPending && !uploading && setOpen(next)}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-3xl bg-white p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-[var(--insyt-border)] px-6 py-5 pr-12">
            <DialogTitle className="text-2xl font-bold text-[var(--insyt-black)]">
              {editing ? "Editar post" : "Novo post"}
            </DialogTitle>
            <DialogDescription>
              Publica direto no Instagram da INSYT, agora ou na data marcada.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[var(--insyt-canvas)] p-1">
              {(Object.keys(POST_KIND_LABELS) as MarketingPostKind[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => changeKind(value)}
                  className={cn(
                    "rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                    kind === value
                      ? "bg-white text-[var(--insyt-black)] shadow-sm"
                      : "text-[var(--insyt-muted)]",
                  )}
                >
                  {POST_KIND_LABELS[value]}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Label>
                {kind === "reels" ? "Vídeo" : kind === "carrossel" ? "Fotos (2 a 10)" : "Foto"}
              </Label>
              <div className="flex flex-wrap gap-3">
                {media.map((item, index) => (
                  <div
                    key={item.path}
                    className="group relative size-28 overflow-hidden rounded-2xl border border-[var(--insyt-border)] bg-[var(--insyt-canvas)]"
                  >
                    {item.type === "video" ? (
                      <video src={item.url} className="size-full object-cover" muted playsInline />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- prévia do arquivo recém-enviado
                      <img src={item.url} alt="" className="size-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(index)}
                      className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                      title="Remover"
                    >
                      <X className="size-3.5" />
                    </button>
                    {kind === "carrossel" ? (
                      <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => moveMedia(index, -1)}
                          disabled={index === 0}
                          className="rounded-full bg-black/60 p-1 text-white disabled:opacity-0"
                          title="Mover para a esquerda"
                        >
                          <ChevronLeft className="size-3.5" />
                        </button>
                        <span className="rounded-full bg-black/60 px-1.5 text-[10px] font-semibold text-white">
                          {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => moveMedia(index, 1)}
                          disabled={index === media.length - 1}
                          className="rounded-full bg-black/60 p-1 text-white disabled:opacity-0"
                          title="Mover para a direita"
                        >
                          <ChevronRight className="size-3.5" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
                {canAddMore ? (
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={uploading}
                    className="flex size-28 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-[var(--insyt-border)] text-xs font-semibold text-[var(--insyt-muted)] transition-colors hover:border-[var(--insyt-primary)]/50 hover:text-[var(--insyt-primary)]"
                  >
                    {uploading ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : (
                      <ImagePlus className="size-5" />
                    )}
                    {uploading ? "Enviando…" : "Adicionar"}
                  </button>
                ) : null}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept={accept}
                multiple={kind === "carrossel"}
                className="hidden"
                onChange={(event) => handleFiles(event.target.files)}
              />
              <p className="text-xs text-[var(--insyt-muted)]">
                {kind === "reels"
                  ? "MP4 ou MOV, de 3 s a 15 min, de preferência 9:16 (1080×1920)."
                  : "Do formato 4:5 (em pé) até 1,91:1 (deitado). Vira JPEG de até 1440 px."}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="marketing-caption">Legenda</Label>
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    caption.length > CAPTION_LIMIT || hashtags > HASHTAG_LIMIT
                      ? "font-semibold text-red-700"
                      : "text-[var(--insyt-muted)]",
                  )}
                >
                  {caption.length}/{CAPTION_LIMIT} · {hashtags}/{HASHTAG_LIMIT} hashtags
                </span>
              </div>
              <Textarea
                id="marketing-caption"
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                rows={7}
                placeholder="Escreva a legenda. Hashtags e @menções funcionam normalmente."
              />
            </div>

            <div className="space-y-2">
              <Label>Quando publicar</Label>
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[var(--insyt-canvas)] p-1">
                {(
                  [
                    ["publicar", "Agora"],
                    ["agendar", "Agendar"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={cn(
                      "rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                      mode === value
                        ? "bg-white text-[var(--insyt-black)] shadow-sm"
                        : "text-[var(--insyt-muted)]",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {mode === "agendar" ? (
                <Input
                  type="datetime-local"
                  value={scheduleAt}
                  min={toLocalInput(new Date())}
                  onChange={(event) => setScheduleAt(event.target.value)}
                />
              ) : null}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-[var(--insyt-border)] px-6 py-4 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={isPending || uploading}
              onClick={() => save("rascunho")}
            >
              <Save className="size-4" />
              Salvar rascunho
            </Button>
            <Button
              type="button"
              disabled={isPending || uploading || media.length === 0}
              onClick={() => save(mode)}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : mode === "agendar" ? (
                <CalendarClock className="size-4" />
              ) : (
                <Send className="size-4" />
              )}
              {mode === "agendar" ? "Agendar" : "Publicar agora"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
