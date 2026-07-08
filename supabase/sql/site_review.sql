-- Site Review feature: client-facing pinned comments on the built site.
-- Run this manually in the Supabase SQL Editor for project ywbvybaeakptbaobrcte.
-- Not applied automatically — this repo has no tracked migrations.

-- 1. Review settings live directly on projects (1:1)
alter table projects
  add column if not exists review_token uuid unique default gen_random_uuid(),
  add column if not exists review_site_path text,
  add column if not exists review_enabled boolean not null default false;

-- 2. Pinned comments (1:many)
create table if not exists site_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  page_path text not null default '/',
  x_pct numeric not null,
  y_pct numeric not null,
  viewport_width int not null,
  comment text not null,
  author_name text,
  author_email text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table site_comments enable row level security;

-- Owner (authenticated dashboard) can see/manage comments on their own projects
drop policy if exists "owner can select comments" on site_comments;
create policy "owner can select comments" on site_comments
  for select using (
    exists (select 1 from projects p where p.id = site_comments.project_id and p.owner_id = auth.uid())
  );

drop policy if exists "owner can update comments" on site_comments;
create policy "owner can update comments" on site_comments
  for update using (
    exists (select 1 from projects p where p.id = site_comments.project_id and p.owner_id = auth.uid())
  );

-- No anon policies on site_comments: public access goes only through the
-- SECURITY DEFINER RPCs below, matching the existing get_briefing_by_token /
-- submit_briefing pattern used for /b/[token].

create or replace function get_review_by_token(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'title', title,
    'review_site_path', review_site_path,
    'token', review_token
  ) into v_result
  from projects
  where review_token = p_token and review_enabled = true;
  return v_result;
end;
$$;
grant execute on function get_review_by_token(uuid) to anon;

create or replace function list_review_comments(p_token uuid)
returns setof site_comments
language plpgsql security definer set search_path = public as $$
begin
  return query
    select c.* from site_comments c
    join projects p on p.id = c.project_id
    where p.review_token = p_token and p.review_enabled = true
    order by c.created_at asc;
end;
$$;
grant execute on function list_review_comments(uuid) to anon;

create or replace function add_review_comment(
  p_token uuid, p_page_path text, p_x_pct numeric, p_y_pct numeric,
  p_viewport_width int, p_comment text, p_author_name text, p_author_email text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_project_id uuid; v_id uuid;
begin
  select id into v_project_id from projects where review_token = p_token and review_enabled = true;
  if v_project_id is null then raise exception 'invalid or disabled review token'; end if;

  insert into site_comments (project_id, page_path, x_pct, y_pct, viewport_width, comment, author_name, author_email)
  values (v_project_id, p_page_path, p_x_pct, p_y_pct, p_viewport_width, p_comment, p_author_name, p_author_email)
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function add_review_comment(uuid, text, numeric, numeric, int, text, text, text) to anon;
