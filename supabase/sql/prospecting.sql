-- Prospecção: leads captados via LocalProspects.ai por nicho + cidade,
-- com status de abordagem, enriquecimento assíncrono (email, tipo de
-- telefone) e ponte para o CRM. Aplicado manualmente via Supabase SQL
-- Editor / Management API — este repo não tem migrations rastreadas.

create table if not exists prospects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  google_place_id text not null,
  name text not null,
  phone text,
  phone_e164 text,
  is_mobile boolean not null default false,
  website text,
  address text,
  rating numeric,
  rating_count int,
  google_maps_uri text,
  niche text not null,
  city text not null,
  status text not null default 'novo'
    check (status in ('novo','contatado','respondeu','descartado')),
  custom_message text,
  crm_client_id uuid references crm_clients(id) on delete set null,
  email text,
  -- job de enriquecimento pendente no LocalProspects; null = já aplicado
  enrich_job_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, google_place_id)
);

alter table prospects add column if not exists email text;
alter table prospects add column if not exists enrich_job_id text;

alter table prospects enable row level security;

drop policy if exists "Owners select prospects" on prospects;
create policy "Owners select prospects" on prospects for select using (auth.uid() = owner_id);

drop policy if exists "Owners insert prospects" on prospects;
create policy "Owners insert prospects" on prospects for insert with check (auth.uid() = owner_id);

drop policy if exists "Owners update prospects" on prospects;
create policy "Owners update prospects" on prospects for update using (auth.uid() = owner_id);

drop policy if exists "Owners delete prospects" on prospects;
create policy "Owners delete prospects" on prospects for delete using (auth.uid() = owner_id);

create table if not exists prospecting_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  template text not null,
  updated_at timestamptz not null default now()
);

alter table prospecting_settings enable row level security;

drop policy if exists "Owners manage prospecting_settings" on prospecting_settings;
create policy "Owners manage prospecting_settings" on prospecting_settings
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
