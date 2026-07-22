"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { updateCrmClient } from "@/app/actions/crm";
import type { CrmClient } from "@/types/crm";

export function CrmEditClientSheet({ client }: { client: CrmClient }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(client.name);
  const [company, setCompany] = useState(client.company ?? "");
  const [email, setEmail] = useState(client.email ?? "");
  const [phone, setPhone] = useState(client.phone ?? "");
  const [source, setSource] = useState(client.source ?? "");
  const [value, setValue] = useState(client.value?.toString() ?? "");
  const [lostReason, setLostReason] = useState(client.lost_reason ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit() {
    if (!name.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }

    startTransition(async () => {
      const result = await updateCrmClient(client.id, {
        name: name.trim(),
        company: company.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        source: source.trim() || null,
        value: value ? Number(value) : null,
        lost_reason: lostReason.trim() || null,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Cliente atualizado!");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <Pencil className="size-4" />
            Editar
          </Button>
        }
      />
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Editar cliente</SheetTitle>
          <SheetDescription>Atualize os dados de {client.name}.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-8 overflow-y-auto px-4 pb-4">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--insyt-muted)]">
              Sobre o cliente
            </p>
            <div className="space-y-2">
              <Label htmlFor="crm-edit-name">Nome *</Label>
              <Input id="crm-edit-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="crm-edit-company">Empresa</Label>
                <Input
                  id="crm-edit-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crm-edit-email">E-mail</Label>
                <Input
                  id="crm-edit-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="crm-edit-phone">Telefone</Label>
              <Input
                id="crm-edit-phone"
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
                <Label htmlFor="crm-edit-source">Origem</Label>
                <Input
                  id="crm-edit-source"
                  placeholder="WhatsApp, indicação..."
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crm-edit-value">Valor estimado (R$)</Label>
                <Input
                  id="crm-edit-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
            </div>
          </div>

          {client.stage === "perdido" ? (
            <div className="space-y-4 border-t border-[var(--insyt-border)] pt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--insyt-muted)]">
                Perda
              </p>
              <div className="space-y-2">
                <Label htmlFor="crm-edit-lost-reason">Motivo da perda</Label>
                <Textarea
                  id="crm-edit-lost-reason"
                  placeholder="Ex: preço, prazo, escolheu outro escritório..."
                  rows={3}
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                />
              </div>
            </div>
          ) : null}
        </div>

        <SheetFooter>
          <Button type="button" onClick={handleSubmit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Salvar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
