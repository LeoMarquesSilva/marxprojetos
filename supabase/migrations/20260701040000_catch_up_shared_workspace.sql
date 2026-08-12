-- Catch-up local do workspace compartilhado. O bootstrap histórico de admin
-- com UUID pessoal foi removido; a promoção inicial deve ser feita de modo
-- explícito e específico para cada ambiente.

alter table public.profiles
  add column if not exists role text not null default 'member';
alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'member'));
drop policy if exists "Owners select projects" on public.projects;
create policy "Owners select projects" on public.projects
  for select to authenticated
  using ((select auth.uid()) is not null);
drop policy if exists "Owners update projects" on public.projects;
create policy "Owners update projects" on public.projects
  for update to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);
drop policy if exists "Owners delete projects" on public.projects;
create policy "Owners delete projects" on public.projects
  for delete to authenticated
  using ((select auth.uid()) is not null);
drop policy if exists "Owners select crm_clients" on public.crm_clients;
create policy "Owners select crm_clients" on public.crm_clients
  for select to authenticated
  using ((select auth.uid()) is not null);
drop policy if exists "Owners update crm_clients" on public.crm_clients;
create policy "Owners update crm_clients" on public.crm_clients
  for update to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);
drop policy if exists "Owners delete crm_clients" on public.crm_clients;
create policy "Owners delete crm_clients" on public.crm_clients
  for delete to authenticated
  using ((select auth.uid()) is not null);
drop policy if exists "Owners select prospects" on public.prospects;
create policy "Owners select prospects" on public.prospects
  for select to authenticated
  using ((select auth.uid()) is not null);
drop policy if exists "Owners update prospects" on public.prospects;
create policy "Owners update prospects" on public.prospects
  for update to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);
drop policy if exists "Owners delete prospects" on public.prospects;
create policy "Owners delete prospects" on public.prospects
  for delete to authenticated
  using ((select auth.uid()) is not null);
drop policy if exists "Owners manage prospecting_settings" on public.prospecting_settings;
drop policy if exists "Authenticated select prospecting_settings" on public.prospecting_settings;
drop policy if exists "Owners insert prospecting_settings" on public.prospecting_settings;
drop policy if exists "Owners update prospecting_settings" on public.prospecting_settings;
create policy "Authenticated select prospecting_settings" on public.prospecting_settings
  for select to authenticated
  using ((select auth.uid()) is not null);
create policy "Owners insert prospecting_settings" on public.prospecting_settings
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "Owners update prospecting_settings" on public.prospecting_settings
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
drop policy if exists "owner can select comments" on public.site_comments;
create policy "owner can select comments" on public.site_comments
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.projects p
      where p.id = site_comments.project_id
    )
  );
drop policy if exists "owner can update comments" on public.site_comments;
create policy "owner can update comments" on public.site_comments
  for update to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.projects p
      where p.id = site_comments.project_id
    )
  )
  with check (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.projects p
      where p.id = site_comments.project_id
    )
  );
drop policy if exists "Owners select submissions" on public.briefing_submissions;
create policy "Owners select submissions" on public.briefing_submissions
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.projects p
      where p.id = briefing_submissions.project_id
    )
  );
