# Projetos externos no portfólio

## Objetivo

Adicionar ao portfólio público da INSYT três projetos externos:

1. Bismarchi | Pires — https://www.bismarchipires.com.br/
2. Beatriz Bertho Advocacia — https://beatrizberthoadv.com.br/
3. Confiara — https://www.confiara.com.br/

Os projetos devem aparecer como trabalhos individuais resumidos abaixo do case
Pereira Garcia, preservando o case existente e o restante da página.

## Decisão de arquitetura

Os três projetos serão mantidos em um catálogo editorial versionado no código.
Esse catálogo é independente da tabela operacional de projetos no Supabase.

Essa separação evita:

- criar projetos fictícios no CRM;
- acoplar a publicação do portfólio ao fluxo interno de briefings;
- ampliar a RPC pública e a interface administrativa para uma necessidade
  pontual.

O catálogo deve fornecer, para cada entrada:

- identificador estável;
- título;
- nome do cliente;
- descrição editorial curta;
- URL pública externa;
- caminho da capa local;
- texto alternativo da imagem.

## Apresentação

Os projetos externos usarão o componente editorial de projeto resumido já
existente na página. Eles serão exibidos após o case Pereira Garcia e na ordem
enviada pelo usuário:

1. Bismarchi | Pires;
2. Beatriz Bertho Advocacia;
3. Confiara.

Cada entrada terá:

- uma capa baseada no hero real do site;
- identificação do cliente;
- título do projeto;
- descrição de uma ou duas frases;
- link “Visitar projeto” abrindo o domínio externo em nova aba.

O card inteiro continuará acessível por teclado e o link externo usará
`rel="noopener noreferrer"`.

## Conteúdo editorial

As descrições serão escritas a partir do conteúdo público de cada site e devem
destacar o papel da presença digital sem atribuir resultados, métricas ou
serviços que não estejam comprovados.

- Bismarchi | Pires: site institucional para advocacia empresarial, com
  posicionamento em gestão de crises, áreas de atuação, equipe e
  reconhecimentos.
- Beatriz Bertho Advocacia: landing page de advocacia preventiva em Direito
  Médico, estruturada para explicar riscos, serviços, método e contato.
- Confiara: descrição baseada no posicionamento e na proposta de valor
  apresentados no site público, após inspeção do conteúdo e do hero.

## Capas

O pipeline de captura existente será ampliado para aceitar URLs externas além
dos sites armazenados em `public/sites`.

As capturas:

- usarão viewport de 1440 × 960;
- aguardarão o carregamento das fontes e da mídia do hero;
- registrarão o topo da página e o hero;
- serão salvas em WebP em `public/portfolio/covers`;
- terão nomes estáveis derivados do identificador editorial.

Se uma URL externa não puder ser capturada, o card continuará funcional com o
fallback visual já existente. Uma falha em um site não deve impedir a captura
dos demais.

## Dados e integração

O agrupamento atual continuará recebendo os projetos publicados pelo Supabase.
O catálogo externo será combinado apenas na camada de apresentação:

1. os itens do Supabase continuam alimentando o case Pereira Garcia e projetos
   internos não agrupados;
2. os projetos externos são adicionados depois desses dados;
3. os IDs externos são isolados dos UUIDs do banco;
4. nenhuma tabela, política RLS ou RPC será alterada.

## Testes

Os testes automatizados devem verificar:

- presença das três entradas;
- ordem Bismarchi | Pires, Beatriz Bertho e Confiara;
- URLs externas exatas;
- descrições não vazias;
- caminhos locais das capas;
- preservação do case Pereira Garcia;
- renderização dos links externos no componente de projeto resumido.

A validação final deve incluir:

- teste automatizado do portfólio;
- ESLint nos arquivos alterados;
- build de produção;
- carregamento da página em desktop e mobile;
- ausência de overflow, overlay e erros no console;
- carregamento das três capas;
- resposta válida dos três links públicos.

## Fora de escopo

- transformar os três projetos em mini cases completos;
- criar ou alterar registros no Supabase;
- adicionar edição desses projetos ao painel administrativo;
- publicar ou implantar a aplicação;
- modificar o conteúdo dos sites externos.
