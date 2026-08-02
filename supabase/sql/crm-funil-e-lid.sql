-- Reforma do funil + correção do endereçamento LID do WhatsApp.
--
-- Contexto medido no banco antes desta mudança:
--   * 45 mensagens recebidas em 20 conversas chegavam com JID "@lid"
--     (endereçamento opaco novo do WhatsApp) e ficavam órfãs — o CRM
--     mostrava "última mensagem: sua" mesmo com o lead tendo respondido.
--   * 15 clientes, todos parados em lead/contato_feito. Os 3 estágios
--     seguintes nunca foram usados, e "contato_feito" era marcado
--     automaticamente no envio, então não representava decisão nenhuma.
--   * crm_tasks e crm_notes: 0 linhas desde a criação.
--   * 65 das 72 conversas eram contatos pessoais pré-existentes do
--     celular, afogando a inbox de vendas.
--
-- Aplicado manualmente via Supabase SQL Editor / Management API — este repo
-- não tem migrations rastreadas. Projeto: ywbvybaeakptbaobrcte.

-- 1. Payload cru das mensagens. Diagnosticar o problema do LID exigiu ir
-- buscar na API da Evolution porque nada do que chegava era guardado.
alter table crm_whatsapp_mensagens
  add column if not exists raw jsonb;

-- 2. Origem da conversa: separa lead de prospecção do contato pessoal que
-- já existia no celular. Nulo = desconhecido (as conversas antigas).
alter table crm_whatsapp_chats
  add column if not exists origem text
    check (origem is null or origem in ('prospeccao', 'pessoal'));

-- Guarda o LID de origem quando a conversa foi fundida, para o webhook
-- reconhecer eventos futuros que ainda cheguem endereçados ao LID.
alter table crm_whatsapp_chats
  add column if not exists lid_jid text;

create index if not exists crm_whatsapp_chats_lid_jid_idx
  on crm_whatsapp_chats (lid_jid) where lid_jid is not null;

-- 3. Próximo passo, substituindo crm_tasks + crm_notes (ambas com 0 linhas).
-- Um campo com data resolve o que as duas telas prometiam e ninguém usou.
alter table crm_clients
  add column if not exists next_step text,
  add column if not exists next_step_at timestamptz;

-- 4. Novos estágios. Os antigos não refletiam a operação: agora "enviado"
-- é o estado real após o disparo e "respondeu" é preenchido sozinho pelo
-- webhook quando chega mensagem do lead — o funil anda sem arrastar card.
alter table crm_clients drop constraint if exists crm_clients_stage_check;

update crm_clients set stage = 'enviado'
  where stage in ('lead', 'contato_feito');
update crm_clients set stage = 'proposta'
  where stage = 'proposta_enviada';

-- Quem já tem mensagem recebida vai direto para "respondeu": o dado existe,
-- só não estava visível.
update crm_clients c set stage = 'respondeu'
where c.stage = 'enviado'
  and exists (
    select 1 from crm_whatsapp_chats ch
    join crm_whatsapp_mensagens m on m.remote_jid = ch.remote_jid
    where ch.client_id = c.id and m.from_me = false
  );

alter table crm_clients
  add constraint crm_clients_stage_check
  check (stage in ('enviado','respondeu','em_conversa','proposta','fechado','perdido'));

alter table crm_clients alter column stage set default 'enviado';
