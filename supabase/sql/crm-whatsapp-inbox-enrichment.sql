-- Perfil WhatsApp (avatar/status), nota na inbox e reações.
-- Aplicado via Supabase MCP: crm_whatsapp_inbox_enrichment

alter table crm_whatsapp_chats
  add column if not exists profile_picture_url text,
  add column if not exists profile_status text,
  add column if not exists profile_name text,
  add column if not exists inbox_note text,
  add column if not exists profile_fetched_at timestamptz;

alter table crm_whatsapp_mensagens
  add column if not exists reactions jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'crm_whatsapp_chats'
  ) then
    alter publication supabase_realtime add table crm_whatsapp_chats;
  end if;
end $$;
