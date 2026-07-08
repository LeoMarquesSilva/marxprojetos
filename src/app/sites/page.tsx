import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpRight, CheckCircle2, Globe } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { AdminPageHeader } from "@/components/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSitesOverview } from "@/app/actions/review";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function SitesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sites = await getSitesOverview();

  return (
    <AdminShell userEmail={user?.email}>
      <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-fluid">
        <AdminPageHeader
          icon={Globe}
          title="Sites em revisão"
          description="Vincule um site já construído a um briefing e acompanhe os comentários do cliente."
          activeHref="/sites"
        />

        <div className="insyt-card overflow-hidden">
          <div className="border-b border-[var(--insyt-border)] px-8 py-6">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--insyt-black)]">
              Briefings
            </h2>
            <p className="mt-1 text-sm text-[var(--insyt-slate)]">
              Clique em um briefing para vincular ou gerenciar a revisão do site.
            </p>
          </div>
          <div className="bg-white p-0">
            {sites.length === 0 ? (
              <div className="px-6 py-24 text-center">
                <p className="text-lg text-[var(--insyt-slate)]">
                  Nenhum briefing criado ainda.
                </p>
                <Link
                  href="/projects/new"
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "mt-6 rounded-full px-6",
                  )}
                >
                  Criar primeiro briefing
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-[var(--insyt-border)] hover:bg-transparent">
                    <TableHead className="pl-8">Briefing</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status do site</TableHead>
                    <TableHead>Comentários abertos</TableHead>
                    <TableHead>Disponível desde</TableHead>
                    <TableHead className="w-10 pr-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sites.map((site) => (
                    <TableRow
                      key={site.id}
                      className="group border-[var(--insyt-border)] transition-colors hover:bg-[var(--insyt-canvas-alt)]/50"
                    >
                      <TableCell className="py-5 pl-8">
                        <Link
                          href={`/sites/${site.id}`}
                          className="font-semibold text-[var(--insyt-black)] transition-colors group-hover:text-[var(--insyt-primary)]"
                        >
                          {site.title}
                        </Link>
                      </TableCell>
                      <TableCell className="py-5 text-[var(--insyt-slate)]">
                        {site.client_name || "—"}
                      </TableCell>
                      <TableCell className="py-5">
                        <SiteStatusBadge
                          enabled={site.review_enabled}
                          approvedAt={site.review_approved_at}
                        />
                      </TableCell>
                      <TableCell className="py-5">
                        {site.review_enabled ? (
                          <Badge
                            variant={site.openComments > 0 ? "default" : "secondary"}
                          >
                            {site.openComments}
                          </Badge>
                        ) : (
                          <span className="text-[var(--insyt-muted)]">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-5 text-[var(--insyt-muted)]">
                        {site.review_enabled_at
                          ? format(new Date(site.review_enabled_at), "d MMM yyyy", {
                              locale: ptBR,
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="py-5 pr-8">
                        <Link
                          href={`/sites/${site.id}`}
                          className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--insyt-canvas)] text-[var(--insyt-muted)] transition-all duration-300 ease-fluid group-hover:scale-110 group-hover:bg-[var(--insyt-primary)] group-hover:text-white"
                        >
                          <ArrowUpRight className="size-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function SiteStatusBadge({
  enabled,
  approvedAt,
}: {
  enabled: boolean;
  approvedAt: string | null;
}) {
  if (!enabled) {
    return <Badge variant="secondary">Não vinculado</Badge>;
  }
  if (approvedAt) {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        <CheckCircle2 className="size-3" />
        Aprovado
      </Badge>
    );
  }
  return (
    <Badge className="bg-[#fff4f0] text-[var(--insyt-primary-dark)] hover:bg-[#fff4f0]">
      Ativo
    </Badge>
  );
}
