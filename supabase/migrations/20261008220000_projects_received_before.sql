-- Parte do valor fechado recebida antes de Finanças existir: abate o que
-- falta receber do projeto, mas não vira lançamento — não mexe no caixa de
-- meses antigos nem na projeção.

alter table public.projects
  add column if not exists received_before numeric(10,2) not null default 0
    check (received_before >= 0);

-- Outeiral: a primeira metade (R$ 648,50) já tinha sido recebida.
update public.projects
set received_before = 648.50
where title = 'Outeiral Advocacia - Site' and received_before = 0;
