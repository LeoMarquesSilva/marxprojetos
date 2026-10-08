-- Base da projeção de caixa: quanto havia na conta numa data conferida no
-- banco. Saldo de hoje = esse valor + o que entrou − o que saiu depois da
-- data. Sem isso a projeção só sabe somar meses, não quanto vai ter.
--
-- Uma linha só para o workspace (mesmo modelo compartilhado do resto).

create table if not exists public.finance_settings (
  id boolean primary key default true check (id),
  balance_amount numeric(12,2) not null default 0,
  -- Dia em que o saldo foi conferido no banco (fim do dia).
  balance_on date not null default current_date,
  -- Reserva mínima: a projeção avisa o primeiro mês que fica abaixo dela.
  reserve_amount numeric(12,2) not null default 0 check (reserve_amount >= 0),
  updated_at timestamptz not null default now()
);

alter table public.finance_settings enable row level security;

drop policy if exists "Authenticated select finance_settings" on public.finance_settings;
create policy "Authenticated select finance_settings" on public.finance_settings
  for select to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists "Authenticated insert finance_settings" on public.finance_settings;
create policy "Authenticated insert finance_settings" on public.finance_settings
  for insert to authenticated
  with check ((select auth.uid()) is not null);

drop policy if exists "Authenticated update finance_settings" on public.finance_settings;
create policy "Authenticated update finance_settings" on public.finance_settings
  for update to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);
