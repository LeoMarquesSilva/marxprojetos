"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { SearchResult } from "@/lib/shell-types";
import { cn } from "@/lib/utils";

/** Busca do topo: abre pelo campo ou por Ctrl+K e leva direto ao resultado. */
export function AdminSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    // Cancelar a busca anterior impede uma resposta velha de pisar na mais recente.
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setIsPending(true);
      fetch(`/api/shell/search?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : []))
        .catch(() => [])
        .then((next: SearchResult[]) => {
          if (controller.signal.aborted) return;
          setResults(next);
          setSearched(term);
          setHighlight(0);
          setIsPending(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const hasTerm = query.trim().length >= 2;
  const visible = hasTerm ? results : [];

  function go(result: SearchResult) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(result.href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((value) => Math.min(value + 1, visible.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((value) => Math.max(value - 1, 0));
    } else if (event.key === "Enter" && visible[highlight]) {
      event.preventDefault();
      go(visible[highlight]);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-full max-w-md items-center gap-2.5 rounded-xl border border-[var(--insyt-border)] bg-white px-3 text-left text-sm text-[var(--insyt-muted)] transition-colors duration-150 hover:border-[var(--input)]"
      >
        <Search className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">Buscar projeto, cliente ou proposta…</span>
        <kbd className="hidden shrink-0 rounded-md bg-[var(--insyt-canvas-alt)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--insyt-slate)] sm:block">
          Ctrl K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-[12%] flex max-h-[70dvh] translate-y-0 flex-col gap-0 overflow-hidden rounded-2xl bg-white p-0 sm:max-w-xl"
        >
          <DialogTitle className="sr-only">Buscar</DialogTitle>
          <div className="flex items-center gap-3 border-b border-[var(--insyt-border)] px-4">
            {isPending ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-[var(--insyt-muted)]" />
            ) : (
              <Search className="size-4 shrink-0 text-[var(--insyt-muted)]" />
            )}
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Buscar projeto, cliente ou proposta…"
              aria-label="Buscar"
              className="h-13 min-w-0 flex-1 bg-transparent py-4 text-sm text-[var(--insyt-black)] outline-none placeholder:text-[var(--insyt-muted)]"
            />
          </div>

          {!hasTerm ? (
            <p className="px-4 py-6 text-sm text-[var(--insyt-muted)]">
              Digite pelo menos 2 letras.
            </p>
          ) : visible.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[var(--insyt-muted)]">
              {isPending || searched !== query.trim()
                ? "Buscando…"
                : `Nada encontrado para “${query.trim()}”.`}
            </p>
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto py-1">
              {visible.map((result, index) => (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => go(result)}
                    onMouseEnter={() => setHighlight(index)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100",
                      index === highlight && "bg-[var(--insyt-tint)]",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--insyt-black)]">
                        {result.title}
                      </span>
                      {result.detail ? (
                        <span className="block truncate text-xs text-[var(--insyt-muted)]">
                          {result.detail}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-xs font-medium text-[var(--insyt-slate)]">
                      {result.kind}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
