"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, Loader2, RefreshCw, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { createUser } from "@/app/actions/users";
import { ROLE_LABELS, type AppUser, type UserRole } from "@/types/users";

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export function UserCreateSheet({
  onCreated,
}: {
  onCreated: (user: AppUser) => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>("member");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function reset() {
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setRole("member");
  }

  function handleGeneratePassword() {
    setPassword(generatePassword());
    setShowPassword(true);
  }

  function handleCopyPassword() {
    if (!password) return;
    navigator.clipboard.writeText(password);
    toast.success("Senha copiada!");
  }

  function handleCreate() {
    if (!email.trim()) {
      toast.error("Informe o e-mail.");
      return;
    }
    if (password.length < 8) {
      toast.error("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    startTransition(async () => {
      const result = await createUser({ email: email.trim(), password, role });
      if (result.error) {
        toast.error(result.error);
        return;
      }

      onCreated({
        id: result.id!,
        email: email.trim(),
        role,
        created_at: new Date().toISOString(),
        last_sign_in_at: null,
      });
      toast.success("Usuário criado! Copie a senha antes de fechar, se ainda não copiou.");
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <SheetTrigger
        render={
          <Button type="button">
            <UserPlus className="size-4" />
            Novo usuário
          </Button>
        }
      />
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Novo usuário</SheetTitle>
          <SheetDescription>
            Não há e-mail de convite configurado — a conta já nasce ativa com a senha
            que você definir aqui. Copie e passe pra pessoa por fora (WhatsApp etc).
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-4">
          <div className="space-y-2">
            <Label htmlFor="user-email">E-mail</Label>
            <Input
              id="user-email"
              type="email"
              placeholder="pessoa@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-password">Senha inicial</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="user-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[var(--insyt-slate)]"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              <Button type="button" variant="outline" size="icon" onClick={handleGeneratePassword} title="Gerar senha">
                <RefreshCw className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopyPassword}
                disabled={!password}
                title="Copiar senha"
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Papel</Label>
            <Select value={role} onValueChange={(v) => setRole((v as UserRole) ?? "member")}>
              <SelectTrigger>
                <SelectValue>{(value: UserRole | null) => ROLE_LABELS[value ?? "member"]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Membro</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <SheetFooter>
          <Button type="button" onClick={handleCreate} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Criar usuário
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
