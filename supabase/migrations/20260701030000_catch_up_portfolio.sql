-- Catch-up local do portfólio. Seeds editoriais e dados pessoais dos scripts
-- históricos foram intencionalmente omitidos.

alter table public.projects
  add column if not exists portfolio_published boolean not null default false,
  add column if not exists portfolio_description text,
  add column if not exists portfolio_cover_url text;
create table if not exists public.portfolio_cases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client text not null,
  summary text,
  services text[] not null default '{}',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.portfolio_cases enable row level security;
drop policy if exists "Authenticated select portfolio_cases" on public.portfolio_cases;
create policy "Authenticated select portfolio_cases" on public.portfolio_cases
  for select to authenticated
  using ((select auth.uid()) is not null);
drop policy if exists "Owners insert portfolio_cases" on public.portfolio_cases;
create policy "Owners insert portfolio_cases" on public.portfolio_cases
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);
drop policy if exists "Authenticated update portfolio_cases" on public.portfolio_cases;
create policy "Authenticated update portfolio_cases" on public.portfolio_cases
  for update to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);
drop policy if exists "Authenticated delete portfolio_cases" on public.portfolio_cases;
create policy "Authenticated delete portfolio_cases" on public.portfolio_cases
  for delete to authenticated
  using ((select auth.uid()) is not null);
alter table public.projects
  add column if not exists portfolio_case_id uuid
    references public.portfolio_cases(id) on delete set null,
  add column if not exists portfolio_eyebrow text,
  add column if not exists portfolio_objective text,
  add column if not exists portfolio_solution text,
  add column if not exists portfolio_deliverables text[] not null default '{}',
  add column if not exists portfolio_image_alt text,
  add column if not exists portfolio_sort_order int not null default 0;
create table if not exists public.portfolio_external_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  client_label text not null,
  description text,
  url text,
  cover_url text,
  image_alt text,
  highlights text[],
  published boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.portfolio_external_projects
  add column if not exists highlights text[];
alter table public.portfolio_external_projects enable row level security;
drop policy if exists "Authenticated select portfolio_external" on public.portfolio_external_projects;
create policy "Authenticated select portfolio_external" on public.portfolio_external_projects
  for select to authenticated
  using ((select auth.uid()) is not null);
drop policy if exists "Owners insert portfolio_external" on public.portfolio_external_projects;
create policy "Owners insert portfolio_external" on public.portfolio_external_projects
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);
drop policy if exists "Authenticated update portfolio_external" on public.portfolio_external_projects;
create policy "Authenticated update portfolio_external" on public.portfolio_external_projects
  for update to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);
drop policy if exists "Authenticated delete portfolio_external" on public.portfolio_external_projects;
create policy "Authenticated delete portfolio_external" on public.portfolio_external_projects
  for delete to authenticated
  using ((select auth.uid()) is not null);
create table if not exists public.portfolio_site_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  about_enabled boolean not null default true,
  about_name text,
  about_role text,
  about_bio text,
  about_photo_url text,
  about_linkedin_url text,
  whatsapp_number text,
  whatsapp_message text,
  cta_label text,
  updated_at timestamptz not null default now()
);
alter table public.portfolio_site_settings enable row level security;
drop policy if exists "Authenticated select portfolio_site_settings" on public.portfolio_site_settings;
create policy "Authenticated select portfolio_site_settings" on public.portfolio_site_settings
  for select to authenticated
  using ((select auth.uid()) is not null);
drop policy if exists "Owners insert portfolio_site_settings" on public.portfolio_site_settings;
create policy "Owners insert portfolio_site_settings" on public.portfolio_site_settings
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);
drop policy if exists "Authenticated update portfolio_site_settings" on public.portfolio_site_settings;
create policy "Authenticated update portfolio_site_settings" on public.portfolio_site_settings
  for update to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);
drop function if exists public.list_portfolio_projects();
create function public.list_portfolio_projects()
returns table (
  id uuid,
  title text,
  client_name text,
  client_company text,
  portfolio_description text,
  portfolio_cover_url text,
  site_path text,
  portfolio_case_id uuid,
  portfolio_eyebrow text,
  portfolio_objective text,
  portfolio_solution text,
  portfolio_deliverables text[],
  portfolio_image_alt text,
  portfolio_sort_order int,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    p.id,
    p.title,
    p.client_name,
    p.client_company,
    p.portfolio_description,
    p.portfolio_cover_url,
    case when p.review_enabled then p.review_site_path else null end,
    p.portfolio_case_id,
    p.portfolio_eyebrow,
    p.portfolio_objective,
    p.portfolio_solution,
    p.portfolio_deliverables,
    p.portfolio_image_alt,
    p.portfolio_sort_order,
    p.created_at
  from public.projects p
  where p.portfolio_published = true
  order by p.portfolio_sort_order asc, p.created_at desc;
$$;
drop function if exists public.list_portfolio_cases();
create function public.list_portfolio_cases()
returns table (
  id uuid,
  client text,
  summary text,
  services text[],
  sort_order int
)
language sql
security definer
set search_path = ''
as $$
  select c.id, c.client, c.summary, c.services, c.sort_order
  from public.portfolio_cases c
  order by c.sort_order asc, c.created_at asc;
$$;
drop function if exists public.list_portfolio_external_projects();
create function public.list_portfolio_external_projects()
returns table (
  id uuid,
  title text,
  client_label text,
  description text,
  url text,
  cover_url text,
  image_alt text,
  highlights text[],
  sort_order int
)
language sql
security definer
set search_path = ''
as $$
  select
    e.id,
    e.title,
    e.client_label,
    e.description,
    e.url,
    e.cover_url,
    e.image_alt,
    e.highlights,
    e.sort_order
  from public.portfolio_external_projects e
  where e.published = true
  order by e.sort_order asc, e.created_at asc;
$$;
create or replace function public.get_portfolio_site_settings()
returns table (
  about_enabled boolean,
  about_name text,
  about_role text,
  about_bio text,
  about_photo_url text,
  about_linkedin_url text,
  whatsapp_number text,
  whatsapp_message text,
  cta_label text
)
language sql
security definer
set search_path = ''
as $$
  select
    s.about_enabled,
    s.about_name,
    s.about_role,
    s.about_bio,
    s.about_photo_url,
    s.about_linkedin_url,
    s.whatsapp_number,
    s.whatsapp_message,
    s.cta_label
  from public.portfolio_site_settings s
  order by s.updated_at desc
  limit 1;
$$;
revoke all on function public.list_portfolio_projects() from public;
revoke all on function public.list_portfolio_cases() from public;
revoke all on function public.list_portfolio_external_projects() from public;
revoke all on function public.get_portfolio_site_settings() from public;
grant execute on function public.list_portfolio_projects() to anon, authenticated;
grant execute on function public.list_portfolio_cases() to anon, authenticated;
grant execute on function public.list_portfolio_external_projects() to anon, authenticated;
grant execute on function public.get_portfolio_site_settings() to anon, authenticated;
