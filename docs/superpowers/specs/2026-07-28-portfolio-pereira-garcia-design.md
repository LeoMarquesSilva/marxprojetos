# Case editorial Pereira Garcia no portfólio

## Contexto

A página pública de portfólio exibe dois projetos publicados para o mesmo
cliente:

- Site Institucional — Pereira Garcia Advocacia
- Landing Page Holding — Pereira Garcia Advocacia

Hoje os projetos aparecem como itens independentes, sem imagem de capa e sem
descrição. Como os dois trabalhos fazem parte da mesma presença digital, a
apresentação será consolidada em um único case editorial com dois capítulos.

## Objetivos

- Mostrar os heros reais dos sites em vez de capas genéricas.
- Apresentar os dois projetos como partes de uma parceria digital única.
- Explicar objetivo, solução e entregas de cada projeto com conteúdo factual.
- Manter o portfólio responsivo, acessível e rápido.
- Preservar o fluxo atual de publicação e substituição manual de capa.
- Permitir que projetos futuros sem conteúdo editorial continuem aparecendo.

## Fora de escopo

- Criar uma rota dedicada para o case.
- Adicionar métricas ou resultados não documentados.
- Transformar o gerenciador de portfólio em um CMS completo.
- Alterar o schema, as políticas ou as funções do Supabase.
- Modificar o conteúdo dos sites Pereira Garcia.

## Direção visual

A identidade atual do portfólio será preservada: fundo marfim, tipografia de
alto contraste, preto quente e laranja INSYT. A seção de projetos deixará de
ser uma lista de cartões repetidos e passará a ter composição editorial
assimétrica.

O case começa com:

- identificação do cliente;
- resumo da parceria;
- escopo: estratégia, conteúdo, UX/UI e desenvolvimento;
- número de projetos publicados no case.

Em seguida, dois capítulos apresentam os trabalhos:

1. Site institucional, com screenshot amplo do hero e conteúdo ao lado.
2. Landing page de Holding, com composição invertida para criar ritmo.

Cada screenshot aparece em uma moldura discreta de navegador. No desktop, a
imagem e a narrativa ocupam colunas assimétricas; no mobile, a sequência se
torna vertical, mantendo imagem antes do conteúdo.

## Conteúdo aprovado

### Introdução do case

> Uma presença digital construída para traduzir mais de quatro décadas de
> experiência jurídica em autoridade, clareza e novos pontos de contato.

### Site institucional

**Objetivo:** consolidar a autoridade do escritório e organizar sua atuação
para empresas familiares.

**Solução:** uma experiência sóbria e editorial, com navegação clara,
história, equipe, áreas jurídicas e contato.

**Entregas:** estratégia de conteúdo, UX/UI, desenvolvimento responsivo, SEO
local e páginas institucionais.

### Landing page de Holding

**Objetivo:** transformar um serviço jurídico complexo em uma proposta fácil
de entender e agir.

**Solução:** página focada em conversão, estruturada por benefícios, tipos de
holding, método, dúvidas frequentes e formulário de qualificação.

**Entregas:** arquitetura de conversão, copy, UX/UI, formulário de leads,
integração com WhatsApp e SEO técnico.

## Arquitetura de conteúdo

Um módulo local tipado conterá os metadados editoriais dos cases. Cada
capítulo será associado ao `site_path` retornado pela RPC pública do
portfólio.

O fluxo será:

1. `getPublicPortfolio()` consulta os projetos publicados.
2. A página associa os itens publicados aos capítulos configurados.
3. Capítulos do mesmo case são agrupados e renderizados em uma seção
   editorial.
4. Itens publicados sem configuração editorial usam o layout simples já
   existente.

A publicação e o link de cada projeto continuam controlados pelo Supabase.
Nenhuma informação privada do briefing será adicionada à página.

## Captura das capas

Um script de desenvolvimento capturará o primeiro viewport de cada site
estático em uma resolução desktop consistente. O processo:

1. serve temporariamente o diretório `public`;
2. abre `/sites/<site_path>/index.html` em um navegador automatizado;
3. aguarda o carregamento de fontes e imagens;
4. captura o hero em proporção horizontal;
5. salva uma imagem WebP otimizada em
   `public/portfolio/covers/<site_path>.webp`;
6. encerra o servidor temporário mesmo em caso de erro.

O script terá um comando npm próprio para permitir regeneração após uma nova
sincronização dos sites.

A ordem de escolha da capa será:

1. `portfolio_cover_url`, quando preenchida manualmente;
2. screenshot local gerado para o `site_path`;
3. fallback visual da identidade INSYT.

As capturas serão arquivos estáticos versionados; nenhum navegador será
executado durante requisições de produção.

## Estados e comportamento

- Case sem os dois capítulos: renderiza apenas os capítulos publicados.
- Projeto sem configuração editorial: usa o item simples atual.
- Capa manual inválida: o componente de imagem revela o fallback local.
- Screenshot local ausente: usa o fallback visual.
- Link indisponível: mostra “Case reservado” sem CTA morto.
- Lista vazia: mantém o estado vazio atual.

## Acessibilidade e desempenho

- Toda capa terá texto alternativo descritivo.
- Links de projeto terão rótulos específicos.
- Estados de foco serão visíveis.
- Animações respeitarão `prefers-reduced-motion`.
- Imagens usarão dimensões conhecidas para evitar mudança de layout.
- A primeira imagem relevante poderá ter carregamento prioritário; as demais
  usarão carregamento tardio.
- O contraste seguirá a paleta atual e não dependerá apenas de cor.

## Validação

- Teste do agrupamento de projetos publicados por case.
- Teste do fallback para projeto sem configuração editorial.
- Execução do script de captura e validação dos arquivos gerados.
- ESLint nos arquivos alterados.
- TypeScript e build de produção.
- Inspeção visual da página em desktop e mobile.
- Verificação dos links para os dois sites.

## Critérios de aceitação

- A seção de projetos mostra um único case Pereira Garcia.
- O case contém dois capítulos quando os dois projetos estão publicados.
- Cada capítulo mostra o hero real do respectivo site.
- O conteúdo aprovado aparece sem métricas inventadas.
- Cada projeto disponível abre seu site correto.
- A capa manual continua substituindo a captura automática.
- Projetos futuros sem configuração continuam visíveis no formato simples.
- A página não exige mudança de schema no Supabase.
- Lint, TypeScript e build terminam sem erros.
