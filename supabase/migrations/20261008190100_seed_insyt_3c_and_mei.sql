-- Valores fixos do estúdio a partir de outubro/2026:
--   * 3C (Maria Clara) paga R$ 193,70 todo dia 13 — entra como recorrência;
--   * R$ 77,48 dessa mensalidade vão para o Samuel, sócio — gasto fixo
--     amarrado à recorrência, no mesmo dia 13;
--   * DAS do MEI de serviços em 2026: R$ 81,05 de INSS (5% do mínimo de
--     R$ 1.621) + R$ 5,00 de ISS = R$ 86,05, vence todo dia 20.
--
-- O dono é o mesmo das recorrências já cadastradas. Idempotente: rodar de
-- novo não duplica nada.

with owner as (
  select owner_id from public.subscriptions order by created_at limit 1
)
insert into public.subscriptions (
  owner_id, client_name, plan_name, amount, billing_day, status, started_on,
  payment_method, notes
)
select
  owner.owner_id,
  '3C (Maria Clara)',
  'Mensalidade INSYT',
  193.70,
  13,
  'ativa',
  '2026-10-01',
  'Pix',
  'Mensalidade paga pela Maria Clara, da 3C, todo dia 13. Desse valor, R$ 77,48 vão para o Samuel como sócio (lançado em Finanças → Gastos fixos).'
from owner
where not exists (
  select 1 from public.subscriptions where client_name = '3C (Maria Clara)'
);

with owner as (
  select owner_id from public.subscriptions order by created_at limit 1
)
insert into public.finance_recurring_expenses (
  owner_id, description, category, amount, due_day, started_on, subscription_id, notes
)
select
  owner.owner_id,
  'Repasse do Samuel (sócio) — 3C',
  'Repasse a sócio',
  77.48,
  13,
  '2026-10-01',
  (select id from public.subscriptions where client_name = '3C (Maria Clara)' limit 1),
  'Parte do Samuel na mensalidade de R$ 193,70 da 3C.'
from owner
where not exists (
  select 1 from public.finance_recurring_expenses
  where description = 'Repasse do Samuel (sócio) — 3C'
);

with owner as (
  select owner_id from public.subscriptions order by created_at limit 1
)
insert into public.finance_recurring_expenses (
  owner_id, description, category, amount, due_day, started_on, notes
)
select
  owner.owner_id,
  'DAS do MEI',
  'Imposto',
  86.05,
  20,
  '2026-10-01',
  'MEI de serviços em 2026: R$ 81,05 de INSS + R$ 5,00 de ISS. A guia do dia 20 paga a competência do mês anterior. Muda todo ano junto com o salário mínimo.'
from owner
where not exists (
  select 1 from public.finance_recurring_expenses where description = 'DAS do MEI'
);
