# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Leonardo Marques, dono da INSYT, usa o sistema sozinho, todo dia, principalmente no computador. Já conhece todas as telas: quer densidade e resposta rápida, não explicação na tela.

## Product Purpose

Sistema interno para tocar a INSYT de ponta a ponta: prospecção, propostas, briefings, sites em revisão, clientes (CRM e WhatsApp), marketing, portfólio e dinheiro (mensalidades, parcelas, gastos fixos, projeção de caixa). Sucesso é abrir o sistema e saber em segundos o que pede atenção hoje e quanto dinheiro entra e sai.

## Positioning

Junta num lugar só o que normalmente fica em planilha, CRM e banco, com a regra de cobrança e os acordos reais de cada cliente, inclusive sociedades e implantações parceladas.

## Operating Context

- O dev server (`localhost:3000`) usa o banco de produção: botão que grava, grava de verdade.
- Valores em reais, datas no fuso de Brasília, textos em português do Brasil.
- Formulários abrem em modal central, não em painel lateral.
- As páginas públicas (site institucional, portfólio, proposta, briefing e revisão do cliente) têm linguagem própria e não seguem o visual interno.

## Capabilities and Constraints

- Next.js com App Router, Supabase, Tailwind e componentes sobre Base UI. Sem biblioteca de gráficos.
- Não existe tabela de tarefas: os "próximos passos" do CRM fazem esse papel.
- Sem dado inventado: número, status e botão só entram na tela quando têm origem real.

## Brand Commitments

- Identidade INSYT: laranja `#f74211` e `#bf3616`, logo em `public/brand/`, títulos em Cabinet Grotesk, texto em Poppins, superfície escura com gradiente quente.
- Referência visual aprovada pelo Leonardo em 08/11/2026: painel com fundo claro quente, menu lateral escuro fixo, faixa de números com ícone, gráficos, tabela e coluna de tarefas, sempre com a identidade INSYT.

## Evidence on Hand

Dados reais de clientes, projetos e financeiro no próprio banco. Os números do mock de referência são ilustrativos e não devem ser copiados.

## Product Principles

1. O que pede atenção vem antes de tudo: atraso, vencimento, resposta nova.
2. Realizado e previsto nunca se confundem: o que já entrou é sólido, o que vai entrar é claro.
3. Dá para resolver onde se vê: baixa, status e prazo na própria linha, sem trocar de tela.
4. Nada de enfeite: se não tem dado real ou ação real, não aparece.
