import { differenceInCalendarDays, parseISO } from "date-fns";
import { AlertTriangle, CheckCircle2, Megaphone, PlugZap } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageHeader } from "@/components/admin-page-header";
import { marketingQuickLinks } from "@/components/marketing-ui";
import {
  MarketingAdAccountPicker,
  MarketingDisconnectButton,
  MarketingPagePicker,
} from "@/components/marketing-connection-controls";
import { getMarketingConnection } from "@/app/actions/marketing";
import { formatBrDate } from "@/lib/marketing";
import { requireAuthenticatedUser } from "@/lib/supabase/require-authenticated-user";

const ERRORS: Record<string, string> = {
  config:
    "Faltam as variáveis META_APP_ID e META_APP_SECRET no servidor. Veja o passo a passo em docs/marketing-meta.md.",
  state: "O login expirou ou veio de outra aba. Tente conectar de novo.",
  cancelado: "O login na Meta foi cancelado ou a permissão foi negada.",
  codigo: "A Meta não devolveu o código de autorização. Tente de novo.",
  meta: "A Meta recusou a conexão.",
};

export default async function MarketingConexaoPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string; detalhe?: string }>;
}) {
  const { user } = await requireAuthenticatedUser();
  const params = await searchParams;
  const connection = await getMarketingConnection();

  const expiresAt = connection.tokenExpiresAt ? parseISO(connection.tokenExpiresAt) : null;
  const daysLeft = expiresAt ? differenceInCalendarDays(expiresAt, new Date()) : null;
  const errorMessage = params.erro
    ? [ERRORS[params.erro] ?? "Erro ao conectar.", params.detalhe].filter(Boolean).join(" ")
    : null;

  return (
    <AdminShell userEmail={user.email}>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-fluid">
        <AdminPageHeader
          icon={PlugZap}
          title="Conexão com a Meta"
          description="A conta do Facebook que administra o Instagram e a conta de anúncios da INSYT."
          activeHref="/marketing/conexao"
          quickLinks={marketingQuickLinks}
        />

        {errorMessage ? (
          <div className="insyt-card flex items-start gap-3 border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>{errorMessage}</p>
          </div>
        ) : params.ok ? (
          <div className="insyt-card flex items-start gap-3 border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <p>Conta da Meta conectada. Confira abaixo o Instagram e a conta de anúncios.</p>
          </div>
        ) : null}

        <section className="insyt-card overflow-hidden">
          <header className="flex flex-col gap-4 border-b border-[var(--insyt-border)] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-[var(--insyt-black)]">Conta da Meta</h2>
              <p className="mt-1 text-sm text-[var(--insyt-muted)]">
                {connection.connected
                  ? `Conectada como ${connection.metaUserName ?? "usuário da Meta"}${
                      connection.connectedAt
                        ? ` em ${formatBrDate(connection.connectedAt)}`
                        : ""
                    }.`
                  : "Nenhuma conta conectada."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {connection.configured ? (
                <a
                  href="/api/meta/oauth/start"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1877F2] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  {connection.connected ? "Reconectar" : "Entrar com o Facebook"}
                </a>
              ) : null}
              {connection.connected ? <MarketingDisconnectButton /> : null}
            </div>
          </header>

          {!connection.configured ? (
            <p className="px-6 py-5 text-sm text-[var(--insyt-slate)]">
              Antes de conectar, crie o app na Meta e preencha <code>META_APP_ID</code> e{" "}
              <code>META_APP_SECRET</code> nas variáveis de ambiente. O passo a passo está em{" "}
              <code>docs/marketing-meta.md</code>.
            </p>
          ) : connection.connected && daysLeft !== null ? (
            <p
              className={
                daysLeft <= 10
                  ? "flex items-center gap-2 px-6 py-4 text-sm font-medium text-red-700"
                  : "px-6 py-4 text-sm text-[var(--insyt-muted)]"
              }
            >
              {daysLeft <= 10 ? <AlertTriangle className="size-4" /> : null}
              {daysLeft <= 0
                ? "O acesso expirou. Clique em Reconectar."
                : `O acesso aos anúncios vale por mais ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}. Antes disso, clique em Reconectar.`}
            </p>
          ) : null}
        </section>

        {connection.connected ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="insyt-card space-y-4 p-6">
              <div>
                <h2 className="font-bold text-[var(--insyt-black)]">Instagram</h2>
                <p className="mt-1 text-sm text-[var(--insyt-muted)]">
                  Escolha a Página do Facebook que tem o Instagram da INSYT ligado. Posts e
                  números vêm desse perfil.
                </p>
              </div>
              {connection.availablePages.length === 0 ? (
                <p className="text-sm text-red-700">
                  Nenhuma Página foi liberada no login. Reconecte e marque a Página da INSYT
                  quando a Meta perguntar quais Páginas o app pode acessar.
                </p>
              ) : (
                <MarketingPagePicker
                  pages={connection.availablePages}
                  selectedId={connection.page?.id ?? null}
                />
              )}
              {connection.instagram ? (
                <div className="flex items-center gap-3 rounded-2xl bg-[var(--insyt-canvas)] p-3">
                  {connection.instagram.pictureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL do CDN da Meta expira e muda de host
                    <img
                      src={connection.instagram.pictureUrl}
                      alt=""
                      className="size-10 rounded-full object-cover"
                    />
                  ) : null}
                  <div className="text-sm">
                    <p className="font-semibold text-[var(--insyt-black)]">
                      @{connection.instagram.username}
                    </p>
                    <p className="text-[var(--insyt-muted)]">via {connection.page?.name}</p>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="insyt-card space-y-4 p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-[var(--insyt-black)]">Conta de anúncios</h2>
                  <p className="mt-1 text-sm text-[var(--insyt-muted)]">
                    De onde vêm gasto, campanhas e o custo por lead do painel de tráfego.
                  </p>
                </div>
                <Megaphone className="size-5 text-[var(--insyt-slate)]" />
              </div>
              {connection.availableAdAccounts.length === 0 ? (
                <p className="text-sm text-red-700">
                  Nenhuma conta de anúncios apareceu. Confira se sua conta pessoal tem acesso
                  à conta de anúncios da INSYT no Gerenciador de Negócios e reconecte.
                </p>
              ) : (
                <MarketingAdAccountPicker
                  accounts={connection.availableAdAccounts}
                  selectedId={connection.adAccount?.id ?? null}
                />
              )}
            </section>
          </div>
        ) : null}

        <section className="insyt-card space-y-3 p-6 text-sm text-[var(--insyt-slate)]">
          <h2 className="font-bold text-[var(--insyt-black)]">Leads dos anúncios</h2>
          <p>
            Quem chama no WhatsApp pelo botão de um anúncio entra no CRM sozinho, em
            &quot;Respondeu&quot;, marcado com o anúncio de origem. Não precisa configurar nada:
            o webhook do WhatsApp reconhece a mensagem do anúncio.
          </p>
          <p className="text-[var(--insyt-muted)]">
            Para o painel de tráfego cruzar lead com campanha, a conta de anúncios escolhida
            acima precisa ser a mesma que roda esses anúncios.
          </p>
        </section>
      </div>
    </AdminShell>
  );
}
