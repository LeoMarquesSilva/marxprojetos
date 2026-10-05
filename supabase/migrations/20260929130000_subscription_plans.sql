-- Catálogo de planos da recorrência + sites cobertos por assinatura.
--
-- Plano e sites eram texto livre: cada assinatura escrevia o plano de um
-- jeito e não dava para saber quantos clientes estão em cada plano nem que
-- site cada um paga. Agora o plano vem de um catálogo editável (planos e
-- adicionais, como landing pages) e os sites vêm dos projetos do sistema.

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  -- "plano" é a base (um por assinatura); "adicional" soma por cima.
  kind text not null default 'plano' check (kind in ('plano','adicional')),
  price numeric(10,2) not null check (price >= 0),
  -- Horas de alteração por mês incluídas; null quando não se aplica.
  included_hours numeric(4,1) check (included_hours is null or included_hours >= 0),
  features text[] not null default '{}',
  -- Arquivar em vez de apagar: assinaturas antigas continuam apontando.
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions
  add column if not exists plan_id uuid
    references public.subscription_plans(id) on delete set null,
  add column if not exists addon_ids uuid[] not null default '{}',
  -- Array em vez de tabela de ligação: salvar a assinatura troca plano,
  -- adicionais e sites num único update, sem estado pela metade.
  add column if not exists project_ids uuid[] not null default '{}',
  add column if not exists payment_method text;

alter table public.subscription_plans enable row level security;

drop policy if exists "Authenticated select subscription_plans" on public.subscription_plans;
create policy "Authenticated select subscription_plans" on public.subscription_plans
  for select to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists "Owners insert subscription_plans" on public.subscription_plans;
create policy "Owners insert subscription_plans" on public.subscription_plans
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Authenticated update subscription_plans" on public.subscription_plans;
create policy "Authenticated update subscription_plans" on public.subscription_plans
  for update to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);
