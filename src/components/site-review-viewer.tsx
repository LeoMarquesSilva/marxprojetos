"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  HelpCircle,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  PartyPopper,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BrandLogo } from "@/components/brand-logo";
import { SiteReviewTour, type TourTarget } from "@/components/site-review-tour";
import { addReviewComment, approveReview } from "@/app/actions/review";
import { cn } from "@/lib/utils";
import type { SiteComment } from "@/types/briefing";

const TOUR_TARGET_ACTIVE = "relative z-[201]";

type Mode = "view" | "comment";

type PendingPin = {
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  pagePath: string;
  left: number;
  top: number;
};

const PIN_CONTAINER_ID = "__review-pins-container";
const DRAG_THRESHOLD = 8;
const POPOVER_WIDTH = 320;
const POPOVER_HEIGHT = 240;
const POPOVER_MARGIN = 12;

function clampPopoverPosition(
  clientX: number,
  clientY: number,
  boundsWidth: number,
  boundsHeight: number,
) {
  const halfW = POPOVER_WIDTH / 2;

  let left: number;
  if (boundsWidth < POPOVER_WIDTH + POPOVER_MARGIN * 2) {
    left = boundsWidth / 2;
  } else {
    left = Math.min(
      Math.max(clientX, halfW + POPOVER_MARGIN),
      boundsWidth - halfW - POPOVER_MARGIN,
    );
  }

  let top = clientY + POPOVER_MARGIN;
  if (top + POPOVER_HEIGHT > boundsHeight - POPOVER_MARGIN) {
    top = clientY - POPOVER_HEIGHT - POPOVER_MARGIN;
  }
  top = Math.max(
    POPOVER_MARGIN,
    Math.min(top, Math.max(POPOVER_MARGIN, boundsHeight - POPOVER_HEIGHT - POPOVER_MARGIN)),
  );

  return { left, top };
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return format(new Date(iso), "d MMM yyyy 'às' HH:mm", { locale: ptBR });
}

