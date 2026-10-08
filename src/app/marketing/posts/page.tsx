import { after } from "next/server";
import { AlertTriangle, ExternalLink, Film, Images, Send } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageHeader } from "@/components/admin-page-header";
import { MarketingPostActions } from "@/components/marketing-post-actions";
import { MarketingPostComposer } from "@/components/marketing-post-composer";
import { MarketingNotice, marketingQuickLinks } from "@/components/marketing-ui";
import { getMarketingConnection, getMarketingPosts } from "@/app/actions/marketing";
import { formatBrDateTime, isPostDue } from "@/lib/marketing";
import { processDuePosts } from "@/lib/meta/publisher";
import { requireAuthenticatedUser } from "@/lib/supabase/require-authenticated-user";
import { cn } from "@/lib/utils";
import {
  POST_KIND_LABELS,
  POST_STATUS_LABELS,
  type MarketingPost,
  type MarketingPostStatus,
} from "@/types/marketing";

const STATUS_STYLE: Record<MarketingPostStatus, string> = {
  rascunho: "bg-[var(--insyt-canvas-alt)] text-[var(--insyt-slate)]",
  agendado: "bg-[var(--accent)] text-[var(--insyt-primary-dark)]",
  publicando: "bg-amber-50 text-amber-800",
  publicado: "bg-emerald-50 text-emerald-800",
  erro: "bg-red-50 text-red-800",
};

export default async function MarketingPostsPage() {
  const { user } = await requireAuthenticatedUser();
  const [connection, posts] = await Promise.all([getMarketingConnection(), getMarketingPosts()]);

  // Abrir a tela também empurra o que venceu: se o cron atrasar, quem olha
  // a fila não fica vendo "agendado" num horário que já passou.
  if (connection.instagram && posts.some((post) => isPostDue(post))) {
    after(() => processDuePosts().catch(() => undefined));
  }

  const queue = posts.filter((post) => post.status === "agendado" || post.status === "publicando");
  const drafts = posts.filter((post) => post.status === "rascunho" || post.status === "erro");
  const published = posts
    .filter((post) => post.status === "publicado")
    .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));

  return (
    <AdminShell userEmail={user.email}>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-fluid">
        <AdminPageHeader
          icon={Send}
          title="Posts"
          description="Monte, agende e publique no Instagram da INSYT sem sair do sistema."
          activeHref="/marketing/posts"
          quickLinks={marketingQuickLinks}
          actions={<MarketingPostComposer />}
        />

        {!connection.instagram ? (
          <MarketingNotice
            title="Instagram não conectado"
            action={{ href: "/marketing/conexao", label: "Abrir conexão" }}
          >
            Dá para montar rascunhos agora, mas publicar e agendar só depois de conectar o
            Instagram da INSYT.
          </MarketingNotice>
        ) : null}

        <PostSection
          title="Fila de publicação"
          subtitle="agendados por ordem de horário"
          empty="Nada agendado. Use Novo post para publicar agora ou marcar um horário."
          posts={queue}
        />
        <PostSection
          title="Rascunhos e erros"
          subtitle="ainda não foram para o Instagram"
          empty="Nenhum rascunho."
          posts={drafts}
        />
        <PostSection
          title="Publicados pelo sistema"
          subtitle="os números de cada post ficam na aba Instagram"
          empty="Nenhum post publicado por aqui ainda."
          posts={published}
        />
      </div>
    </AdminShell>
  );
}

function PostSection({
  title,
  subtitle,
  empty,
  posts,
}: {
  title: string;
  subtitle: string;
  empty: string;
  posts: MarketingPost[];
}) {
  return (
    <section className="insyt-card overflow-hidden">
      <header className="border-b border-[var(--insyt-border)] px-6 py-4">
        <h2 className="font-bold text-[var(--insyt-black)]">{title}</h2>
        <p className="mt-1 text-xs text-[var(--insyt-muted)]">
          {subtitle} · {posts.length} {posts.length === 1 ? "post" : "posts"}
        </p>
      </header>
      {posts.length === 0 ? (
        <p className="px-6 py-8 text-sm text-[var(--insyt-muted)]">{empty}</p>
      ) : (
        <ul className="divide-y divide-[var(--insyt-border)]">
          {posts.map((post) => (
            <PostRow key={post.id} post={post} />
          ))}
        </ul>
      )}
    </section>
  );
}

function PostRow({ post }: { post: MarketingPost }) {
  const cover = post.media[0];
  const KindIcon = post.kind === "reels" ? Film : Images;
  const when =
    post.status === "publicado" && post.published_at
      ? `publicado ${formatBrDateTime(post.published_at)}`
      : post.status === "agendado" && post.scheduled_at
        ? `para ${formatBrDateTime(post.scheduled_at)}`
        : `criado ${formatBrDateTime(post.created_at)}`;

  return (
    <li className="flex items-start gap-4 px-6 py-4">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-[var(--insyt-canvas)]">
        {cover?.type === "video" ? (
          <video src={cover.url} className="size-full object-cover" muted playsInline preload="metadata" />
        ) : cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- mídia pública do bucket do post
          <img src={cover.url} alt="" loading="lazy" className="size-full object-cover" />
        ) : null}
        {post.media.length > 1 ? (
          <span className="absolute bottom-1 right-1 rounded-full bg-black/60 px-1.5 text-[10px] font-semibold text-white">
            {post.media.length}
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
              STATUS_STYLE[post.status],
            )}
          >
            {POST_STATUS_LABELS[post.status]}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-[var(--insyt-muted)]">
            <KindIcon className="size-3.5" />
            {POST_KIND_LABELS[post.kind]} · {when}
          </span>
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm text-[var(--insyt-slate)]">
          {post.caption || <span className="italic text-[var(--insyt-muted)]">Sem legenda</span>}
        </p>
        {post.status === "erro" && post.error ? (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-red-700">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {post.error}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {post.permalink ? (
          <a
            href={post.permalink}
            target="_blank"
            rel="noreferrer"
            title="Ver no Instagram"
            className="inline-flex size-7 items-center justify-center rounded-lg text-[var(--insyt-slate)] hover:bg-[var(--insyt-canvas)]"
          >
            <ExternalLink className="size-3.5" />
          </a>
        ) : null}
        {post.status === "rascunho" || post.status === "agendado" || post.status === "erro" ? (
          <MarketingPostComposer post={post} />
        ) : null}
        <MarketingPostActions post={post} />
      </div>
    </li>
  );
}
