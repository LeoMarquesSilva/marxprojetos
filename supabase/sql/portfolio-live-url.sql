-- Link do projeto no portfólio: site publicado do cliente.
--
-- Até aqui o card do portfólio sempre apontava para /sites/<path>/index.html,
-- que é a cópia interna usada na revisão com o cliente. Depois que o site
-- entra no ar de verdade, mandar o visitante para a cópia é ruim em dois
-- sentidos: ele não vê o site real (que segue evoluindo) e a cópia acaba
-- concorrendo com o domínio do cliente na busca.
--
-- portfolio_live_url tem precedência sobre o caminho interno. Sem ela, o
-- comportamento antigo continua valendo — projetos ainda não publicados
-- seguem abrindo o preview.
--
-- Aplicado manualmente via Supabase SQL Editor / Management API — este repo
-- não tem migrations rastreadas. Projeto: ywbvybaeakptbaobrcte.

alter table projects
  add column if not exists portfolio_live_url text;

-- O tipo de retorno muda, e o Postgres não permite trocar o retorno com
-- create or replace — por isso o drop explícito.
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
  portfolio_live_url text,
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
    p.portfolio_live_url,
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

-- Os dois projetos do case Pereira Garcia já estão no ar.
update projects
set portfolio_live_url = 'https://www.pereiragarciaadvocacia.com.br/'
where review_site_path = 'pereira-garcia-site';

update projects
set portfolio_live_url = 'https://holding.pereiragarciaadvocacia.com.br/'
where review_site_path = 'pereira-garcia';
