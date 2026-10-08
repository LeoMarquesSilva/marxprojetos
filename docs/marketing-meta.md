# Marketing: conexão com a Meta

A área **Marketing** (`/marketing`) junta quatro abas:

| Aba | O que faz | De onde vem |
| --- | --- | --- |
| Instagram | Alcance, visualizações, engajamento, cliques no link e os números dos últimos posts | Instagram Graph API |
| Posts | Monta, publica na hora ou agenda foto, carrossel (só fotos) e reels | Instagram Content Publishing API + bucket `marketing-media` |
| Tráfego pago | Gasto, conversas, custo por conversa, leads e fechamentos do CRM por campanha. Também pausa e reativa campanhas | Marketing API + `crm_clients.ad_id` |
| Conexão | Login com o Facebook e escolha do Instagram e da conta de anúncios | OAuth da Meta |

Os leads dos anúncios de **Click-to-WhatsApp** entram no CRM sozinhos. Quando alguém
toca no botão do anúncio, a primeira mensagem chega na Evolution com o
`externalAdReply` do anúncio. O webhook (`/api/whatsapp-webhook`) então:

- cria o cliente em **Respondeu**, com origem `Anúncio · <título>` (se o número
  ainda não existe no CRM);
- grava `ad_id`, `ad_title`, `ad_ctwa_clid` e `ad_first_seen_at` no cliente.
  Vale o primeiro toque: um anúncio clicado depois não sobrescreve o primeiro;
- marca a conversa da inbox com origem `anuncio`.

O painel de tráfego liga `ad_id` → campanha pela Marketing API e mostra o
custo real por lead e por cliente fechado.

## 1. Pré-requisitos na Meta

1. **O Instagram da INSYT precisa estar ligado a uma Página do Facebook.** A API
   oficial só enxerga um Instagram profissional através de uma Página. Para conferir
   pelo app do Instagram: *Editar perfil → Página*. Se não tiver Página, crie uma
   para a INSYT e faça a ligação por lá (ou pelo Meta Business Suite).
2. A sua conta pessoal do Facebook precisa ser admin da Página e ter acesso à
   **conta de anúncios** que roda os anúncios (Gerenciador de Negócios → Contas
   de anúncios → Pessoas).

## 2. Criar o app

1. Acesse <https://developers.facebook.com/apps> e clique em **Criar app**.
   Escolha o caso de uso "Outro" e depois o tipo **Empresa** (Business). Ligue o
   app ao portfólio empresarial da INSYT.
2. No painel do app, adicione os produtos:
   - **Login do Facebook para Empresas** (ou "Login do Facebook");
   - **API do Instagram**, na opção *com Login do Facebook*;
   - **API de Marketing**.
3. Em *Login do Facebook → Configurações*, preencha **URIs de redirecionamento
   do OAuth válidos** com:
   - `https://www.insytstudio.com.br/api/meta/oauth/callback`
   - `http://localhost:3000/api/meta/oauth/callback` (para testar local)
4. Em *Configurações do app → Avançado*, ligue **Exigir chave secreta do app**.
   O sistema manda `appsecret_proof` em toda chamada.
5. Se o produto for o **Login do Facebook para Empresas**, crie uma
   *Configuração* com as permissões abaixo e copie o ID dela para
   `META_LOGIN_CONFIG_ID`. Com o Login do Facebook comum, o sistema já pede as
   permissões sozinho:

   `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`,
   `pages_show_list`, `pages_read_engagement`, `business_management`,
   `ads_read`, `ads_management`

**Revisão do app:** não precisa. Em modo de desenvolvimento, o app acessa os
dados das contas que têm papel nele. Você é o admin, e a Página, o Instagram e a
conta de anúncios são seus. A revisão só seria necessária para conectar contas de
terceiros, como as de clientes.

## 3. Variáveis de ambiente (Vercel e `.env`)

| Variável | Valor |
| --- | --- |
| `META_APP_ID` | ID do app (painel → Configurações → Básico) |
| `META_APP_SECRET` | Chave secreta do app (mesmo lugar) |
| `META_LOGIN_CONFIG_ID` | Opcional: ID da configuração do Login para Empresas |
| `META_GRAPH_VERSION` | Opcional; o padrão é `v23.0` |
| `CRON_SECRET` | Uma string aleatória longa (ex.: `openssl rand -hex 32`) |

## 4. Banco

Aplique a migration `supabase/migrations/20261009120000_marketing.sql`. Ela cria:

- a tabela `marketing_connection`, com os tokens. O RLS fica ligado e não há
  nenhuma policy, então só o service-role lê essa tabela;
- a tabela `marketing_posts`;
- o bucket público `marketing-media`. Ele precisa ser público porque a Meta baixa
  a mídia pela URL. O limite é de 100 MB por arquivo, mas o limite global do
  projeto pode ser menor;
- as colunas `ad_*` em `crm_clients` e a origem `anuncio` em `crm_whatsapp_chats`.

## 5. Conectar

Abra **Marketing → Conexão → Entrar com o Facebook**. Na tela da Meta, marque a
Página da INSYT e a conta de anúncios. Se só houver uma opção de cada, o sistema
escolhe sozinho. Se houver mais, use os seletores da tela.

O token dos anúncios vale cerca de 60 dias. A tela de conexão avisa quando faltar
pouco; é só clicar em **Reconectar**. O token da Página, usado para os posts e os
números do Instagram, não expira.

## 6. Publicação dos agendados (cron)

O endpoint `GET /api/cron/marketing` publica os posts que venceram e termina os
vídeos que ainda estão processando. A autorização é feita pelo header
`Authorization: Bearer <CRON_SECRET>`. Abrir a aba **Posts** também empurra a fila.

Escolha **uma** destas opções:

- **Vercel Cron**, no plano Pro: crie um `vercel.json` com
  `{"crons":[{"path":"/api/cron/marketing","schedule":"*/5 * * * *"}]}`.
  O plano Hobby só permite cron diário, e isso não serve para agendamento.
- **pg_cron do Supabase**, que funciona em qualquer plano. No SQL Editor, com as
  extensões `pg_cron` e `pg_net` ligadas:

  ```sql
  select cron.schedule(
    'marketing-publicar-agendados',
    '*/5 * * * *',
    $$
    select net.http_get(
      url := 'https://www.insytstudio.com.br/api/cron/marketing',
      headers := jsonb_build_object('Authorization', 'Bearer COLE_O_CRON_SECRET_AQUI')
    );
    $$
  );
  ```

## Limites conhecidos

- Carrossel só com fotos nesta versão. Stories não são publicados pela API.
- A imagem é convertida para JPEG de até 1440 px no navegador. O formato precisa
  estar entre 4:5 (em pé) e 1,91:1 (deitado).
- O limite da Meta é de 50 posts publicados pela API a cada 24 h.
- Insights de seguidores (novos e perdidos) só aparecem para contas com 100 ou
  mais seguidores.
- A marcação do anúncio depende do WhatsApp mandar o `externalAdReply` na
  primeira mensagem. Ele manda quando o lead toca no botão do anúncio. Se a
  pessoa salvar o número e chamar depois, a mensagem chega como contato comum.
