"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const HEARTBEAT_MS = 10_000;

/**
 * Registra como a proposta foi lida.
 *
 * Duas decisões que mudam o número que aparece no painel:
 *
 * 1. O tempo só corre com a aba visível. Uma aba esquecida aberta a tarde
 *    inteira contaria horas de "leitura" que nunca aconteceram.
 * 2. A profundidade é o maior scroll já alcançado, não o atual — a pessoa
 *    lê até o fim e volta ao topo para reler o preço, e isso continua
 *    sendo leitura completa.
 *
 * Não roda em nenhum bloqueador de terceiro: o ping vai direto para o
 * Supabase por RPC, então não depende de script externo nem de cookie.
 */
export function ProposalTracker({ token }: { token: string }) {
  const sessionIdRef = useRef<string | null>(null);
  const secondsRef = useRef(0);
  const maxScrollRef = useRef(0);
  const seenSectionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let visibleSince: number | null =
      document.visibilityState === "visible" ? Date.now() : null;

    function accumulate() {
      if (visibleSince === null) return;
      secondsRef.current += Math.round((Date.now() - visibleSince) / 1000);
      visibleSince = Date.now();
    }

    function measureScroll() {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      // Página que cabe inteira na tela já está 100% lida.
      const percent =
        scrollable <= 0
          ? 100
          : Math.round(((window.scrollY + window.innerHeight) / doc.scrollHeight) * 100);
      maxScrollRef.current = Math.min(100, Math.max(maxScrollRef.current, percent));
    }

    // Seções que passaram pela tela: mostra ONDE a atenção parou, não só
    // quanto rolou.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute("data-proposal-section");
          if (entry.isIntersecting && id) seenSectionsRef.current.add(id);
        }
      },
      { threshold: 0.5 },
    );

    document
      .querySelectorAll("[data-proposal-section]")
      .forEach((element) => observer.observe(element));

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        visibleSince = Date.now();
      } else {
        accumulate();
        visibleSince = null;
        void send();
      }
    }

    async function send() {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      accumulate();
      measureScroll();

      await supabase.rpc("track_proposal_session", {
        p_session_id: sessionId,
        p_seconds: secondsRef.current,
        p_scroll_percent: maxScrollRef.current,
        p_sections: [...seenSectionsRef.current],
      });
    }

    async function start() {
      const { data, error } = await supabase.rpc("start_proposal_session", {
        p_token: token,
        p_user_agent: navigator.userAgent,
      });
      if (cancelled || error || !data) return;
      sessionIdRef.current = data as string;
      measureScroll();
      void send();
    }

    void start();

    const interval = setInterval(() => void send(), HEARTBEAT_MS);
    window.addEventListener("scroll", measureScroll, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    // pagehide cobre fechar aba e navegar para fora, inclusive no Safari,
    // onde beforeunload não é confiável.
    window.addEventListener("pagehide", () => void send());

    return () => {
      cancelled = true;
      clearInterval(interval);
      observer.disconnect();
      window.removeEventListener("scroll", measureScroll);
      document.removeEventListener("visibilitychange", handleVisibility);
      void send();
    };
  }, [token]);

  return null;
}
