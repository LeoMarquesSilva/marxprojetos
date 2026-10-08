-- Lançamento ligado a projeto: parcela recebida (ou custo, como freelancer)
-- fica amarrada ao site. Com o valor fechado no projeto, Finanças mostra
-- quanto já entrou e quanto falta receber de cada um.

alter table public.finance_entries
  add column if not exists project_id uuid
    references public.projects(id) on delete set null;

create index if not exists finance_entries_project_idx
  on public.finance_entries (project_id)
  where project_id is not null;

-- Valor fechado do desenvolvimento (o que foi combinado na proposta).
alter table public.projects
  add column if not exists contract_amount numeric(10,2)
    check (contract_amount is null or contract_amount >= 0);

-- Outeiral: R$ 1.297,00 combinados (nota da recorrência, 08/10/2026).
update public.projects
set contract_amount = 1297.00
where title = 'Outeiral Advocacia - Site' and contract_amount is null;
