"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updateProposal } from "@/app/actions/proposals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Proposal, ProposalBlock } from "@/types/proposal";

const BLOCK_LABELS: Record<ProposalBlock["type"], string> = {
  texto: "Texto",
  lista: "Lista",
  definicoes: "Itens com descrição",
  etapas: "Etapas",
  investimento: "Investimento",
  plano: "Plano mensal",
  pilares: "Pilares",
};

// Uma linha por item mantém o editor simples: sem editor rico, sem
// arrastar-e-soltar dentro do bloco. O que importa é gerar a página
// bonita, não reinventar um editor de texto.
const toLines = (values: string[]) => values.join("\n");
const fromLines = (value: string) =>
  value.split("\n").map((line) => line.trim()).filter(Boolean);

function newBlock(type: ProposalBlock["type"]): ProposalBlock {
  const id = crypto.randomUUID().slice(0, 8);
  switch (type) {
    case "texto":
      return { type, id, title: "", paragraphs: [""] };
    case "lista":
      return { type, id, title: "", intro: "", items: [] };
    case "definicoes":
      return { type, id, title: "", intro: "", items: [] };
    case "etapas":
      return { type, id, title: "", steps: [] };
    case "investimento":
      return {
        type,
        id,
        title: "Investimento",
        label: "",
        amount: "",
        installments: [],
      };
    case "plano":
      return {
        type,
        id,
        title: "",
        intro: "",
        price: "",
        period: "/mês",
        items: [],
        note: "",
      };
    case "pilares":
      return { type, id, title: "", intro: "", pillars: [], closing: "" };
  }
}

