-- CRM module: clients/leads independent of briefings, pipeline stage,
-- follow-up tasks, and interaction notes. Applied manually via the Supabase
-- SQL Editor / Management API — this repo has no tracked migrations.

create table if not exists crm_clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  company text,
  email text,
  phone text,
  source text,
  stage text not null default 'lead'
    check (stage in ('lead','contato_feito','proposta_enviada','fechado','perdido')),
  value numeric,
  project_id uuid references projects(id) on delete set null,
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table crm_clients add column if not exists lost_reason text;

alter table crm_clients enable row level security;

drop policy if exists "Owners select crm_clients" on crm_clients;
create policy "Owners select crm_clients" on crm_clients for select using (auth.uid() = owner_id);

drop policy if exists "Owners insert crm_clients" on crm_clients;
create policy "Owners insert crm_clients" on crm_clients for insert with check (auth.uid() = owner_id);

drop policy if exists "Owners update crm_clients" on crm_clients;
create policy "Owners update crm_clients" on crm_clients for update using (auth.uid() = owner_id);

drop policy if exists "Owners delete crm_clients" on crm_clients;
create policy "Owners delete crm_clients" on crm_clients for delete using (auth.uid() = owner_id);

create table if not exists crm_tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references crm_clients(id) on delete cascade,
  title text not null,
  due_date timestamptz,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

alter table crm_tasks enable row level security;

drop policy if exists "Owners manage crm_tasks" on crm_tasks;
create policy "Owners manage crm_tasks" on crm_tasks for all using (
  exists (select 1 from crm_clients c where c.id = crm_tasks.client_id and c.owner_id = auth.uid())
);

create table if not exists crm_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references crm_clients(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table crm_notes enable row level security;

drop policy if exists "Owners manage crm_notes" on crm_notes;
create policy "Owners manage crm_notes" on crm_notes for all using (
  exists (select 1 from crm_clients c where c.id = crm_notes.client_id and c.owner_id = auth.uid())
);
