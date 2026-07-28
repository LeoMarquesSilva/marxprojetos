-- Portfólio editável: move o conteúdo editorial do código para o banco, para
-- que o case do cliente e os projetos externos sejam ajustáveis pela tela
-- /portfolio/gerenciar sem precisar de deploy.
--
-- Antes: o case (resumo/serviços/objetivo/solução/entregas) vivia em
-- src/lib/portfolio-cases.ts e os projetos externos em
-- src/lib/portfolio-projects.ts, ambos hardcoded.
--
-- Aplicado manualmente via Supabase SQL Editor / Management API — este repo
-- não tem migrations rastreadas. Projeto: ywbvybaeakptbaobrcte.

-- 1. Cases: agrupamento editorial de projetos internos do mesmo cliente.
create table if not exists portfolio_cases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client text not null,
  summary text,
  services text[] not null default '{}',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table portfolio_cases enable row level security;

drop policy if exists "Authenticated select portfolio_cases" on portfolio_cases;
create policy "Authenticated select portfolio_cases" on portfolio_cases
  for select using (auth.uid() is not null);

drop policy if exists "Owners insert portfolio_cases" on portfolio_cases;
create policy "Owners insert portfolio_cases" on portfolio_cases
  for insert with check (auth.uid() = owner_id);

drop policy if exists "Authenticated update portfolio_cases" on portfolio_cases;
create policy "Authenticated update portfolio_cases" on portfolio_cases
  for update using (auth.uid() is not null);

drop policy if exists "Authenticated delete portfolio_cases" on portfolio_cases;
create policy "Authenticated delete portfolio_cases" on portfolio_cases
  for delete using (auth.uid() is not null);

-- 2. Campos editoriais por projeto interno (o que era chapter config).
alter table projects
  add column if not exists portfolio_case_id uuid
    references portfolio_cases(id) on delete set null,
  add column if not exists portfolio_eyebrow text,
  add column if not exists portfolio_objective text,
  add column if not exists portfolio_solution text,
  add column if not exists portfolio_deliverables text[] not null default '{}',
  add column if not exists portfolio_image_alt text,
  add column if not exists portfolio_sort_order int not null default 0;

-- 3. Projetos externos: sites entregues que não passaram por briefing aqui.
create table if not exists portfolio_external_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  client_label text not null,
  description text,
  url text,
  cover_url text,
  image_alt text,
  published boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table portfolio_external_projects enable row level security;

drop policy if exists "Authenticated select portfolio_external" on portfolio_external_projects;
create policy "Authenticated select portfolio_external" on portfolio_external_projects
  for select using (auth.uid() is not null);

drop policy if exists "Owners insert portfolio_external" on portfolio_external_projects;
create policy "Owners insert portfolio_external" on portfolio_external_projects
  for insert with check (auth.uid() = owner_id);

drop policy if exists "Authenticated update portfolio_external" on portfolio_external_projects;
create policy "Authenticated update portfolio_external" on portfolio_external_projects
  for update using (auth.uid() is not null);

drop policy if exists "Authenticated delete portfolio_external" on portfolio_external_projects;
create policy "Authenticated delete portfolio_external" on portfolio_external_projects
  for delete using (auth.uid() is not null);

-- 4. RPCs públicas. O tipo de retorno de list_portfolio_projects muda, e o
-- Postgres não permite trocar o retorno com create or replace — por isso o
-- drop explícito antes.
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
    case when p.review_enabled then p.review_site_path else null end as site_path,
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

revoke execute on function public.list_portfolio_projects() from public;
grant execute on function public.list_portfolio_projects() to anon, authenticated;

create or replace function public.list_portfolio_cases()
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

revoke execute on function public.list_portfolio_cases() from public;
grant execute on function public.list_portfolio_cases() to anon, authenticated;

create or replace function public.list_portfolio_external_projects()
returns table (
  id uuid,
  title text,
  client_label text,
  description text,
  url text,
  cover_url text,
  image_alt text,
  sort_order int
)
language sql
security definer
set search_path = ''
as $$
  select e.id, e.title, e.client_label, e.description, e.url, e.cover_url,
         e.image_alt, e.sort_order
  from public.portfolio_external_projects e
  where e.published = true
  order by e.sort_order asc, e.created_at asc;
$$;

revoke execute on function public.list_portfolio_external_projects() from public;
grant execute on function public.list_portfolio_external_projects() to anon, authenticated;
