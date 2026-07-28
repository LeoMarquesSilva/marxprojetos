-- Apresentação pessoal e CTA de WhatsApp da página pública de portfólio.
--
-- O portfólio é enviado para leads frios da prospecção: quem abre o link não
-- conhece a INSYT. Perfil do responsável (credenciais + LinkedIn verificável)
-- é um sinal de confiança documentado para serviços B2B, e no Brasil o
-- WhatsApp converte muito melhor que formulário. Os textos ficam no banco
-- para permitir testar variações de copy sem deploy.
--
-- Aplicado manualmente via Supabase SQL Editor / Management API — este repo
-- não tem migrations rastreadas. Projeto: ywbvybaeakptbaobrcte.

create table if not exists portfolio_site_settings (
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

alter table portfolio_site_settings enable row level security;

drop policy if exists "Authenticated select portfolio_site_settings" on portfolio_site_settings;
create policy "Authenticated select portfolio_site_settings" on portfolio_site_settings
  for select using (auth.uid() is not null);

drop policy if exists "Owners insert portfolio_site_settings" on portfolio_site_settings;
create policy "Owners insert portfolio_site_settings" on portfolio_site_settings
  for insert with check (auth.uid() = owner_id);

drop policy if exists "Authenticated update portfolio_site_settings" on portfolio_site_settings;
create policy "Authenticated update portfolio_site_settings" on portfolio_site_settings
  for update using (auth.uid() is not null);

-- Seed com os dados atuais. O bio evita promessa de resultado e destaca a
-- especialização no nicho, que é o diferencial para escritórios de advocacia.
insert into portfolio_site_settings (
  owner_id, about_enabled, about_name, about_role, about_bio,
  about_linkedin_url, whatsapp_number, whatsapp_message, cta_label
)
select
  (select id from auth.users order by created_at limit 1),
  true,
  'Leonardo Marques',
  'Marketing jurídico e presença digital para escritórios de advocacia',
  'Formado em Tecnologia da Informação e finalizando o bacharelado em Marketing. Atuo com marketing jurídico, potencializando a presença digital de escritórios de advocacia — unindo a parte técnica de quem constrói o site com a estratégia de quem entende como o cliente escolhe um advogado.',
  'https://www.linkedin.com/in/leonardomarquessilva/',
  '5535988754584',
  'Olá, Leonardo! Vi seu portfólio e gostaria de solicitar um orçamento.',
  'Solicitar orçamento'
where not exists (select 1 from portfolio_site_settings);

-- RPC pública: allowlist explícita, sem expor owner_id nem updated_at.
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
  select s.about_enabled, s.about_name, s.about_role, s.about_bio,
         s.about_photo_url, s.about_linkedin_url, s.whatsapp_number,
         s.whatsapp_message, s.cta_label
  from public.portfolio_site_settings s
  order by s.updated_at desc
  limit 1;
$$;

revoke execute on function public.get_portfolio_site_settings() from public;
grant execute on function public.get_portfolio_site_settings() to anon, authenticated;
