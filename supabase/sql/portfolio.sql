-- Portfólio público: link sem login mostrando os projetos que o usuário
-- marcar manualmente como prontos pra exibir. Acesso anônimo passa só pela
-- RPC abaixo (allowlist explícita de colunas — nunca expõe e-mail do
-- cliente, token de review ou respostas do briefing), mesmo padrão de
-- get_review_by_token em site_review.sql. Rodar manualmente no Supabase SQL
-- Editor / Management API — este repo não tem migrations rastreadas.
-- Projeto: ywbvybaeakptbaobrcte.

alter table projects
  add column if not exists portfolio_published boolean not null default false,
  add column if not exists portfolio_description text,
  add column if not exists portfolio_cover_url text;

create or replace function public.list_portfolio_projects()
returns table (
  id uuid,
  title text,
  client_name text,
  client_company text,
  portfolio_description text,
  portfolio_cover_url text,
  site_path text,
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
    p.created_at
  from public.projects p
  where p.portfolio_published = true
  order by p.created_at desc;
$$;

-- Funções recebem EXECUTE de PUBLIC por padrão no Postgres. Revogamos
-- explicitamente e liberamos apenas os papéis usados pelo app.
revoke execute on function public.list_portfolio_projects() from public;
revoke execute on function public.list_portfolio_projects() from anon, authenticated;
grant execute on function public.list_portfolio_projects() to anon, authenticated;
