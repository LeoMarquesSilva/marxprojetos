-- Lançamentos manuais de caixa: parcelas de projeto e gastos do estúdio.
--
-- Recorrência paga não entra aqui. O pagamento continua em
-- subscription_payments e a página de finanças soma os dois, para um mês
-- marcado como pago não precisar ser digitado de novo.

create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('entrada', 'saida')),
  amount numeric(10,2) not null check (amount > 0),
  occurred_on date not null default current_date,
  category text not null,
  description text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists finance_entries_occurred_idx
  on public.finance_entries (occurred_on desc);

alter table public.finance_entries enable row level security;

drop policy if exists "Authenticated select finance_entries" on public.finance_entries;
create policy "Authenticated select finance_entries" on public.finance_entries
  for select to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists "Owners insert finance_entries" on public.finance_entries;
create policy "Owners insert finance_entries" on public.finance_entries
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Authenticated update finance_entries" on public.finance_entries;
create policy "Authenticated update finance_entries" on public.finance_entries
  for update to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

drop policy if exists "Authenticated delete finance_entries" on public.finance_entries;
create policy "Authenticated delete finance_entries" on public.finance_entries
  for delete to authenticated
  using ((select auth.uid()) is not null);
