---
name: INSYT, sistema interno
description: Central de trabalho da INSYT, com o estado real do negócio em primeiro lugar.
colors:
  primary: "#f74211"
  primary-dark: "#bf3616"
  ink: "#1d1512"
  slate: "#5c514a"
  muted: "#766a62"
  canvas: "#faf6f1"
  canvas-alt: "#f3ece4"
  surface: "#ffffff"
  border: "#ece4db"
  input: "#e2d8cd"
  tint: "#fff1ea"
  tint-strong: "#ffe3d6"
  dark-surface-start: "#1c1412"
  dark-surface-end: "#2a1418"
  chart-income: "#f74211"
  chart-income-expected: "#fdc7b3"
  chart-expense: "#b09a88"
  chart-expense-expected: "#dccdbf"
  status-progress: "#f74211"
  status-review: "#f59e0b"
  status-done: "#17876b"
  status-paused: "#6a63b8"
  status-none: "#e3d9cf"
typography:
  page-title:
    fontFamily: "Cabinet Grotesk, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.29
    letterSpacing: "-0.03em"
  section-title:
    fontFamily: "Cabinet Grotesk, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    letterSpacing: "-0.03em"
  figure:
    fontFamily: "Cabinet Grotesk, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 700
    lineHeight: 1.23
  body:
    fontFamily: "Poppins, sans-serif"
    fontSize: "14px"
    fontWeight: 400
  label:
    fontFamily: "Poppins, sans-serif"
    fontSize: "12px"
    fontWeight: 600
  table:
    fontFamily: "Poppins, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  caption:
    fontFamily: "Poppins, sans-serif"
    fontSize: "11px"
    fontWeight: 500
  figure-compact:
    fontFamily: "Cabinet Grotesk, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
rounded:
  control: "14px"
  card: "18px"
  modal: "22px"
  pill: "9999px"
spacing:
  gutter: "32px"
  section: "24px"
  card-gap: "20px"
  card-padding: "20px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
  nav-item-active:
    backgroundColor: "{colors.primary-dark}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-padding}"
  icon-tile:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.primary-dark}"
    rounded: "{rounded.control}"
    size: "44px"
---

# Design System: INSYT, sistema interno

Vale para as telas internas. Site institucional, portfólio, proposta, briefing e revisão do cliente têm linguagem própria e seguem com os valores de `:root`.

## Overview

Tela de trabalho de uma pessoa só, usada todo dia no computador. O chão creme quente descansa a vista, o menu escuro fixo dá o peso da marca e o laranja INSYT aparece só onde há ação, seleção ou o dado principal. A assinatura do sistema é separar realizado de previsto: nos gráficos de dinheiro, o que já aconteceu é sólido e o que vai acontecer é claro, sempre.

## Colors

Tudo em tokens `--insyt-*`, sobrescritos em `html:has([data-admin-shell])` em `src/app/globals.css`. Ficam no `<html>` porque modais e menus são renderizados fora do shell.

- **Laranja INSYT (`primary`):** botão principal, aba ativa, dado principal do gráfico. Branco sobre o laranja dá 3,66:1: é exceção de marca, restrita a botão com texto em peso 500. Texto em laranja e item ativo do menu usam `primary-dark` (5,6:1).
- **Neutros quentes (`ink`, `slate`, `muted`, `canvas`, `border`):** puxam para o marrom, nunca para o azul. `muted` passa 4,5:1 sobre branco.
- **Pêssego (`tint`):** bloco de ícone, linha selecionada, primeiro número em destaque.
- **Placeholder (`--insyt-placeholder`):** igual a `muted` nas telas internas, para exemplo não parecer valor preenchido. As páginas públicas mantêm o tom próprio.
- **Filtro selecionado:** `primary-dark` com texto branco, igual ao item ativo do menu. Tinta escura fica para a barra de ações em lote e os passos numerados.
- **Estados:** vermelho só para atraso e vencido, sempre com texto junto.
- **Status de projeto:** paleta validada com `validate_palette.js` da skill dataviz, para daltonismo. "Sem status" é o neutro, fora da sequência. Âmbar fica abaixo de 3:1 sobre branco, então nunca aparece sem rótulo.

## Typography

- **Cabinet Grotesk:** títulos e números grandes.
- **Poppins:** todo o resto. É larga: em tabela, use 13 ou 14 px e trunque o nome em vez de quebrar a linha.
- Rótulos em caixa normal, peso 600. Sem caixa alta com espaçamento e sem texto pequeno acima do título.
- `tabular-nums` em colunas de valores e eixos. Número grande fica com algarismos proporcionais.

## Layout

- Menu lateral fixo de 232 px a partir de `lg`, que o botão da barra superior recolhe para 72 px só com ícones; a escolha fica guardada no navegador. Abaixo de `lg`, menu em gaveta aberto pelo botão da barra superior.
- Barra superior fixa com busca (`Ctrl K`) e alertas.
- Conteúdo com até 1320 px; quadros largos (`wide`), até 1760 px.
- Início: faixa de 4 números na largura toda a partir de `xl`; abaixo, coluna principal e coluna direita de 330 px. No celular, a tabela vira blocos com o nome inteiro.
- Tabelas se adaptam ao cartão com container query: abaixo de 896 px de cartão, a coluna Cliente vira a segunda linha do Projeto.

## Elevation & Depth

Cartão branco com sombra curta e quente, sem borda: `0 1px 2px rgb(60 35 20 / .05), 0 10px 28px -18px rgb(60 35 20 / .18)`. A hierarquia vem do contraste entre chão creme e superfície branca.

## Shapes

`--radius` de 0,625rem nas telas internas: controles com 14 px, cartões com 18 px, modais com 22 px. Pílula só em botão, status e rótulo pequeno.

## Components

- **Cabeçalho (`AdminPageHeader`):** título sobre o fundo claro, ações à direita, abas com sublinhado laranja. Só a aba de caminho mais específico fica ativa.
- **Número com ícone (`KpiCard`):** o mais importante em destaque. O cartão inteiro é link quando há para onde ir.
- **Faixa de números (`FinanceKpiGrid`):** vários números em uma linha só, sem um cartão para cada.
- **Colunas de dinheiro (`MoneyColumns`):** barras de até 16 px, grade em linha fina, valores no hover e no foco do teclado, cada mês é link.
- **Rosca de status (`StatusDonut`):** folga de 3 px entre fatias, sem borda; lista ao lado com nome, quantidade e %.
- **Status e prazo (`ProjectWorkControls`):** editados na própria linha com controles nativos.
- **Busca e alertas:** leitura em rotas `/api/shell/*`. Server action fica só para gravação, porque entra em fila única e pode ser descartada numa navegação.
- **Baixa (`ChargeSettle`, `BillSettle`, `InstallmentSettle`):** um clique sem confirmação, com Desfazer no aviso.
- **Formulários:** sempre em modal central. Confirmação de exclusão em `AlertDialog`.

## Do's and Don'ts

- **Faça:** só mostre número e botão com dado ou ação real por trás.
- **Faça:** coloque o que pede atenção antes de tudo: atraso, vencimento, resposta nova.
- **Faça:** transições de 150 ms, só em cor e estado.
- **Não faça:** animação de entrada de página nem cabeçalho escuro em cada tela.
- **Não faça:** laranja em estado inativo ou enfeite, nem gradiente em texto.
- **Não faça:** somar parcela com prazo às mensalidades em "Entra por mês": elas acabam.
- **Não faça:** usar a cor da série no texto do gráfico; quem identifica é a marca ao lado.
