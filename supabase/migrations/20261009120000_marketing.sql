-- Área de marketing: conexão com a Meta (Instagram da INSYT, Página e
-- conta de anúncios), posts publicados/agendados pelo sistema e a origem
-- dos leads que chegam pelo WhatsApp de um anúncio (Click-to-WhatsApp).

-- Conexão com a Meta. Uma linha só para o workspace, como finance_settings.
-- Guarda tokens: RLS ligado e SEM policy para authenticated — só o
-- service-role (servidor) lê ou grava. A tela recebe apenas o que não é
-- segredo, montado no servidor.
create table if not exists public.marketing_connection (
  id boolean primary key default true check (id),
  meta_user_id text,
  meta_user_name text,
  user_access_token text,
  token_expires_at timestamptz,
  -- Páginas (com o Instagram ligado) e contas de anúncio que o login
  -- liberou, para escolher na tela de conexão sem refazer o login.
  available_pages jsonb not null default '[]'::jsonb,
  available_ad_accounts jsonb not null default '[]'::jsonb,
  page_id text,
  page_name text,
  page_access_token text,
  ig_user_id text,
  ig_username text,
  ig_profile_picture_url text,
  ad_account_id text,
  ad_account_name text,
  ad_account_currency text,
  -- Quem conectou: dono dos leads de anúncio criados pelo webhook.
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.marketing_connection enable row level security;

-- Posts montados no sistema. O feed que já está no Instagram vem direto da
-- API; aqui ficam só os que nasceram aqui (rascunho, agendado, publicado).
create table if not exists public.marketing_posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('imagem', 'carrossel', 'reels')),
  caption text not null default '' check (char_length(caption) <= 2200),
  -- [{ "path": "...", "url": "https://...", "type": "image" | "video" }]
  media jsonb not null default '[]'::jsonb,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'agendado', 'publicando', 'publicado', 'erro')),
  scheduled_at timestamptz,
  -- Container de mídia criado na Meta (vídeo processa antes de publicar).
  container_id text,
  ig_media_id text,
  permalink text,
  published_at timestamptz,
  error text,
  attempts integer not null default 0,
  -- Trava curta enquanto um processo publica: o cron e o botão "publicar"
  -- não podem chamar media_publish duas vezes no mesmo container.
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_posts_due_idx
  on public.marketing_posts (status, scheduled_at);

alter table public.marketing_posts enable row level security;

drop policy if exists "Authenticated select marketing_posts" on public.marketing_posts;
create policy "Authenticated select marketing_posts" on public.marketing_posts
  for select to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists "Authenticated insert marketing_posts" on public.marketing_posts;
create policy "Authenticated insert marketing_posts" on public.marketing_posts
  for insert to authenticated
  with check ((select auth.uid()) is not null);

drop policy if exists "Authenticated update marketing_posts" on public.marketing_posts;
create policy "Authenticated update marketing_posts" on public.marketing_posts
  for update to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

drop policy if exists "Authenticated delete marketing_posts" on public.marketing_posts;
create policy "Authenticated delete marketing_posts" on public.marketing_posts
  for delete to authenticated
  using ((select auth.uid()) is not null);

-- Mídia dos posts. Precisa ser pública: a Meta baixa a imagem/vídeo pela URL
-- na hora de criar o container — não aceita upload direto nem URL assinada
-- que expira antes do processamento do vídeo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketing-media',
  'marketing-media',
  true,
  104857600,
  array['image/jpeg', 'video/mp4', 'video/quicktime']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated upload marketing media" on storage.objects;
create policy "Authenticated upload marketing media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'marketing-media');

drop policy if exists "Authenticated delete marketing media" on storage.objects;
create policy "Authenticated delete marketing media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'marketing-media');

-- Lead que chegou pelo WhatsApp de um anúncio: o WhatsApp manda junto o id
-- do anúncio (externalAdReply.sourceId). Guardar no cliente permite cruzar
-- com o gasto de cada campanha — custo por lead e por fechamento reais.
alter table public.crm_clients
  add column if not exists ad_id text,
  add column if not exists ad_title text,
  add column if not exists ad_source_url text,
  add column if not exists ad_ctwa_clid text,
  add column if not exists ad_first_seen_at timestamptz;

create index if not exists crm_clients_ad_id_idx
  on public.crm_clients (ad_id)
  where ad_id is not null;

alter table public.crm_whatsapp_chats
  drop constraint if exists crm_whatsapp_chats_origem_check;
alter table public.crm_whatsapp_chats
  add constraint crm_whatsapp_chats_origem_check
  check (origem is null or origem in ('prospeccao', 'pessoal', 'anuncio'));
