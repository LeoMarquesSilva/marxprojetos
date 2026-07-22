"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { createCrmClient } from "@/app/actions/crm";
import type { CrmStage } from "@/types/crm";

export function CrmNewClientSheet({ defaultStage }: { defaultStage?: CrmStage }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("");
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function reset() {
    setName("");
    setCompany("");
    setEmail("");
    setPhone("");
    setSource("");
    setValue("");
  }

  function handleSubmit() {
    if (!name.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }

    startTransition(async () => {
      const result = await createCrmClient({
        name: name.trim(),
        company: company.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        source: source.trim() || undefined,
        stage: defaultStage,
        value: value ? Number(value) : undefined,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Cliente adicionado!");
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button type="button">
            <Plus className="size-4" />
            Novo cliente
          </Button>
        }
      />
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Novo cliente</SheetTitle>
          <SheetDescription>
            Cadastre um lead ou cliente, mesmo antes de enviar um briefing.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-8 overflow-y-auto px-4 pb-4">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--insyt-muted)]">
              Sobre o cliente
            </p>
            <div className="space-y-2">
              <Label htmlFor="crm-name">Nome *</Label>
              <Input id="crm-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="crm-company">Empresa</Label>
                <Input
                  id="crm-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crm-email">E-mail</Label>
                <Input
                  id="crm-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="crm-phone">Telefone</Label>
              <Input
                id="crm-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4 border-t border-[var(--insyt-border)] pt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--insyt-muted)]">
              Negócio
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="crm-source">Origem</Label>
                <Input
                  id="crm-source"
                  placeholder="WhatsApp, indicação..."
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crm-value">Valor estimado (R$)</Label>
                <Input
                  id="crm-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button type="button" onClick={handleSubmit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Adicionar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
