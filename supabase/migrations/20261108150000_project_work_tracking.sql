-- Acompanhamento de produção do projeto, separado do status do briefing
-- (projects.status diz se o cliente respondeu; aqui é o andamento do trabalho).
-- Null em work_status quer dizer que o projeto ainda não foi classificado.
--
-- delivered_on registra quando o projeto foi concluído: com o prazo (due_on),
-- dá a taxa de entrega no prazo.

alter table public.projects
  add column if not exists work_status text
    check (work_status is null or work_status in ('em_andamento', 'em_revisao', 'concluido', 'pausado')),
  add column if not exists due_on date,
  add column if not exists delivered_on date;

-- Situação que já está registrada em outros lugares. O resto fica sem status
-- até ser classificado na tela. Idempotente: não sobrescreve o que foi editado.

-- Observações da assinatura: "Site publicado em 08/10/2026".
update public.projects
set work_status = 'concluido', delivered_on = '2026-10-08'
where title = 'Outeiral Advocacia - Site' and work_status is null;

-- Site no ar desde 27/10/2026.
update public.projects
set work_status = 'concluido', delivered_on = '2026-10-27'
where title = 'Novo site — LZ Advogados' and work_status is null;

-- Contrato assinado e lançamento previsto para jan/2027, sem data fechada.
update public.projects
set work_status = 'em_andamento'
where title = 'Loja online — Olivetto' and work_status is null;

-- Implantação em curso, com parcelas até março de 2027.
update public.projects
set work_status = 'em_andamento'
where title = 'Site Camila Gracioli' and work_status is null;