export function SiteReviewViewer({
  token,
  sitePath,
  title,
  availableSince,
  initialApprovedAt,
  initialComments,
}: {
  token: string;
  sitePath: string;
  title: string;
  availableSince: string | null;
  initialApprovedAt: string | null;
  initialComments: SiteComment[];
}) {
  const [comments, setComments] = useState<SiteComment[]>(initialComments);
  const [approvedAt, setApprovedAt] = useState(initialApprovedAt);
  const [mode, setMode] = useState<Mode>("view");
  const [pendingPin, setPendingPin] = useState<PendingPin | null>(null);
  const [commentText, setCommentText] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourTarget, setTourTarget] = useState<TourTarget>(null);
  const [isPending, startTransition] = useTransition();
  const [isApproving, startApproveTransition] = useTransition();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef(mode);
  const commentsRef = useRef(comments);

  const tourSeenKey = `insyt-review-tour-seen-${token}`;

  useEffect(() => {
    // Reading localStorage must happen post-mount (SSR has no window), so
    // this can't be a lazy useState initializer without a hydration mismatch.
    if (!window.localStorage.getItem(tourSeenKey)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTourOpen(true);
      setControlsCollapsed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTourOpenChange(open: boolean) {
    setTourOpen(open);
    if (!open) {
      window.localStorage.setItem(tourSeenKey, "true");
    }
  }

  function openTour() {
    setControlsCollapsed(false);
    setTourOpen(true);
  }

  function handleTourApproveStep(active: boolean) {
    if (active) {
      setCommentsOpen(true);
    }
  }

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    commentsRef.current = comments;
    renderPins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments]);

  useEffect(() => {
    // The iframe's `src` is present in the SSR'd HTML, so the browser can
    // finish loading it before React hydrates and attaches `onLoad` below.
    // Poll briefly on mount to catch that case; setupIframe() is idempotent.
    const interval = setInterval(() => {
      const doc = iframeRef.current?.contentDocument;
      if (doc?.readyState === "complete" && doc.body) {
        setupIframe();
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function renderPins() {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;

    let container = doc.getElementById(PIN_CONTAINER_ID);
    if (!container) {
      container = doc.createElement("div");
      container.id = PIN_CONTAINER_ID;
      container.style.cssText =
        "position:absolute;top:0;left:0;width:0;height:0;z-index:2147483647;";
      doc.body.appendChild(container);
    }
    container.innerHTML = "";

    const scrollWidth = doc.documentElement.scrollWidth;
    const scrollHeight = doc.documentElement.scrollHeight;

    commentsRef.current.forEach((c, i) => {
      const color = c.status === "resolved" ? "#8b909d" : "#f74211";
      const left = (c.x_pct / 100) * scrollWidth;
      const top = (c.y_pct / 100) * scrollHeight;
      const isArea = c.width_pct > 0 && c.height_pct > 0;

      if (isArea) {
        const width = (c.width_pct / 100) * scrollWidth;
        const height = (c.height_pct / 100) * scrollHeight;
        const rect = doc!.createElement("div");
        rect.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${width}px;height:${height}px;border:2px solid ${color};background:${color}22;border-radius:6px;pointer-events:none;`;
        const badge = doc!.createElement("span");
        badge.style.cssText = `position:absolute;top:-11px;left:-11px;width:22px;height:22px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font:700 11px sans-serif;color:#fff;background:${color};box-shadow:0 2px 8px rgba(0,0,0,.35);`;
        badge.textContent = String(i + 1);
        rect.appendChild(badge);
        container!.appendChild(rect);
        return;
      }

      const pin = doc!.createElement("div");
      pin.style.cssText = `position:absolute;left:${left}px;top:${top}px;transform:translate(-50%,-100%) rotate(45deg);width:28px;height:28px;border-radius:50% 50% 50% 0;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.35);pointer-events:none;background:${color};`;
      const label = doc!.createElement("span");
      label.style.cssText =
        "transform:rotate(-45deg);display:block;font:700 12px sans-serif;color:#fff;";
      label.textContent = String(i + 1);
      pin.appendChild(label);
      container!.appendChild(pin);
    });
  }

  function setupIframe() {
    const doc = iframeRef.current?.contentDocument;
    const win = iframeRef.current?.contentWindow;
    if (!doc || !win || !doc.body) return;

    // Guard against double setup: onLoad can fire, and we also probe on
    // mount in case the iframe (SSR'd with its src already set) finished
    // loading before React hydrated and attached the onLoad handler.
    if (doc.body.dataset.reviewSetupDone === "true") return;
    doc.body.dataset.reviewSetupDone = "true";

    renderPins();

    let selectionEl: HTMLDivElement | null = null;
    function updateSelectionRect(x1: number, y1: number, x2: number, y2: number) {
      if (!selectionEl) {
        selectionEl = doc!.createElement("div");
        selectionEl.style.cssText =
          "position:absolute;border:2px dashed #f74211;background:rgba(247,66,17,0.12);pointer-events:none;z-index:2147483647;border-radius:4px;";
        doc!.body.appendChild(selectionEl);
      }
      selectionEl.style.left = `${Math.min(x1, x2)}px`;
      selectionEl.style.top = `${Math.min(y1, y2)}px`;
      selectionEl.style.width = `${Math.abs(x2 - x1)}px`;
      selectionEl.style.height = `${Math.abs(y2 - y1)}px`;
    }
    function removeSelectionRect() {
      selectionEl?.remove();
      selectionEl = null;
    }

    let dragStart: { x: number; y: number } | null = null;
    let isDragging = false;

    function finishSelection(
      start: { x: number; y: number },
      endPageX: number,
      endPageY: number,
      endClientX: number,
      endClientY: number,
    ) {
      removeSelectionRect();

      const scrollWidth = doc!.documentElement.scrollWidth;
      const scrollHeight = doc!.documentElement.scrollHeight;
      const dx = Math.abs(endPageX - start.x);
      const dy = Math.abs(endPageY - start.y);
      const isArea = dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD;

      const x1 = Math.min(start.x, endPageX);
      const y1 = Math.min(start.y, endPageY);
      const x2 = Math.max(start.x, endPageX);
      const y2 = Math.max(start.y, endPageY);

      const bounds = wrapperRef.current?.getBoundingClientRect();
      const { left, top } = clampPopoverPosition(
        endClientX,
        endClientY,
        bounds?.width ?? win!.innerWidth,
        bounds?.height ?? win!.innerHeight,
      );

      setPendingPin({
        xPct: (x1 / scrollWidth) * 100,
        yPct: (y1 / scrollHeight) * 100,
        widthPct: isArea ? ((x2 - x1) / scrollWidth) * 100 : 0,
        heightPct: isArea ? ((y2 - y1) / scrollHeight) * 100 : 0,
        pagePath: doc!.location.pathname || "/",
        left,
        top,
      });
      setMode("view");
      doc!.body.style.cursor = "";
    }

    const onMouseDown = (e: MouseEvent) => {
      if (modeRef.current !== "comment") return;
      e.preventDefault();
      e.stopPropagation();
      dragStart = { x: e.pageX, y: e.pageY };
      isDragging = true;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragStart) return;
      e.preventDefault();
      updateSelectionRect(dragStart.x, dragStart.y, e.pageX, e.pageY);
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!isDragging || !dragStart) return;
      e.preventDefault();
      e.stopPropagation();
      isDragging = false;
      const start = dragStart;
      dragStart = null;
      finishSelection(start, e.pageX, e.pageY, e.clientX, e.clientY);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (modeRef.current !== "comment") return;
      e.preventDefault();
      e.stopPropagation();
      const t = e.touches[0];
      dragStart = { x: t.pageX, y: t.pageY };
      isDragging = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || !dragStart) return;
      e.preventDefault();
      const t = e.touches[0];
      updateSelectionRect(dragStart.x, dragStart.y, t.pageX, t.pageY);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!isDragging || !dragStart) return;
      e.preventDefault();
      e.stopPropagation();
      isDragging = false;
      const start = dragStart;
      dragStart = null;
      const t = e.changedTouches[0];
      finishSelection(start, t.pageX, t.pageY, t.clientX, t.clientY);
    };

    const onClickSwallow = (e: MouseEvent) => {
      if (modeRef.current === "comment") {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    doc.addEventListener("mousedown", onMouseDown, true);
    doc.addEventListener("mousemove", onMouseMove, true);
    doc.addEventListener("mouseup", onMouseUp, true);
    doc.addEventListener("touchstart", onTouchStart, { capture: true, passive: false });
    doc.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });
    doc.addEventListener("touchend", onTouchEnd, { capture: true, passive: false });
    doc.addEventListener("click", onClickSwallow, true);

    const onResize = () => renderPins();
    win.addEventListener("resize", onResize);
  }

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (doc?.body) {
      doc.body.style.cursor = mode === "comment" ? "crosshair" : "";
    }
  }, [mode]);

  function cancelPending() {
    setPendingPin(null);
    setCommentText("");
  }

  function submitComment() {
    if (!pendingPin) return;
    if (!commentText.trim()) {
      toast.error("Escreva o comentário antes de enviar.");
      return;
    }

    const win = iframeRef.current?.contentWindow;
    const viewportWidth = win?.innerWidth ?? 0;

    startTransition(async () => {
      const result = await addReviewComment({
        token,
        pagePath: pendingPin.pagePath,
        xPct: pendingPin.xPct,
        yPct: pendingPin.yPct,
        widthPct: pendingPin.widthPct,
        heightPct: pendingPin.heightPct,
        viewportWidth,
        comment: commentText.trim(),
        authorName: authorName || undefined,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setComments((prev) => [
        ...prev,
        {
          id: result.commentId!,
          project_id: "",
          page_path: pendingPin.pagePath,
          x_pct: pendingPin.xPct,
          y_pct: pendingPin.yPct,
          width_pct: pendingPin.widthPct,
          height_pct: pendingPin.heightPct,
          viewport_width: viewportWidth,
          comment: commentText.trim(),
          author_name: authorName || null,
          author_email: null,
          status: "open",
          created_at: new Date().toISOString(),
          resolved_at: null,
        },
      ]);
      setCommentText("");
      setPendingPin(null);
      toast.success("Comentário adicionado!");
    });
  }

  function handleApprove() {
    startApproveTransition(async () => {
      const result = await approveReview(token);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setApprovedAt(result.approvedAt ?? new Date().toISOString());
      toast.success("Site aprovado! Obrigado pelo retorno.");
    });
  }

  function scrollToComment(c: SiteComment) {
    const win = iframeRef.current?.contentWindow;
    const doc = iframeRef.current?.contentDocument;
    if (!win || !doc) return;
    const y = (c.y_pct / 100) * doc.documentElement.scrollHeight - 160;
    win.scrollTo({ top: Math.max(y, 0), behavior: "smooth" });
  }

  const openComments = comments.filter((c) => c.status === "open");
  const resolvedComments = comments.filter((c) => c.status === "resolved");
  const availableSinceLabel = formatDate(availableSince);
  const approvedAtLabel = formatDate(approvedAt);

  return (
    <div className="flex h-screen w-screen flex-col bg-[var(--insyt-canvas)]">
      {controlsCollapsed ? (
        <button
          type="button"
          onClick={() => setControlsCollapsed(false)}
          className="fixed top-3 right-3 z-50 flex items-center gap-1.5 rounded-full bg-[var(--insyt-black)]/90 px-3 py-2 text-xs font-medium text-white shadow-lg backdrop-blur"
        >
          <ChevronDown className="size-3.5" />
          Mostrar controles
        </button>
      ) : (
        <>
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[var(--insyt-border)] bg-white/90 px-4 backdrop-blur-xl">
            <div className="flex min-w-0 items-center gap-3 overflow-hidden">
              <BrandLogo showProduct={false} href={undefined} />
              <span className="hidden truncate text-sm font-medium text-[var(--insyt-slate)] sm:inline">
                {title}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden rounded-full bg-[#fff4f0] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--insyt-primary-dark)] sm:inline">
                Revisão do site
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="Recolher controles"
                data-tour-target="collapse"
                onClick={() => setControlsCollapsed(true)}
                className={cn(tourTarget === "collapse" && TOUR_TARGET_ACTIVE)}
              >
                <ChevronUp className="size-4" />
              </Button>
            </div>
          </header>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--insyt-border)] bg-white px-4 py-2">
            <Button
              type="button"
              variant={mode === "comment" ? "default" : "outline"}
              size="sm"
              data-tour-target="add-comment"
              onClick={() => setMode((m) => (m === "comment" ? "view" : "comment"))}
              className={cn(tourTarget === "add-comment" && TOUR_TARGET_ACTIVE)}
            >
              {mode === "comment" ? (
                <>
                  <X className="size-4" />
                  Cancelar
                </>
              ) : (
                <>
                  <MessageSquarePlus className="size-4" />
                  <span className="hidden sm:inline">Adicionar comentário</span>
                  <span className="sm:hidden">Comentar</span>
                </>
              )}
            </Button>

            {mode === "comment" ? (
              <p className="hidden flex-1 text-center text-xs text-[var(--insyt-primary-dark)] sm:block">
                Clique para marcar um ponto, ou arraste para marcar uma área.
              </p>
            ) : approvedAtLabel ? (
              <span className="hidden items-center gap-1.5 text-xs font-medium text-emerald-700 sm:flex">
                <CheckCircle2 className="size-3.5" />
                Aprovado em {approvedAtLabel}
              </span>
            ) : (
              <div className="hidden flex-1 sm:block" />
            )}

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="Como funciona a revisão"
                onClick={openTour}
              >
                <HelpCircle className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-tour-target="comments"
                onClick={() => setCommentsOpen(true)}
                className={cn(tourTarget === "comments" && TOUR_TARGET_ACTIVE)}
              >
                <MessageSquare className="size-4" />
                <span className="hidden sm:inline">Comentários</span>
                <Badge variant="secondary" className="ml-1">
                  {comments.length}
                </Badge>
              </Button>
            </div>
          </div>
        </>
      )}

      <SiteReviewTour
        open={tourOpen}
        onOpenChange={handleTourOpenChange}
        onTargetChange={setTourTarget}
        onApproveStep={handleTourApproveStep}
      />

      <div ref={wrapperRef} className="relative min-h-0 flex-1 bg-white">
        <iframe
          ref={iframeRef}
          src={`/sites/${sitePath}/index.html`}
          onLoad={setupIframe}
          title="Site para revisão"
          className="absolute inset-0 h-full w-full border-0"
        />

        {pendingPin ? (
          <div
            className="absolute z-50 w-80 max-w-[calc(100%-2rem)]"
            style={{ left: pendingPin.left, top: pendingPin.top, transform: "translate(-50%, 0)" }}
          >
            <Card className="insyt-card border-none shadow-xl">
              <CardContent className="space-y-3 pt-6">
                <Textarea
                  autoFocus
                  rows={3}
                  placeholder="Descreva o ajuste desejado..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <Input
                  placeholder="Seu nome"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={cancelPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={submitComment}
                    disabled={isPending}
                  >
                    {isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Enviar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>

      <Sheet open={commentsOpen} onOpenChange={setCommentsOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Comentários ({comments.length})</SheetTitle>
            {availableSinceLabel ? (
              <p className="text-xs text-[var(--insyt-muted)]">
                Disponível para revisão desde {availableSinceLabel}
              </p>
            ) : null}
          </SheetHeader>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
            {approvedAtLabel ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <CheckCircle2 className="size-4 shrink-0" />
                Site aprovado em {approvedAtLabel}
              </div>
            ) : null}

            {comments.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--insyt-border)] bg-[var(--insyt-canvas)] px-6 py-10 text-center">
                <PartyPopper className="size-8 text-[var(--insyt-primary)]" />
                <p className="text-sm text-[var(--insyt-slate)]">
                  Nenhum comentário ainda. Se estiver tudo certo, pode aprovar
                  direto.
                </p>
                {!approvedAt ? (
                  <Button
                    type="button"
                    data-tour-target="approve"
                    onClick={handleApprove}
                    disabled={isApproving}
                    className={cn(tourTarget === "approve" && TOUR_TARGET_ACTIVE)}
                  >
                    {isApproving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-4" />
                    )}
                    Aprovar, sem ajustes
                  </Button>
                ) : null}
              </div>
            ) : (
              [...openComments, ...resolvedComments].map((c, i) => {
                const isResolved = c.status === "resolved";
                const isArea = c.width_pct > 0 && c.height_pct > 0;
                const idx = comments.indexOf(c) + 1;
                const dateLabel = formatDate(c.created_at);
                return (
                  <button
                    key={c.id + i}
                    type="button"
                    onClick={() => {
                      scrollToComment(c);
                      setCommentsOpen(false);
                    }}
                    className="w-full rounded-xl border border-[var(--insyt-border)] bg-[var(--insyt-canvas)] p-3 text-left transition hover:bg-[var(--insyt-canvas-alt)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--insyt-primary)] text-[10px] font-bold text-white">
                        {idx}
                      </span>
                      <div className="flex gap-1">
                        {isArea ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Área
                          </Badge>
                        ) : null}
                        {isResolved ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Resolvido
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-[var(--insyt-slate)]">
                      {c.comment}
                    </p>
                    <p className="mt-1 text-xs text-[var(--insyt-muted)]">
                      {[c.author_name, dateLabel].filter(Boolean).join(" · ")}
                    </p>
                  </button>
                );
              })
            )}

            {comments.length > 0 && !approvedAt ? (
              <Button
                type="button"
                variant="outline"
                data-tour-target="approve"
                className={cn("w-full", tourTarget === "approve" && TOUR_TARGET_ACTIVE)}
                onClick={handleApprove}
                disabled={isApproving}
              >
                {isApproving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                Aprovar site
              </Button>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
