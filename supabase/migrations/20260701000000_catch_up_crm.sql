-- Catch-up local dos objetos de CRM aplicados historicamente fora das
-- migrations. Mantém somente DDL e o estado final esperado pela aplicação.

create table if not exists public.crm_clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  company text,
  email text,
  phone text,
  source text,
  stage text not null default 'enviado',
  value numeric,
  project_id uuid references public.projects(id) on delete set null,
  lost_reason text,
  next_step text,
  next_step_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.crm_clients
  add column if not exists lost_reason text,
  add column if not exists next_step text,
  add column if not exists next_step_at timestamptz;
alter table public.crm_clients
  drop constraint if exists crm_clients_stage_check;
alter table public.crm_clients
  add constraint crm_clients_stage_check
  check (stage in ('enviado', 'respondeu', 'em_conversa', 'proposta', 'fechado', 'perdido'));
alter table public.crm_clients alter column stage set default 'enviado';
alter table public.crm_clients enable row level security;
drop policy if exists "Owners select crm_clients" on public.crm_clients;
create policy "Owners select crm_clients" on public.crm_clients
  for select to authenticated
  using ((select auth.uid()) = owner_id);
drop policy if exists "Owners insert crm_clients" on public.crm_clients;
create policy "Owners insert crm_clients" on public.crm_clients
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);
drop policy if exists "Owners update crm_clients" on public.crm_clients;
create policy "Owners update crm_clients" on public.crm_clients
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
drop policy if exists "Owners delete crm_clients" on public.crm_clients;
create policy "Owners delete crm_clients" on public.crm_clients
  for delete to authenticated
  using ((select auth.uid()) = owner_id);
create table if not exists public.crm_whatsapp_chats (
  remote_jid text primary key,
  client_id uuid references public.crm_clients(id) on delete set null,
  instance text,
  push_name text,
  last_message_at timestamptz,
  last_message_preview text,
  unread_count int not null default 0,
  origem text,
  lid_jid text,
  updated_at timestamptz not null default now()
);
alter table public.crm_whatsapp_chats
  add column if not exists origem text,
  add column if not exists lid_jid text;
alter table public.crm_whatsapp_chats
  drop constraint if exists crm_whatsapp_chats_origem_check;
alter table public.crm_whatsapp_chats
  add constraint crm_whatsapp_chats_origem_check
  check (origem is null or origem in ('prospeccao', 'pessoal'));
create index if not exists crm_whatsapp_chats_lid_jid_idx
  on public.crm_whatsapp_chats (lid_jid)
  where lid_jid is not null;
alter table public.crm_whatsapp_chats enable row level security;
drop policy if exists "Authenticated select crm_whatsapp_chats" on public.crm_whatsapp_chats;
create policy "Authenticated select crm_whatsapp_chats" on public.crm_whatsapp_chats
  for select to authenticated
  using ((select auth.uid()) is not null);
drop policy if exists "Authenticated insert crm_whatsapp_chats" on public.crm_whatsapp_chats;
create policy "Authenticated insert crm_whatsapp_chats" on public.crm_whatsapp_chats
  for insert to authenticated
  with check ((select auth.uid()) is not null);
drop policy if exists "Authenticated update crm_whatsapp_chats" on public.crm_whatsapp_chats;
create policy "Authenticated update crm_whatsapp_chats" on public.crm_whatsapp_chats
  for update to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);
create table if not exists public.crm_whatsapp_mensagens (
  id uuid primary key default gen_random_uuid(),
  remote_jid text not null references public.crm_whatsapp_chats(remote_jid) on delete cascade,
  client_id uuid references public.crm_clients(id) on delete set null,
  from_me boolean not null default false,
  conteudo text,
  status text not null default 'pending',
  provider_message_id text,
  erro text,
  raw jsonb,
  created_at timestamptz not null default now()
);
alter table public.crm_whatsapp_mensagens
  add column if not exists raw jsonb;
alter table public.crm_whatsapp_mensagens
  drop constraint if exists crm_whatsapp_mensagens_status_check;
alter table public.crm_whatsapp_mensagens
  add constraint crm_whatsapp_mensagens_status_check
  check (status in ('pending', 'server_ack', 'delivery_ack', 'read', 'played', 'error'));
create unique index if not exists crm_whatsapp_mensagens_provider_message_id_key
  on public.crm_whatsapp_mensagens (provider_message_id);
create index if not exists crm_whatsapp_mensagens_remote_jid_idx
  on public.crm_whatsapp_mensagens (remote_jid, created_at);
alter table public.crm_whatsapp_mensagens enable row level security;
drop policy if exists "Authenticated select crm_whatsapp_mensagens" on public.crm_whatsapp_mensagens;
create policy "Authenticated select crm_whatsapp_mensagens" on public.crm_whatsapp_mensagens
  for select to authenticated
  using ((select auth.uid()) is not null);
drop policy if exists "Authenticated insert crm_whatsapp_mensagens" on public.crm_whatsapp_mensagens;
create policy "Authenticated insert crm_whatsapp_mensagens" on public.crm_whatsapp_mensagens
  for insert to authenticated
  with check ((select auth.uid()) is not null);
drop policy if exists "Authenticated update crm_whatsapp_mensagens" on public.crm_whatsapp_mensagens;
create policy "Authenticated update crm_whatsapp_mensagens" on public.crm_whatsapp_mensagens
  for update to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'crm_whatsapp_mensagens'
  ) then
    alter publication supabase_realtime add table public.crm_whatsapp_mensagens;
  end if;
end
$$;
