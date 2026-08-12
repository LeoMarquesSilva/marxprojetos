"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Columns3, MessageCircle } from "lucide-react";
import { CrmBoard } from "@/components/crm-board";
import { CrmInbox } from "@/components/crm-inbox";
import { cn } from "@/lib/utils";
import type { CrmBoardClient, CrmInboxChat } from "@/types/crm";

type View = "funil" | "conversas";

export function CrmWorkspace({
  clients,
  chats,
  unreadTotal,
  initialView = "funil",
  initialChatJid = null,
  initialInboxFilter,
}: {
  clients: CrmBoardClient[];
  chats: CrmInboxChat[];
  unreadTotal: number;
  initialView?: View;
  initialChatJid?: string | null;
  initialInboxFilter?: "unread";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view: View =
    searchParams.get("view") === "conversas"
      ? "conversas"
      : searchParams.has("view")
        ? "funil"
        : initialView;
  function selectView(nextView: View) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", nextView);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-2xl bg-[var(--insyt-canvas)] p-1">
        <button
          type="button"
          onClick={() => selectView("funil")}
          aria-pressed={view === "funil"}
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
          onClick={() => selectView("conversas")}
          aria-pressed={view === "conversas"}
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
          initialFilter={initialInboxFilter}
        />
      )}
    </div>
  );
}
