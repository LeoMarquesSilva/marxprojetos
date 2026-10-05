-- Recorrência: planos mensais de hospedagem + manutenção dos sites.
--
-- Duas tabelas em vez de um "status do mês" dentro da assinatura: a
-- assinatura diz quanto e quando cobrar; cada pagamento é uma linha própria
-- com o mês de referência. Assim o histórico não se perde quando o mês vira,
-- e "quem está em atraso" sai da diferença entre meses devidos e meses pagos.
--
-- Mesmo modelo de acesso do workspace compartilhado: qualquer usuário
-- autenticado lê e edita; só o insert amarra owner_id ao próprio usuário.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  crm_client_id uuid references public.crm_clients(id) on delete set null,
  proposal_id uuid references public.proposals(id) on delete set null,
  client_name text not null,
  plan_name text not null default 'Manutenção e Infraestrutura',
  -- Quais sites/landing pages o plano cobre, em texto livre.
  description text,
  amount numeric(10,2) not null check (amount >= 0),
  -- Até 28 para todo mês ter o dia de vencimento, inclusive fevereiro.
  billing_day smallint not null default 10 check (billing_day between 1 and 28),
  status text not null default 'ativa'
    check (status in ('ativa','cancelada')),
  started_on date not null default current_date,
  -- Meses com vencimento a partir desta data deixam de ser cobrados.
  ended_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_on is null or ended_on >= started_on)
);

create index if not exists subscriptions_status_idx
  on public.subscriptions (status);

create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null
    references public.subscriptions(id) on delete cascade,
  -- Sempre o dia 1 do mês a que o pagamento se refere.
  reference_month date not null
    check (extract(day from reference_month) = 1),
  amount numeric(10,2) not null check (amount >= 0),
  paid_on date not null default current_date,
  method text,
  notes text,
  created_at timestamptz not null default now(),
  -- Um pagamento por mês por assinatura: clique duplo não vira receita dobrada.
  unique (subscription_id, reference_month)
);

alter table public.subscriptions enable row level security;
alter table public.subscription_payments enable row level security;

drop policy if exists "Authenticated select subscriptions" on public.subscriptions;
create policy "Authenticated select subscriptions" on public.subscriptions
  for select to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists "Owners insert subscriptions" on public.subscriptions;
create policy "Owners insert subscriptions" on public.subscriptions
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Authenticated update subscriptions" on public.subscriptions;
create policy "Authenticated update subscriptions" on public.subscriptions
  for update to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

drop policy if exists "Authenticated delete subscriptions" on public.subscriptions;
create policy "Authenticated delete subscriptions" on public.subscriptions
  for delete to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists "Authenticated select subscription_payments" on public.subscription_payments;
create policy "Authenticated select subscription_payments" on public.subscription_payments
  for select to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists "Authenticated insert subscription_payments" on public.subscription_payments;
create policy "Authenticated insert subscription_payments" on public.subscription_payments
  for insert to authenticated
  with check ((select auth.uid()) is not null);

drop policy if exists "Authenticated update subscription_payments" on public.subscription_payments;
create policy "Authenticated update subscription_payments" on public.subscription_payments
  for update to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

drop policy if exists "Authenticated delete subscription_payments" on public.subscription_payments;
create policy "Authenticated delete subscription_payments" on public.subscription_payments
  for delete to authenticated
  using ((select auth.uid()) is not null);
