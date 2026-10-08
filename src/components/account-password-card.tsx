"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { changeMyPassword } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AccountPasswordCard({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [isPending, startTransition] = useTransition();

  const mismatch = confirm.length > 0 && next !== confirm;
  const tooShort = next.length > 0 && next.length < 8;

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (next !== confirm) {
      toast.error("A confirmação não bate com a nova senha.");
      return;
    }

    startTransition(async () => {
      const result = await changeMyPassword({ currentPassword: current, newPassword: next });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Senha alterada.");
      setCurrent("");
      setNext("");
      setConfirm("");
    });
  }

  const type = visible ? "text" : "password";

  return (
    <section className="insyt-card overflow-hidden">
      <header className="flex items-start justify-between gap-3 border-b border-[var(--insyt-border)] px-6 py-4">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-[var(--insyt-black)]">
            <KeyRound className="size-4 text-[var(--insyt-primary)]" />
            Minha senha
          </h2>
          <p className="mt-1 text-xs text-[var(--insyt-muted)]">{email}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title={visible ? "Esconder senhas" : "Mostrar senhas"}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </header>

      <form onSubmit={save} className="grid gap-4 px-6 py-5 md:grid-cols-3">
        {/* Ajuda o gerenciador de senhas a saber de qual conta é a senha. */}
        <input type="email" value={email} autoComplete="username" readOnly hidden />
        <div className="space-y-2">
          <Label htmlFor="password-current">Senha atual</Label>
          <Input
            id="password-current"
            type={type}
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password-new">Nova senha</Label>
          <Input
            id="password-new"
            type={type}
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            aria-invalid={tooShort || undefined}
          />
          <p className={tooShort ? "text-xs text-red-700" : "text-xs text-[var(--insyt-muted)]"}>
            Pelo menos 8 caracteres.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password-confirm">Repita a nova senha</Label>
          <Input
            id="password-confirm"
            type={type}
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            aria-invalid={mismatch || undefined}
          />
          {mismatch ? <p className="text-xs text-red-700">As senhas não batem.</p> : null}
        </div>
        <div className="md:col-span-3 md:flex md:justify-end">
          <Button
            type="submit"
            className="w-full md:w-auto"
            disabled={isPending || !current || !next || mismatch || tooShort}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Trocar senha
          </Button>
        </div>
      </form>
    </section>
  );
}
