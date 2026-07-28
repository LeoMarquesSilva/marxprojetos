-- Diferenciais (tags) para projetos externos + atualização do case Confiara.
--
-- O Confiara não é um site institucional simples: é uma plataforma SaaS
-- multiempresa de conformidade com a NR-1 (diagnóstico de riscos
-- psicossociais + canal de denúncias). O campo "description" sozinho não
-- comunica isso com destaque suficiente, então ganha companhia de tags
-- curtas — mesma linguagem visual das "Entregas" do case Pereira Garcia —
-- reutilizável por qualquer projeto externo, não só este.
--
-- Aplicado manualmente via Supabase SQL Editor / Management API — este repo
-- não tem migrations rastreadas. Projeto: ywbvybaeakptbaobrcte.

alter table portfolio_external_projects
  add column if not exists highlights text[];

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
  select e.id, e.title, e.client_label, e.description, e.url, e.cover_url,
         e.image_alt, e.highlights, e.sort_order
  from public.portfolio_external_projects e
  where e.published = true
  order by e.sort_order asc, e.created_at asc;
$$;

revoke execute on function public.list_portfolio_external_projects() from public;
grant execute on function public.list_portfolio_external_projects() to anon, authenticated;

update portfolio_external_projects
set
  title = 'Plataforma de Compliance NR-1 — Confiara',
  description = 'Uma plataforma SaaS multiempresa que digitaliza dois processos de conformidade: diagnóstico de riscos psicossociais (NR-1) e canal de denúncias, atendendo à Lei 14.457/2022 e à ISO 37002.',
  image_alt = 'Hero da plataforma Confiara, apresentando a gestão de conformidade psicossocial e o canal de denúncias',
  highlights = array[
    'Diagnóstico de riscos psicossociais (NR-1)',
    'Canal de denúncias com protocolo rastreável',
    'Arquitetura multiempresa',
    'Painel administrativo para RH e Compliance'
  ]
where client_label = 'Confiara';
