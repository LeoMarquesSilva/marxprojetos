"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import { getCrmWhatsappThread } from "@/app/actions/crm-whatsapp";
import { CrmWhatsappThread } from "@/components/crm-whatsapp-thread";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CrmBoardClient, CrmWhatsappMessage } from "@/types/crm";

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0]?.slice(0, 2);
  return (initials ?? "").toUpperCase();
}

// Conversa aberta a partir do kanban. A thread é carregada sob demanda: o
// board mostra só a prévia da última mensagem, então trazer o histórico de
// todos os clientes no carregamento da página seria desperdício.
export function CrmWhatsappSheet({
  client,
  onOpenChange,
}: {
  client: CrmBoardClient | null;
  onOpenChange: (open: boolean) => void;
}) {
  // O resultado guarda de qual cliente ele é. Assim "carregando" é derivado
  // (resultado ainda não corresponde ao cliente aberto) em vez de precisar
  // de um setState síncrono dentro do efeito, que dispara render em cascata.
  const [loaded, setLoaded] = useState<{
    clientId: string;
    remoteJid: string | null;
    messages: CrmWhatsappMessage[];
  } | null>(null);

  const clientId = client?.id ?? null;
  const isLoading = clientId !== null && loaded?.clientId !== clientId;

  useEffect(() => {
    if (!clientId) return;

    let cancelled = false;

    getCrmWhatsappThread(clientId)
      .then((thread) => {
        if (cancelled) return;
        setLoaded({
          clientId,
          remoteJid: thread.remoteJid,
          messages: thread.messages,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded({ clientId, remoteJid: null, messages: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <Sheet open={client !== null} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        {client ? (
          <>
            <SheetHeader className="border-b border-[var(--insyt-border)] px-6 py-6">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--insyt-canvas-alt)] text-sm font-bold text-[var(--insyt-primary)]">
                  {initialsOf(client.name)}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <SheetTitle className="truncate text-2xl font-bold">
                    {client.name}
                  </SheetTitle>
                  <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate">
                      {client.company ?? client.phone ?? "Conversa de WhatsApp"}
                    </span>
                    <Link
                      href={`/crm/${client.id}`}
                      className="inline-flex items-center gap-1 text-[var(--insyt-primary)] hover:underline"
                    >
                      Abrir ficha
                      <ExternalLink className="size-3" />
                    </Link>
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="flex min-h-0 flex-1 flex-col">
              {isLoading || !loaded ? (
                <div className="flex flex-1 items-center justify-center gap-2 py-16 text-sm text-[var(--insyt-muted)]">
                  <Loader2 className="size-4 animate-spin" />
                  Carregando conversa...
                </div>
              ) : (
                <CrmWhatsappThread
                  key={client.id}
                  clientId={client.id}
                  remoteJid={loaded.remoteJid}
                  initialMessages={loaded.messages}
                  layout="sheet"
                />
              )}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
