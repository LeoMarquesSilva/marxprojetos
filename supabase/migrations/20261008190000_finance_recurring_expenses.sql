-- Gastos fixos: o que sai todo mês (DAS do MEI, repasse de sócio,
-- ferramentas). Mesmo desenho da recorrência: a regra diz quanto e quando
-- sai; cada pagamento vira um lançamento em finance_entries com o mês de
-- referência. Assim o caixa continua tendo uma fonte só para o que saiu, e
-- "o que falta pagar" sai da diferença entre meses devidos e meses pagos.

create table if not exists public.finance_recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  category text not null,
  amount numeric(10,2) not null check (amount > 0),
  -- Até 28 para todo mês ter o dia, inclusive fevereiro.
  due_day smallint not null check (due_day between 1 and 28),
  started_on date not null default current_date,
  -- Meses com vencimento a partir desta data deixam de ser cobrados.
  ended_on date,
  -- Repasse amarrado a uma recorrência (ex.: parte do sócio numa mensalidade).
  subscription_id uuid references public.subscriptions(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_on is null or ended_on >= started_on)
);

alter table public.finance_entries
  add column if not exists recurring_expense_id uuid
    references public.finance_recurring_expenses(id) on delete set null,
  add column if not exists reference_month date
    check (reference_month is null or extract(day from reference_month) = 1);

-- Um pagamento por mês por gasto fixo: clique duplo não vira gasto dobrado.
create unique index if not exists finance_entries_recurring_month_idx
  on public.finance_entries (recurring_expense_id, reference_month)
  where recurring_expense_id is not null;

alter table public.finance_recurring_expenses enable row level security;

drop policy if exists "Authenticated select finance_recurring_expenses" on public.finance_recurring_expenses;
create policy "Authenticated select finance_recurring_expenses" on public.finance_recurring_expenses
  for select to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists "Owners insert finance_recurring_expenses" on public.finance_recurring_expenses;
create policy "Owners insert finance_recurring_expenses" on public.finance_recurring_expenses
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Authenticated update finance_recurring_expenses" on public.finance_recurring_expenses;
create policy "Authenticated update finance_recurring_expenses" on public.finance_recurring_expenses
  for update to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

drop policy if exists "Authenticated delete finance_recurring_expenses" on public.finance_recurring_expenses;
create policy "Authenticated delete finance_recurring_expenses" on public.finance_recurring_expenses
  for delete to authenticated
  using ((select auth.uid()) is not null);
