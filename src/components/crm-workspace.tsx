"use client";

import { useState } from "react";
import { Columns3, MessageCircle } from "lucide-react";
import { CrmBoard } from "@/components/crm-board";
import { CrmInbox } from "@/components/crm-inbox";
import { cn } from "@/lib/utils";
import type { CrmBoardClient, CrmInboxChat } from "@/types/crm";

type View = "funil" | "conversas";

export function CrmWorkspace({
  clients,
  chats,
  initialView = "funil",
  initialChatJid = null,
}: {
  clients: CrmBoardClient[];
  chats: CrmInboxChat[];
  initialView?: View;
  initialChatJid?: string | null;
}) {
  const [view, setView] = useState<View>(initialView);
  const unreadTotal = chats.reduce(
    (total, chat) => total + (chat.unreadCount > 0 ? 1 : 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-2xl bg-[var(--insyt-canvas)] p-1">
        <button
          type="button"
          onClick={() => setView("funil")}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
            view === "funil"
              ? "bg-white text-[var(--insyt-black)] shadow-sm"
              : "text-[var(--insyt-slate)] hover:text-[var(--insyt-black)]",
          )}
        >
          <Columns3 className="size-4" />
          Funil
        </button>
        <button
          type="button"
          onClick={() => setView("conversas")}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
            view === "conversas"
              ? "bg-white text-[var(--insyt-black)] shadow-sm"
              : "text-[var(--insyt-slate)] hover:text-[var(--insyt-black)]",
          )}
        >
          <MessageCircle className="size-4" />
          Conversas
          {unreadTotal > 0 ? (
            <span className="flex min-w-5 items-center justify-center rounded-full bg-[var(--insyt-primary)] px-1.5 text-xs font-bold text-white">
              {unreadTotal}
            </span>
          ) : null}
        </button>
      </div>

      {view === "funil" ? (
        <CrmBoard initialClients={clients} />
      ) : (
        <CrmInbox
          initialChats={chats}
          initialActiveJid={initialChatJid}
        />
      )}
    </div>
  );
}
