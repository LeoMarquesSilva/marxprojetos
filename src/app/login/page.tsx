import { signIn } from "@/app/actions/auth";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowRight, ShieldCheck, Sparkles, Zap } from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-[var(--insyt-black)] px-12 py-16 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(247,66,17,0.28),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(191,54,22,0.18),transparent_35%)]" />
        <div className="relative">
          <BrandLogo href="/login" variant="light" showProduct={false} />
        </div>

        <div className="relative max-w-md space-y-8">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[var(--insyt-primary)]">
              <Sparkles className="size-3.5" />
              Briefing Studio
            </p>
            <h1 className="text-5xl font-bold leading-[0.95] tracking-tight">
              Briefings que viram projetos.
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-white/70">
              Envie um link, receba respostas organizadas e acelere a produção
              de sites e landing pages com a identidade INSYT.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                icon: Zap,
                title: "Link único por cliente",
                text: "Sem troca de e-mails — tudo centralizado.",
              },
              {
                icon: ShieldCheck,
                title: "Respostas estruturadas",
                text: "Templates prontos e campos personalizáveis.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--insyt-primary)]/15 text-[var(--insyt-primary)]">
                  <Icon className="size-4" />
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="mt-1 text-sm text-white/60">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-sm text-white/40">
          © INSYT · Gestão de briefings para agências digitais
        </p>
      </section>

      <section className="insyt-grid-bg flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:hidden">
            <BrandLogo href="/login" showProduct={false} className="justify-center" />
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-[var(--insyt-black)]">
              Briefing Studio
            </h1>
          </div>

          <Card className="insyt-glow border-[var(--insyt-border)] shadow-none">
            <CardHeader>
              <CardTitle className="text-2xl">Entrar</CardTitle>
              <CardDescription>
                Acesse seu painel com e-mail e senha
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error ? (
                <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {decodeURIComponent(error)}
                </p>
              ) : null}
              <form action={signIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    className="h-11 border-[var(--insyt-border)] bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="h-11 border-[var(--insyt-border)] bg-white"
                  />
                </div>
                <Button type="submit" className="h-11 w-full text-base">
                  Entrar
                  <ArrowRight className="size-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
