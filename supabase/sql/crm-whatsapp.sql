-- WhatsApp por cliente do CRM, via Evolution API.
--
-- Baseado no padrão usado em financeiro-bp (módulo de cobrança): mensagens
-- ficam em uma tabela própria, cada conversa é identificada pelo remote_jid
-- do WhatsApp, e o vínculo com o cliente é feito casando o telefone
-- cadastrado com o número do JID. Diferente de financeiro-bp, este é um v1
-- deliberadamente mais simples: só texto (sem mídia, áudio, reações ou
-- grupos) e sem tabela de log de disparo em lote, porque aqui o uso é
-- conversa 1:1 de acompanhamento de venda, não cobrança em massa.
--
-- Aplicado manualmente via Supabase SQL Editor / Management API — este repo
-- não tem migrations rastreadas. Projeto: ywbvybaeakptbaobrcte.

create table if not exists crm_whatsapp_chats (
  remote_jid text primary key,
  client_id uuid references crm_clients(id) on delete set null,
  instance text,
  push_name text,
  last_message_at timestamptz,
  last_message_preview text,
  unread_count int not null default 0,
  updated_at timestamptz not null default now()
);

alter table crm_whatsapp_chats enable row level security;

drop policy if exists "Authenticated select crm_whatsapp_chats" on crm_whatsapp_chats;
create policy "Authenticated select crm_whatsapp_chats" on crm_whatsapp_chats
  for select using (auth.uid() is not null);

drop policy if exists "Authenticated insert crm_whatsapp_chats" on crm_whatsapp_chats;
create policy "Authenticated insert crm_whatsapp_chats" on crm_whatsapp_chats
  for insert with check (auth.uid() is not null);

drop policy if exists "Authenticated update crm_whatsapp_chats" on crm_whatsapp_chats;
create policy "Authenticated update crm_whatsapp_chats" on crm_whatsapp_chats
  for update using (auth.uid() is not null);

create table if not exists crm_whatsapp_mensagens (
  id uuid primary key default gen_random_uuid(),
  remote_jid text not null references crm_whatsapp_chats(remote_jid) on delete cascade,
  client_id uuid references crm_clients(id) on delete set null,
  from_me boolean not null default false,
  conteudo text,
  status text not null default 'pending'
    check (status in ('pending','server_ack','delivery_ack','read','played','error')),
  provider_message_id text,
  erro text,
  created_at timestamptz not null default now()
);

-- Evita duplicar mensagem quando o webhook reenvia o mesmo evento (comum em
-- Evolution/Baileys durante reconexão). Sem cláusula "where": um índice
-- único parcial não pode ser alvo de ON CONFLICT via PostgREST/Supabase —
-- e não precisamos da cláusula mesmo assim, já que Postgres trata cada NULL
-- como distinto em um índice único (múltiplas linhas sem provider_message_id
-- continuam permitidas).
create unique index if not exists crm_whatsapp_mensagens_provider_message_id_key
  on crm_whatsapp_mensagens (provider_message_id);

create index if not exists crm_whatsapp_mensagens_remote_jid_idx
  on crm_whatsapp_mensagens (remote_jid, created_at);

alter table crm_whatsapp_mensagens enable row level security;

drop policy if exists "Authenticated select crm_whatsapp_mensagens" on crm_whatsapp_mensagens;
create policy "Authenticated select crm_whatsapp_mensagens" on crm_whatsapp_mensagens
  for select using (auth.uid() is not null);

drop policy if exists "Authenticated insert crm_whatsapp_mensagens" on crm_whatsapp_mensagens;
create policy "Authenticated insert crm_whatsapp_mensagens" on crm_whatsapp_mensagens
  for insert with check (auth.uid() is not null);

drop policy if exists "Authenticated update crm_whatsapp_mensagens" on crm_whatsapp_mensagens;
create policy "Authenticated update crm_whatsapp_mensagens" on crm_whatsapp_mensagens
  for update using (auth.uid() is not null);

-- Mensagens novas aparecem na tela sem o usuário precisar recarregar a
-- página (idempotente: só adiciona se ainda não estiver na publicação).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'crm_whatsapp_mensagens'
  ) then
    alter publication supabase_realtime add table crm_whatsapp_mensagens;
  end if;
end $$;
