-- Catch-up local da revisão pública de sites. O acesso anônimo às tabelas
-- continua bloqueado; somente as RPCs com allowlist expõem dados.

alter table public.projects
  add column if not exists review_token uuid unique default gen_random_uuid(),
  add column if not exists review_site_path text,
  add column if not exists review_enabled boolean not null default false,
  add column if not exists review_enabled_at timestamptz,
  add column if not exists review_approved_at timestamptz;
create table if not exists public.site_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  page_path text not null default '/',
  x_pct numeric not null,
  y_pct numeric not null,
  viewport_width int not null,
  comment text not null,
  author_name text,
  author_email text,
  status text not null default 'open'
    check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  width_pct numeric not null default 0,
  height_pct numeric not null default 0
);
alter table public.site_comments
  add column if not exists width_pct numeric not null default 0,
  add column if not exists height_pct numeric not null default 0;
alter table public.site_comments enable row level security;
drop policy if exists "owner can select comments" on public.site_comments;
create policy "owner can select comments" on public.site_comments
  for select to authenticated
  using (
    exists (
      select 1
      from public.projects p
      where p.id = site_comments.project_id
        and p.owner_id = (select auth.uid())
    )
  );
drop policy if exists "owner can update comments" on public.site_comments;
create policy "owner can update comments" on public.site_comments
  for update to authenticated
  using (
    exists (
      select 1
      from public.projects p
      where p.id = site_comments.project_id
        and p.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.projects p
      where p.id = site_comments.project_id
        and p.owner_id = (select auth.uid())
    )
  );
create or replace function public.get_review_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'title', p.title,
    'review_site_path', p.review_site_path,
    'token', p.review_token,
    'review_enabled_at', p.review_enabled_at,
    'review_approved_at', p.review_approved_at
  )
  into v_result
  from public.projects p
  where p.review_token = p_token
    and p.review_enabled = true;

  return v_result;
end;
$$;
create or replace function public.list_review_comments(p_token uuid)
returns setof public.site_comments
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
    select c.*
    from public.site_comments c
    join public.projects p on p.id = c.project_id
    where p.review_token = p_token
      and p.review_enabled = true
    order by c.created_at asc;
end;
$$;
drop function if exists public.add_review_comment(
  uuid, text, numeric, numeric, int, text, text, text
);
create or replace function public.add_review_comment(
  p_token uuid,
  p_page_path text,
  p_x_pct numeric,
  p_y_pct numeric,
  p_viewport_width int,
  p_comment text,
  p_author_name text,
  p_author_email text,
  p_width_pct numeric default 0,
  p_height_pct numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_id uuid;
begin
  select p.id
  into v_project_id
  from public.projects p
  where p.review_token = p_token
    and p.review_enabled = true;

  if v_project_id is null then
    raise exception 'invalid or disabled review token';
  end if;

  insert into public.site_comments (
    project_id,
    page_path,
    x_pct,
    y_pct,
    viewport_width,
    comment,
    author_name,
    author_email,
    width_pct,
    height_pct
  )
  values (
    v_project_id,
    p_page_path,
    p_x_pct,
    p_y_pct,
    p_viewport_width,
    p_comment,
    p_author_name,
    p_author_email,
    p_width_pct,
    p_height_pct
  )
  returning id into v_id;

  return v_id;
end;
$$;
create or replace function public.approve_review(p_token uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_approved_at timestamptz;
begin
  update public.projects
  set review_approved_at = now()
  where review_token = p_token
    and review_enabled = true
  returning review_approved_at into v_approved_at;

  if v_approved_at is null then
    raise exception 'invalid or disabled review token';
  end if;

  return v_approved_at;
end;
$$;
revoke all on function public.get_review_by_token(uuid) from public;
revoke all on function public.list_review_comments(uuid) from public;
revoke all on function public.add_review_comment(
  uuid, text, numeric, numeric, int, text, text, text, numeric, numeric
) from public;
revoke all on function public.approve_review(uuid) from public;
grant execute on function public.get_review_by_token(uuid) to anon, authenticated;
grant execute on function public.list_review_comments(uuid) to anon, authenticated;
grant execute on function public.add_review_comment(
  uuid, text, numeric, numeric, int, text, text, text, numeric, numeric
) to anon, authenticated;
grant execute on function public.approve_review(uuid) to anon, authenticated;
