-- Perfil WhatsApp + nota rápida na conversa
alter table crm_whatsapp_chats
  add column if not exists profile_picture_url text,
  add column if not exists profile_status text,
  add column if not exists profile_name text,
  add column if not exists inbox_note text,
  add column if not exists profile_fetched_at timestamptz;

-- Reações e id do provider já usados no upsert do webhook
alter table crm_whatsapp_mensagens
  add column if not exists reactions jsonb not null default '[]'::jsonb;

-- Realtime na lista de chats (prévia, unread, avatar)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'crm_whatsapp_chats'
  ) then
    alter publication supabase_realtime add table crm_whatsapp_chats;
  end if;
end $$;;