export function ProposalContentEditor({ proposal }: { proposal: Proposal }) {
  const router = useRouter();
  const [title, setTitle] = useState(proposal.title);
  const [subtitle, setSubtitle] = useState(proposal.subtitle ?? "");
  const [clientName, setClientName] = useState(proposal.client_name);
  const [validUntil, setValidUntil] = useState(proposal.valid_until ?? "");
  const [blocks, setBlocks] = useState<ProposalBlock[]>(proposal.content);
  const [isPending, startTransition] = useTransition();

  function patch(index: number, changes: Partial<ProposalBlock>) {
    setBlocks((prev) =>
      prev.map((block, i) =>
        i === index ? ({ ...block, ...changes } as ProposalBlock) : block,
      ),
    );
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    setBlocks((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const result = await updateProposal(proposal.id, {
        title,
        subtitle,
        clientName,
        content: blocks,
        validUntil: validUntil || null,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Proposta salva.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card className="insyt-card border-none shadow-none">
        <CardHeader>
          <CardTitle>Abertura</CardTitle>
          <CardDescription>O que aparece no topo da proposta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-client">Cliente</Label>
            <Input
              id="edit-client"
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-title">Título</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-subtitle">Subtítulo</Label>
            <Textarea
              id="edit-subtitle"
              rows={2}
              value={subtitle}
              onChange={(event) => setSubtitle(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-valid">Válida até</Label>
            <Input
              id="edit-valid"
              type="date"
              className="w-auto"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {blocks.map((block, index) => (
        <Card key={block.id} className="insyt-card border-none shadow-none">
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-base">
                {String(index + 1).padStart(2, "0")} · {BLOCK_LABELS[block.type]}
              </CardTitle>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                aria-label="Mover para cima"
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={index === blocks.length - 1}
                onClick={() => move(index, 1)}
                aria-label="Mover para baixo"
              >
                <ArrowDown className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() =>
                  setBlocks((prev) => prev.filter((_, i) => i !== index))
                }
                aria-label="Remover bloco"
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Título da seção</Label>
              <Input
                value={block.title ?? ""}
                onChange={(event) => patch(index, { title: event.target.value })}
              />
            </div>

            {block.type === "texto" ? (
              <Field
                label="Parágrafos (um por linha)"
                rows={6}
                value={toLines(block.paragraphs)}
                onChange={(value) => patch(index, { paragraphs: fromLines(value) })}
              />
            ) : null}

            {block.type === "lista" ? (
              <>
                <Field
                  label="Introdução"
                  rows={3}
                  value={block.intro ?? ""}
                  onChange={(value) => patch(index, { intro: value })}
                />
                <Field
                  label="Itens (um por linha)"
                  rows={7}
                  value={toLines(block.items)}
                  onChange={(value) => patch(index, { items: fromLines(value) })}
                />
              </>
            ) : null}

            {block.type === "definicoes" ? (
              <>
                <Field
                  label="Introdução"
                  rows={2}
                  value={block.intro ?? ""}
                  onChange={(value) => patch(index, { intro: value })}
                />
                <Field
                  label="Itens — um por linha, no formato: Nome | descrição"
                  rows={7}
                  value={block.items
                    .map((item) => `${item.term} | ${item.description}`)
                    .join("\n")}
                  onChange={(value) =>
                    patch(index, {
                      items: fromLines(value).map((line) => {
                        const [term, ...rest] = line.split("|");
                        return {
                          term: term.trim(),
                          description: rest.join("|").trim(),
                        };
                      }),
                    })
                  }
                />
              </>
            ) : null}

            {block.type === "etapas" ? (
              <Field
                label="Etapas — uma por linha, no formato: Nome | descrição"
                rows={7}
                value={block.steps
                  .map((step) => `${step.title} | ${step.description}`)
                  .join("\n")}
                onChange={(value) =>
                  patch(index, {
                    steps: fromLines(value).map((line) => {
                      const [stepTitle, ...rest] = line.split("|");
                      return {
                        title: stepTitle.trim(),
                        description: rest.join("|").trim(),
                      };
                    }),
                  })
                }
              />
            ) : null}

            {block.type === "investimento" ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>O que é</Label>
                    <Input
                      value={block.label}
                      onChange={(event) => patch(index, { label: event.target.value })}
                      placeholder="Desenvolvimento do Site Institucional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor</Label>
                    <Input
                      value={block.amount}
                      onChange={(event) => patch(index, { amount: event.target.value })}
                      placeholder="R$ 1.297,00"
                    />
                  </div>
                </div>
                <Field
                  label="Parcelas — uma por linha, no formato: Descrição | valor"
                  rows={3}
                  value={block.installments
                    .map((item) => `${item.label} | ${item.amount}`)
                    .join("\n")}
                  onChange={(value) =>
                    patch(index, {
                      installments: fromLines(value).map((line) => {
                        const [label, ...rest] = line.split("|");
                        return { label: label.trim(), amount: rest.join("|").trim() };
                      }),
                    })
                  }
                />
              </>
            ) : null}

            {block.type === "plano" ? (
              <>
                <Field
                  label="Introdução"
                  rows={2}
                  value={block.intro ?? ""}
                  onChange={(value) => patch(index, { intro: value })}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Preço</Label>
                    <Input
                      value={block.price}
                      onChange={(event) => patch(index, { price: event.target.value })}
                      placeholder="R$ 147,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Período</Label>
                    <Input
                      value={block.period}
                      onChange={(event) => patch(index, { period: event.target.value })}
                      placeholder="/mês"
                    />
                  </div>
                </div>
                <Field
                  label="Itens inclusos (um por linha)"
                  rows={7}
                  value={toLines(block.items)}
                  onChange={(value) => patch(index, { items: fromLines(value) })}
                />
                <Field
                  label="Observação"
                  rows={2}
                  value={block.note ?? ""}
                  onChange={(value) => patch(index, { note: value })}
                />
              </>
            ) : null}

            {block.type === "pilares" ? (
              <>
                <Field
                  label="Introdução"
                  rows={3}
                  value={block.intro ?? ""}
                  onChange={(value) => patch(index, { intro: value })}
                />
                <Field
                  label="Pilares (um por linha)"
                  rows={5}
                  value={toLines(block.pillars)}
                  onChange={(value) => patch(index, { pillars: fromLines(value) })}
                />
                <Field
                  label="Fechamento"
                  rows={3}
                  value={block.closing ?? ""}
                  onChange={(value) => patch(index, { closing: value })}
                />
              </>
            ) : null}
          </CardContent>
        </Card>
      ))}

      <Card className="insyt-card border-none shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Adicionar seção</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(BLOCK_LABELS) as ProposalBlock["type"][]).map((type) => (
              <Button
                key={type}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setBlocks((prev) => [...prev, newBlock(type)])}
              >
                <Plus className="size-3.5" />
                {BLOCK_LABELS[type]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button type="button" size="lg" onClick={save} disabled={isPending}>
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Salvar proposta
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  rows,
  onChange,
}: {
  label: string;
  value: string;
  rows: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
