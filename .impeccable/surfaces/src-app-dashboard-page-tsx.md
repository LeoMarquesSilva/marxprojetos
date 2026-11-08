---
version: 1
slug: "src-app-dashboard-page-tsx"
primary_target: "src/app/dashboard/page.tsx"
related_targets: ["src/app/financas/page.tsx","src/components/admin-shell.tsx"]
---

Scope: todas as telas internas do sistema INSYT (Operate). As páginas públicas ficam de fora.

Audience and job: Leonardo, dono da INSYT, abre o sistema todo dia para saber o que pede atenção e quanto dinheiro entra e sai, e resolve ali mesmo.

Constraints: só dados e ações reais; identidade INSYT; formulários em modal central; localhost usa o banco de produção.

## Direction contract

THESIS: A central de trabalho da INSYT, onde a primeira leitura é o estado real do negócio. Recusa o cabeçalho escuro repetido e os cartões grandes sem dado.

OWN-WORLD: Chão creme quente, superfícies brancas sem borda aparente, menu lateral fixo na superfície escura de gradiente quente da INSYT, um único laranja #f74211 para ação, seleção e dado principal, pêssego #fff1ea em blocos de ícone. Títulos e números grandes em Cabinet Grotesk, interface em Poppins.

STORY: Ele vê em segundos o que está atrasado, o que entra hoje e como estão os projetos; marca status, prazo e baixa na própria linha, sem trocar de tela.

FIRST VIEWPORT: Menu escuro à esquerda; barra superior com busca e sino; saudação com a data e o estado do dia, atrasos primeiro, e Novo briefing à direita; faixa de 4 números com ícone na largura toda; abaixo, status dos projetos e receitas e despesas lado a lado, depois a lista de projetos; coluna direita com Minhas tarefas, Atividades e Comercial.

FORM: Direção fixada pelo usuário com imagem de referência e identidade INSYT, que vence o sorteio; o sorteio rodou depois do build, só para registro, e não mudou a direção; movimento próprio: realizado sólido e previsto claro no mesmo gráfico. seed:89362b04a134b826

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
