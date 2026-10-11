-- Prospecção 2.0: novas fontes de busca (Google Places, Apify), análise do
-- site do lead, prioridade, follow-up e limite diário de envios.

-- Verificação de WhatsApp: existia só em supabase/sql/prospects-whatsapp-check.sql
-- (aplicado à mão). Trazida para as migrations para um banco novo não
-- nascer sem as colunas que a tela já usa.
alter table public.prospects
  add column if not exists has_whatsapp boolean,
  add column if not exists whatsapp_checked_at timestamptz,
  -- JID real devolvido pela verificação. Muitos celulares BR estão no
  -- WhatsApp sem o nono dígito; enviar para o JID real faz a resposta cair
  -- na mesma conversa do envio.
  add column if not exists whatsapp_jid text;

create index if not exists prospects_whatsapp_pendente_idx
  on public.prospects (whatsapp_checked_at)
  where phone_e164 is not null;

alter table public.prospects
  -- De onde o lead veio: google | apify | localprospects | csv.
  add column if not exists source text,
  -- Categoria do Maps ("Advogado criminalista"): ajuda a reconhecer o nicho.
  add column if not exists category text,
  add column if not exists instagram text,
  add column if not exists facebook text,
  add column if not exists linkedin text,
  -- Celular publicado como WhatsApp no site do lead (e164).
  add column if not exists site_whatsapp text,
  -- ok | offline | social (rede social no lugar de site); null = não analisado.
  add column if not exists site_status text,
  add column if not exists site_issues text[] not null default '{}',
  add column if not exists site_checked_at timestamptz,
  add column if not exists contacted_at timestamptz,
  add column if not exists replied_at timestamptz,
  add column if not exists followup_count int not null default 0,
  add column if not exists last_followup_at timestamptz;

alter table public.prospects
  drop constraint if exists prospects_site_status_check;
alter table public.prospects
  add constraint prospects_site_status_check
  check (site_status is null or site_status in ('ok', 'offline', 'social'));

-- A busca confere se o lugar já existe para qualquer pessoa do workspace
-- (o select é compartilhado); o índice único começa por owner_id e não
-- serve para essa consulta.
create index if not exists prospects_google_place_id_idx
  on public.prospects (google_place_id);

-- Resposta no WhatsApp acha o lead pelo telefone e pelo cliente do CRM.
create index if not exists prospects_phone_e164_idx
  on public.prospects (phone_e164)
  where phone_e164 is not null;
create index if not exists prospects_crm_client_id_idx
  on public.prospects (crm_client_id)
  where crm_client_id is not null;

-- Contagem de envios do dia (limite diário).
create index if not exists prospects_contacted_at_idx
  on public.prospects (contacted_at)
  where contacted_at is not null;

update public.prospects
set source = case when google_place_id like 'csv:%' then 'csv' else 'localprospects' end
where source is null;

-- Quem já foi abordado ganha a data do primeiro envio real (ou, sem
-- mensagem registrada, a última alteração) para entrar no follow-up.
update public.prospects p
set contacted_at = coalesce(
  (
    select min(m.created_at)
    from public.crm_whatsapp_mensagens m
    where p.crm_client_id is not null
      and m.client_id = p.crm_client_id
      and m.from_me
  ),
  p.updated_at
)
where p.status in ('contatado', 'respondeu')
  and p.contacted_at is null;

-- Fila do robô próprio do Google Maps. O app (Vercel) não tem navegador:
-- ele só registra o pedido; o robô (npm run maps:robo, no computador) pega,
-- busca no Maps e grava os leads com a service role.
create table if not exists public.prospect_search_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  niche text not null,
  city text not null,
  state text,
  mode text not null default 'padrao',
  terms text[] not null default '{}',
  max_results int not null default 120,
  status text not null default 'pendente',
  progress text,
  found int not null default 0,
  imported int not null default 0,
  updated int not null default 0,
  new_ids uuid[] not null default '{}',
  error text,
  worker text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  constraint prospect_search_jobs_mode_check
    check (mode in ('padrao', 'ampla', 'varredura')),
  constraint prospect_search_jobs_status_check
    check (status in ('pendente', 'rodando', 'concluido', 'erro', 'cancelado')),
  constraint prospect_search_jobs_max_results_check
    check (max_results between 1 and 500)
);

create index if not exists prospect_search_jobs_fila_idx
  on public.prospect_search_jobs (created_at)
  where status = 'pendente';

alter table public.prospect_search_jobs enable row level security;
-- Workspace compartilhado, como prospects: todos veem e cancelam a fila;
-- cada um só cria pedido em nome próprio.
drop policy if exists "Authenticated select prospect_search_jobs" on public.prospect_search_jobs;
create policy "Authenticated select prospect_search_jobs" on public.prospect_search_jobs
  for select to authenticated
  using ((select auth.uid()) is not null);
drop policy if exists "Owners insert prospect_search_jobs" on public.prospect_search_jobs;
create policy "Owners insert prospect_search_jobs" on public.prospect_search_jobs
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);
drop policy if exists "Authenticated update prospect_search_jobs" on public.prospect_search_jobs;
create policy "Authenticated update prospect_search_jobs" on public.prospect_search_jobs
  for update to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

-- Sinal de vida do robô, para a tela dizer se ele está ligado.
create table if not exists public.prospect_worker_heartbeats (
  worker text primary key,
  last_seen_at timestamptz not null default now(),
  version text
);
alter table public.prospect_worker_heartbeats enable row level security;
drop policy if exists "Authenticated select prospect_worker_heartbeats" on public.prospect_worker_heartbeats;
create policy "Authenticated select prospect_worker_heartbeats" on public.prospect_worker_heartbeats
  for select to authenticated
  using ((select auth.uid()) is not null);

alter table public.prospecting_settings
  add column if not exists followup_template text,
  add column if not exists daily_limit int not null default 40;

alter table public.prospecting_settings
  drop constraint if exists prospecting_settings_daily_limit_check;
alter table public.prospecting_settings
  add constraint prospecting_settings_daily_limit_check
  check (daily_limit between 1 and 500);
