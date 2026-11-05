-- Projeto em sociedade: o cliente paga a um dos sócios ("quem recebe"), que
-- tira os custos do mês e divide o lucro pela porcentagem de cada um. No
-- caixa de Finanças só entra a minha parte, quando o sócio repassa — como
-- lançamento ligado ao projeto.
--
-- O plano inteiro (sócios, parcelas, mensalidade, custos estimados e os
-- meses que o cliente já pagou) fica num jsonb lido por
-- src/lib/project-partnership.ts. Null nos projetos só meus.

alter table public.projects
  add column if not exists partnership jsonb
    check (partnership is null or jsonb_typeof(partnership) = 'object');
