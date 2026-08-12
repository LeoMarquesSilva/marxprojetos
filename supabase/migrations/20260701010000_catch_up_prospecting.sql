-- Catch-up local da prospecção, dependente do CRM criado na migration anterior.

create table if not exists public.prospects (
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
  status text not null default 'novo',
  custom_message text,
  crm_client_id uuid references public.crm_clients(id) on delete set null,
  email text,
  enrich_job_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, google_place_id)
);
alter table public.prospects
  add column if not exists email text,
  add column if not exists enrich_job_id text;
alter table public.prospects
  drop constraint if exists prospects_status_check;
alter table public.prospects
  add constraint prospects_status_check
  check (status in ('novo', 'contatado', 'respondeu', 'descartado'));
alter table public.prospects enable row level security;
drop policy if exists "Owners select prospects" on public.prospects;
create policy "Owners select prospects" on public.prospects
  for select to authenticated
  using ((select auth.uid()) = owner_id);
drop policy if exists "Owners insert prospects" on public.prospects;
create policy "Owners insert prospects" on public.prospects
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);
drop policy if exists "Owners update prospects" on public.prospects;
create policy "Owners update prospects" on public.prospects
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
drop policy if exists "Owners delete prospects" on public.prospects;
create policy "Owners delete prospects" on public.prospects
  for delete to authenticated
  using ((select auth.uid()) = owner_id);
create table if not exists public.prospecting_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  template text not null,
  updated_at timestamptz not null default now()
);
alter table public.prospecting_settings enable row level security;
drop policy if exists "Owners manage prospecting_settings" on public.prospecting_settings;
create policy "Owners manage prospecting_settings" on public.prospecting_settings
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
