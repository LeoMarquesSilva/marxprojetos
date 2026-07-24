-- Workspace compartilhado: qualquer usuário autenticado passa a ver e editar
-- os dados de todo mundo (não mais isolado por owner_id), e profiles ganha
-- um papel (admin/member) para gestão de usuários. Aplicado manualmente via
-- Supabase SQL Editor / Management API — este repo não tem migrations
-- rastreadas. Projeto: ywbvybaeakptbaobrcte.

alter table profiles add column if not exists role text not null default 'member'
  check (role in ('admin', 'member'));

-- Bootstrap: usuário existente vira o primeiro admin.
update profiles set role = 'admin' where id = 'd7037b85-5c0e-4f8d-86b7-b8f6f280c5bb';

-- projects
drop policy if exists "Owners select projects" on projects;
create policy "Owners select projects" on projects for select using (auth.uid() is not null);

drop policy if exists "Owners update projects" on projects;
create policy "Owners update projects" on projects for update using (auth.uid() is not null);

drop policy if exists "Owners delete projects" on projects;
create policy "Owners delete projects" on projects for delete using (auth.uid() is not null);

-- crm_clients
drop policy if exists "Owners select crm_clients" on crm_clients;
create policy "Owners select crm_clients" on crm_clients for select using (auth.uid() is not null);

drop policy if exists "Owners update crm_clients" on crm_clients;
create policy "Owners update crm_clients" on crm_clients for update using (auth.uid() is not null);

drop policy if exists "Owners delete crm_clients" on crm_clients;
create policy "Owners delete crm_clients" on crm_clients for delete using (auth.uid() is not null);

-- crm_tasks / crm_notes (join com crm_clients, sem mais exigir o dono)
drop policy if exists "Owners manage crm_tasks" on crm_tasks;
create policy "Owners manage crm_tasks" on crm_tasks for all
  using (exists (select 1 from crm_clients c where c.id = crm_tasks.client_id));

drop policy if exists "Owners manage crm_notes" on crm_notes;
create policy "Owners manage crm_notes" on crm_notes for all
  using (exists (select 1 from crm_clients c where c.id = crm_notes.client_id));

-- prospects
drop policy if exists "Owners select prospects" on prospects;
create policy "Owners select prospects" on prospects for select using (auth.uid() is not null);

drop policy if exists "Owners update prospects" on prospects;
create policy "Owners update prospects" on prospects for update using (auth.uid() is not null);

drop policy if exists "Owners delete prospects" on prospects;
create policy "Owners delete prospects" on prospects for delete using (auth.uid() is not null);

-- prospecting_settings: select vira compartilhado (time vê o template de
-- todo mundo); insert/update continuam restritos à própria linha.
drop policy if exists "Owners manage prospecting_settings" on prospecting_settings;

create policy "Authenticated select prospecting_settings" on prospecting_settings
  for select using (auth.uid() is not null);
create policy "Owners insert prospecting_settings" on prospecting_settings
  for insert with check (auth.uid() = owner_id);
create policy "Owners update prospecting_settings" on prospecting_settings
  for update using (auth.uid() = owner_id);

-- site_comments (lado do dono, não confundir com o acesso público por token)
drop policy if exists "owner can select comments" on site_comments;
create policy "owner can select comments" on site_comments for select
  using (exists (select 1 from projects p where p.id = site_comments.project_id));

drop policy if exists "owner can update comments" on site_comments;
create policy "owner can update comments" on site_comments for update
  using (exists (select 1 from projects p where p.id = site_comments.project_id));

-- briefing_submissions
drop policy if exists "Owners select submissions" on briefing_submissions;
create policy "Owners select submissions" on briefing_submissions for select
  using (exists (select 1 from projects p where p.id = briefing_submissions.project_id));
