import Link from "next/link";
import {
  BadgeDollarSign,
  CircleDollarSign,
  ExternalLink,
  Handshake,
  Megaphone,
  MessageCircle,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageHeader } from "@/components/admin-page-header";
import { MarketingCampaignToggle } from "@/components/marketing-campaign-toggle";
import {
  DailyBars,
  MarketingNotice,
  MarketingStat,
  RangeTabs,
  marketingQuickLinks,
} from "@/components/marketing-ui";
import { getAdsOverview, getMarketingConnection } from "@/app/actions/marketing";
import {
  ADS_RANGES,
  divide,
  formatBrDateTime,
  formatCompact,
  formatMoney,
  formatPercent,
  resolveRange,
} from "@/lib/marketing";
import { requireAuthenticatedUser } from "@/lib/supabase/require-authenticated-user";
import { cn } from "@/lib/utils";
import { STAGE_ACCENT, STAGE_LABELS, type CrmStage } from "@/types/crm";

const EFFECTIVE_STATUS: Record<string, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  CAMPAIGN_PAUSED: "Pausada",
  ADSET_PAUSED: "Conjunto pausado",
  ARCHIVED: "Arquivada",
  DELETED: "Excluída",
  IN_PROCESS: "Processando",
  WITH_ISSUES: "Com problema",
  PENDING_REVIEW: "Em análise",
  DISAPPROVED: "Reprovada",
};

