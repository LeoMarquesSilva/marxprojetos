-- Parcelas com data de um projeto comum: o que foi combinado com o cliente.
-- Com data, a parcela aparece em "A receber" e entra na projeção de caixa; sem
-- isso, o que falta receber do projeto fica sem previsão nenhuma.
--
-- Lista de { dueOn, amount, label? } lida por src/lib/project-schedule.ts. O que
-- entra no projeto abate da parcela mais antiga para a mais nova.

alter table public.projects
  add column if not exists payment_schedule jsonb
    check (payment_schedule is null or jsonb_typeof(payment_schedule) = 'array');

-- Implantação da Camila (sistema + 3 sites, R$ 4.500): entrada de R$ 1.500 em
-- 10/11/2026 e 4x de R$ 750, como registrado na assinatura e no CRM.
-- Idempotente: não sobrescreve o que já tiver sido editado na tela.
update public.projects
set payment_schedule = '[
  {"dueOn": "2026-11-10", "amount": 1500, "label": "entrada"},
  {"dueOn": "2026-12-10", "amount": 750},
  {"dueOn": "2027-01-10", "amount": 750},
  {"dueOn": "2027-02-10", "amount": 750},
  {"dueOn": "2027-03-10", "amount": 750}
]'::jsonb
where title = 'Site Camila Gracioli' and payment_schedule is null;
