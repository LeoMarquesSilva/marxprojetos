import {
  Bookmark,
  Eye,
  Heart,
  Link2,
  MessageCircle,
  Radio,
  Share2,
  Sparkles,
  UserPlus,
  Users,
  BarChart3,
} from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageHeader } from "@/components/admin-page-header";
import {
  DailyBars,
  MarketingNotice,
  MarketingStat,
  RangeTabs,
  marketingQuickLinks,
} from "@/components/marketing-ui";
import { getInstagramOverview, getMarketingConnection } from "@/app/actions/marketing";
import { PROFILE_RANGES, formatBrDateTime, formatCompact, resolveRange } from "@/lib/marketing";
import { requireAuthenticatedUser } from "@/lib/supabase/require-authenticated-user";

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const { user } = await requireAuthenticatedUser();
  const params = await searchParams;
  const days = resolveRange(params.dias, PROFILE_RANGES, 28);
  const connection = await getMarketingConnection();
  const overview = connection.instagram ? await getInstagramOverview(days) : null;

  return (
    <AdminShell userEmail={user.email}>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-fluid">
        <AdminPageHeader
          icon={BarChart3}
          title="Marketing"
          description="Como o Instagram da INSYT está indo: alcance, engajamento e o desempenho de cada post."
          activeHref="/marketing"
          quickLinks={marketingQuickLinks}
        />

        {!connection.instagram ? (
          <MarketingNotice
            title={connection.connected ? "Falta escolher o Instagram" : "Instagram não conectado"}
            action={{ href: "/marketing/conexao", label: "Abrir conexão" }}
          >
            {connection.connected
              ? "O login com a Meta funcionou, mas falta escolher a Página que tem o Instagram da INSYT ligado."
              : "Conecte a conta da Meta que administra o Instagram e a conta de anúncios da INSYT para ver os números aqui."}
          </MarketingNotice>
        ) : !overview || overview.error !== null ? (
          <MarketingNotice
            title="Não deu para buscar os números"
            action={{ href: "/marketing/conexao", label: "Ver conexão" }}
          >
            {overview?.error ?? "Erro desconhecido."}
          </MarketingNotice>
        ) : (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                {overview.profile.pictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL do CDN da Meta expira e muda de host
                  <img
                    src={overview.profile.pictureUrl}
                    alt=""
                    className="size-14 rounded-full border border-[var(--insyt-border)] object-cover"
                  />
                ) : null}
                <div>
                  <a
                    href={`https://www.instagram.com/${overview.profile.username}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-lg font-bold text-[var(--insyt-black)] hover:underline"
                  >
                    @{overview.profile.username}
                  </a>
                  <p className="text-sm text-[var(--insyt-muted)]">
                    {formatCompact(overview.profile.followers)} seguidores ·{" "}
                    {formatCompact(overview.profile.mediaCount)} posts ·{" "}
                    segue {formatCompact(overview.profile.follows)}
                  </p>
                </div>
              </div>
              <RangeTabs basePath="/marketing" options={PROFILE_RANGES} current={days} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <MarketingStat
                icon={Radio}
                label="Alcance"
                value={formatCompact(overview.totals.reach)}
                hint="contas diferentes que viram algo seu"
                accent
              />
              <MarketingStat
                icon={Eye}
                label="Visualizações"
                value={formatCompact(overview.totals.views)}
                hint="vezes que o conteúdo apareceu"
              />
              <MarketingStat
                icon={Users}
                label="Contas engajadas"
                value={formatCompact(overview.totals.accountsEngaged)}
                hint="curtiram, comentaram, salvaram ou compartilharam"
              />
              <MarketingStat
                icon={Sparkles}
                label="Interações"
                value={formatCompact(overview.totals.interactions)}
                hint="soma de curtidas, comentários, salvos e envios"
              />
              <MarketingStat
                icon={Link2}
                label="Cliques no link da bio"
                value={formatCompact(overview.totals.profileLinkTaps)}
                hint="toques no link, e-mail ou telefone do perfil"
              />
              <MarketingStat
                icon={UserPlus}
                label="Novos seguidores"
                value={
                  overview.totals.follows == null
                    ? "—"
                    : formatCompact(overview.totals.follows)
                }
                hint={
                  overview.totals.unfollows == null
                    ? "a Meta só mostra com 100+ seguidores"
                    : `${formatCompact(overview.totals.unfollows)} deixaram de seguir`
                }
              />
            </div>

            <DailyBars
              title="Alcance por dia"
              subtitle={`últimos ${days} dias`}
              points={overview.dailyReach}
              formatValue={(value) => formatCompact(value)}
            />

            <section className="insyt-card overflow-hidden">
              <header className="border-b border-[var(--insyt-border)] px-6 py-4">
                <h2 className="font-bold text-[var(--insyt-black)]">Últimos posts</h2>
                <p className="mt-1 text-xs text-[var(--insyt-muted)]">
                  números de cada post desde a publicação
                </p>
              </header>
              {overview.media.length === 0 ? (
                <p className="px-6 py-10 text-sm text-[var(--insyt-muted)]">
                  Nenhum post no perfil ainda.
                </p>
              ) : (
                <ul className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
                  {overview.media.map((media) => (
                    <li key={media.id}>
                      <a
                        href={media.permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="group block overflow-hidden rounded-2xl border border-[var(--insyt-border)] transition-shadow hover:shadow-md"
                      >
                        <div className="relative aspect-[4/5] bg-[var(--insyt-canvas)]">
                          {media.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- URL do CDN da Meta expira e muda de host
                            <img
                              src={media.thumbnailUrl}
                              alt=""
                              loading="lazy"
                              className="size-full object-cover"
                            />
                          ) : null}
                          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                            {mediaLabel(media.mediaType, media.productType)}
                          </span>
                        </div>
                        <div className="space-y-2 p-3">
                          <p className="text-[11px] text-[var(--insyt-muted)]">
                            {formatBrDateTime(media.timestamp)}
                          </p>
                          <dl className="grid grid-cols-3 gap-y-1.5 text-xs text-[var(--insyt-slate)]">
                            <Metric icon={Radio} label="Alcance" value={media.reach} />
                            <Metric icon={Heart} label="Curtidas" value={media.likes} />
                            <Metric icon={MessageCircle} label="Comentários" value={media.comments} />
                            <Metric icon={Eye} label="Visualizações" value={media.views} />
                            <Metric icon={Bookmark} label="Salvos" value={media.saved} />
                            <Metric icon={Share2} label="Envios" value={media.shares} />
                          </dl>
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </AdminShell>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | null;
}) {
  return (
    <div className="flex items-center gap-1" title={label}>
      <dt className="sr-only">{label}</dt>
      <Icon className="size-3.5 shrink-0 text-[var(--insyt-muted)]" />
      <dd className="font-semibold tabular-nums text-[var(--insyt-black)]">
        {formatCompact(value)}
      </dd>
    </div>
  );
}

function mediaLabel(mediaType: string, productType: string | null) {
  if (productType === "REELS") return "Reels";
  if (mediaType === "CAROUSEL_ALBUM") return "Carrossel";
  if (mediaType === "VIDEO") return "Vídeo";
  return "Foto";
}