export default async function MarketingTrafegoPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const { user } = await requireAuthenticatedUser();
  const params = await searchParams;
  const days = resolveRange(params.dias, ADS_RANGES, 30);
  const connection = await getMarketingConnection();
  const overview = connection.adAccount ? await getAdsOverview(days) : null;

  return (
    <AdminShell userEmail={user.email} wide>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-fluid">
        <AdminPageHeader
          icon={Megaphone}
          title="Tráfego pago"
          description="Quanto saiu em anúncio, quantas conversas virou e quantas viraram cliente no CRM."
          activeHref="/marketing/trafego"
          quickLinks={marketingQuickLinks}
          actions={
            connection.adAccount ? (
              <a
                href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${connection.adAccount.id.replace(/^act_/, "")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/15"
              >
                <ExternalLink className="size-4" />
                Gerenciador de Anúncios
              </a>
            ) : null
          }
        />

        {!connection.adAccount ? (
          <MarketingNotice
            title={connection.connected ? "Falta escolher a conta de anúncios" : "Meta não conectada"}
            action={{ href: "/marketing/conexao", label: "Abrir conexão" }}
          >
            {connection.connected
              ? "Escolha qual conta de anúncios o painel acompanha."
              : "Conecte a conta da Meta que tem acesso à conta de anúncios da INSYT."}
          </MarketingNotice>
        ) : !overview || overview.error !== null ? (
          <MarketingNotice
            title="Não deu para buscar os anúncios"
            action={{ href: "/marketing/conexao", label: "Ver conexão" }}
          >
            {overview?.error ?? "Erro desconhecido."}
          </MarketingNotice>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[var(--insyt-muted)]">
                {connection.adAccount.name} · últimos {days} dias
              </p>
              <RangeTabs basePath="/marketing/trafego" options={ADS_RANGES} current={days} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MarketingStat
                icon={CircleDollarSign}
                label="Investido"
                value={formatMoney(overview.summary.spend, overview.currency)}
                hint={`${formatCompact(overview.summary.impressions)} impressões · CTR ${formatPercent(overview.summary.ctr)}`}
                accent
              />
              <MarketingStat
                icon={MessageCircle}
                label="Conversas iniciadas"
                value={formatCompact(overview.summary.conversations)}
                hint={`${formatMoney(overview.summary.costPerConversation, overview.currency)} por conversa (dado da Meta)`}
              />
              <MarketingStat
                icon={UserPlus}
                label="Leads no CRM"
                value={formatCompact(overview.summary.crmLeads)}
                hint={`${formatMoney(overview.summary.costPerCrmLead, overview.currency)} por lead real`}
              />
              <MarketingStat
                icon={Handshake}
                label="Fechados"
                value={formatCompact(overview.summary.crmClosed)}
                hint={
                  overview.summary.crmClosed > 0
                    ? `${formatMoney(overview.summary.crmRevenue)} em contratos · ${formatMoney(overview.summary.costPerClose, overview.currency)} por cliente`
                    : "nenhum lead de anúncio fechou no período"
                }
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <DailyBars
                title="Gasto por dia"
                points={overview.dailySpend}
                formatValue={(value) => formatMoney(value, overview.currency)}
              />
              <DailyBars
                title="Conversas iniciadas por dia"
                points={overview.dailyConversations}
                formatValue={(value) => formatCompact(value)}
              />
            </div>

            <section className="insyt-card overflow-hidden">
              <header className="flex items-baseline justify-between gap-3 border-b border-[var(--insyt-border)] px-6 py-4">
                <div>
                  <h2 className="font-bold text-[var(--insyt-black)]">Campanhas</h2>
                  <p className="mt-1 text-xs text-[var(--insyt-muted)]">
                    com gasto no período ou ativas agora · a chave pausa ou reativa na Meta
                  </p>
                </div>
                {overview.summary.roas != null && overview.summary.crmRevenue > 0 ? (
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--insyt-black)]">
                    <TrendingUp className="size-4 text-emerald-600" />
                    retorno {overview.summary.roas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}×
                  </p>
                ) : null}
              </header>
              {overview.rows.length === 0 ? (
                <p className="px-6 py-10 text-sm text-[var(--insyt-muted)]">
                  Nenhuma campanha com gasto nos últimos {days} dias.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] text-sm">
                    <thead>
                      <tr className="border-b border-[var(--insyt-border)] text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--insyt-muted)]">
                        <th className="px-6 py-3">Campanha</th>
                        <th className="px-3 py-3 text-right">Investido</th>
                        <th className="px-3 py-3 text-right">Alcance</th>
                        <th className="px-3 py-3 text-right">CTR</th>
                        <th className="px-3 py-3 text-right">Conversas</th>
                        <th className="px-3 py-3 text-right">Custo/conversa</th>
                        <th className="px-3 py-3 text-right">Leads CRM</th>
                        <th className="px-3 py-3 text-right">Fechados</th>
                        <th className="px-6 py-3 text-right">Ativa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--insyt-border)]">
                      {overview.rows.map((row) => {
                        const canToggle = row.status === "ACTIVE" || row.status === "PAUSED";
                        return (
                          <tr key={row.id} className="hover:bg-[var(--insyt-canvas)]/60">
                            <td className="px-6 py-3">
                              <p className="font-semibold text-[var(--insyt-black)]">{row.name}</p>
                              <p className="text-xs text-[var(--insyt-muted)]">
                                {EFFECTIVE_STATUS[row.effectiveStatus] ?? row.effectiveStatus}
                                {row.dailyBudget != null
                                  ? ` · ${formatMoney(row.dailyBudget, overview.currency)}/dia`
                                  : ""}
                              </p>
                            </td>
                            <td className="px-3 py-3 text-right font-semibold tabular-nums text-[var(--insyt-black)]">
                              {formatMoney(row.spend, overview.currency)}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {formatCompact(row.reach)}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {formatPercent(row.ctr)}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {formatCompact(row.conversations)}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {formatMoney(
                                divide(row.spend, row.conversations),
                                overview.currency,
                              )}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {row.crmLeads > 0 ? (
                                <span title={`${formatMoney(divide(row.spend, row.crmLeads), overview.currency)} por lead`}>
                                  {row.crmLeads}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {row.crmClosed > 0 ? (
                                <span className="font-semibold text-emerald-700">
                                  {row.crmClosed} · {formatMoney(row.crmRevenue)}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-6 py-3 text-right">
                              {canToggle ? (
                                <MarketingCampaignToggle
                                  campaignId={row.id}
                                  name={row.name}
                                  active={row.status === "ACTIVE"}
                                />
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="insyt-card overflow-hidden">
              <header className="flex items-baseline justify-between gap-3 border-b border-[var(--insyt-border)] px-6 py-4">
                <div>
                  <h2 className="font-bold text-[var(--insyt-black)]">Últimos leads de anúncio</h2>
                  <p className="mt-1 text-xs text-[var(--insyt-muted)]">
                    chamaram no WhatsApp pelo botão do anúncio
                  </p>
                </div>
                <Link
                  href="/crm"
                  className="text-sm font-semibold text-[var(--insyt-primary)] hover:underline"
                >
                  Abrir CRM
                </Link>
              </header>
              {overview.recentLeads.length === 0 ? (
                <p className="flex items-start gap-2 px-6 py-8 text-sm text-[var(--insyt-muted)]">
                  <BadgeDollarSign className="mt-0.5 size-4 shrink-0" />
                  Nenhum lead de anúncio no período. Eles aparecem aqui assim que alguém chamar
                  pelo botão de um anúncio de WhatsApp.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--insyt-border)]">
                  {overview.recentLeads.map((lead) => {
                    const stage = lead.stage as CrmStage;
                    return (
                      <li key={lead.id} className="flex items-center justify-between gap-4 px-6 py-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[var(--insyt-black)]">
                            {lead.name}
                          </p>
                          <p className="truncate text-xs text-[var(--insyt-muted)]">
                            {lead.adTitle ?? "Anúncio"} ·{" "}
                            {formatBrDateTime(lead.createdAt)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                            STAGE_ACCENT[stage]?.pillBg,
                            STAGE_ACCENT[stage]?.pillText,
                          )}
                        >
                          <span className={cn("size-1.5 rounded-full", STAGE_ACCENT[stage]?.dot)} />
                          {STAGE_LABELS[stage] ?? lead.stage}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </AdminShell>
  );
}
