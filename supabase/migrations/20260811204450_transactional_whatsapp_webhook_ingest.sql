alter table public.crm_whatsapp_mensagens
  add column if not exists unread_counted boolean not null default true;

alter table public.crm_whatsapp_mensagens
  alter column unread_counted set default false;

create or replace function public.enforce_crm_whatsapp_status_monotonic()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_old_rank smallint;
  v_new_rank smallint;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'error' then
    if old.status not in ('pending', 'error') then
      new.status := old.status;
      new.erro := old.erro;
    end if;
    return new;
  end if;

  if old.status = 'error' then
    if new.status = 'pending' then
      new.status := old.status;
    end if;
    return new;
  end if;

  v_old_rank := case old.status
    when 'pending' then 0
    when 'server_ack' then 1
    when 'delivery_ack' then 2
    when 'read' then 3
    when 'played' then 4
  end;
  v_new_rank := case new.status
    when 'pending' then 0
    when 'server_ack' then 1
    when 'delivery_ack' then 2
    when 'read' then 3
    when 'played' then 4
  end;

  if v_new_rank < v_old_rank then
    new.status := old.status;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_crm_whatsapp_status_monotonic()
  from public, anon, authenticated;

drop trigger if exists crm_whatsapp_mensagens_status_monotonic
  on public.crm_whatsapp_mensagens;

create trigger crm_whatsapp_mensagens_status_monotonic
before update of status on public.crm_whatsapp_mensagens
for each row
execute function public.enforce_crm_whatsapp_status_monotonic();

create or replace function public.ingest_crm_whatsapp_message(
  p_remote_jid text,
  p_client_id uuid,
  p_from_me boolean,
  p_conteudo text,
  p_status text,
  p_provider_message_id text,
  p_raw jsonb,
  p_instance text,
  p_push_name text,
  p_lid_jid text,
  p_message_at timestamptz
)
returns table (
  message_id uuid,
  inserted boolean,
  unread_incremented boolean
)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_inserted boolean := false;
  v_unread_incremented boolean := false;
begin
  if p_provider_message_id is null or btrim(p_provider_message_id) = '' then
    raise exception using
      errcode = '22023',
      message = 'provider_message_id is required';
  end if;

  if p_status not in (
    'pending',
    'server_ack',
    'delivery_ack',
    'read',
    'played',
    'error'
  ) then
    raise exception using errcode = '22023', message = 'invalid message status';
  end if;

  insert into public.crm_whatsapp_chats as chat (
    remote_jid,
    client_id,
    instance,
    push_name,
    last_message_at,
    last_message_preview,
    unread_count,
    origem,
    lid_jid,
    updated_at
  )
  values (
    p_remote_jid,
    p_client_id,
    p_instance,
    nullif(p_push_name, ''),
    p_message_at,
    left(p_conteudo, 140),
    0,
    case when p_client_id is null then 'pessoal' else 'prospeccao' end,
    p_lid_jid,
    now()
  )
  on conflict (remote_jid) do update
  set
    client_id = coalesce(excluded.client_id, chat.client_id),
    instance = coalesce(excluded.instance, chat.instance),
    push_name = coalesce(excluded.push_name, chat.push_name),
    origem = coalesce(
      chat.origem,
      case
        when coalesce(excluded.client_id, chat.client_id) is null
          then 'pessoal'
        else 'prospeccao'
      end
    ),
    lid_jid = coalesce(excluded.lid_jid, chat.lid_jid),
    last_message_at = case
      when chat.last_message_at is null
        or excluded.last_message_at >= chat.last_message_at
        then excluded.last_message_at
      else chat.last_message_at
    end,
    last_message_preview = case
      when chat.last_message_at is null
        or excluded.last_message_at >= chat.last_message_at
        then excluded.last_message_preview
      else chat.last_message_preview
    end,
    updated_at = now();

  insert into public.crm_whatsapp_mensagens (
    remote_jid,
    client_id,
    from_me,
    conteudo,
    status,
    provider_message_id,
    raw,
    unread_counted
  )
  values (
    p_remote_jid,
    (
      select coalesce(p_client_id, chat.client_id)
      from public.crm_whatsapp_chats as chat
      where chat.remote_jid = p_remote_jid
    ),
    p_from_me,
    p_conteudo,
    p_status,
    p_provider_message_id,
    p_raw,
    p_from_me
  )
  on conflict (provider_message_id) do nothing
  returning id into message_id;

  v_inserted := message_id is not null;

  if not v_inserted then
    update public.crm_whatsapp_mensagens as message
    set
      remote_jid = p_remote_jid,
      client_id = coalesce(
        p_client_id,
        message.client_id,
        (
          select chat.client_id
          from public.crm_whatsapp_chats as chat
          where chat.remote_jid = p_remote_jid
        )
      ),
      from_me = p_from_me,
      conteudo = p_conteudo,
      status = p_status,
      raw = coalesce(p_raw, message.raw)
    where message.provider_message_id = p_provider_message_id
    returning message.id into message_id;
  end if;

  if not p_from_me then
    update public.crm_whatsapp_mensagens as message
    set unread_counted = true
    where message.provider_message_id = p_provider_message_id
      and message.unread_counted = false
    returning true into v_unread_incremented;

    v_unread_incremented := coalesce(v_unread_incremented, false);
  end if;

  update public.crm_whatsapp_chats as chat
  set
    unread_count = case
      when p_from_me then 0
      when v_unread_incremented then chat.unread_count + 1
      else chat.unread_count
    end,
    updated_at = now()
  where chat.remote_jid = p_remote_jid;

  inserted := v_inserted;
  unread_incremented := v_unread_incremented;
  return next;
end;
$$;

revoke all on function public.ingest_crm_whatsapp_message(
  text,
  uuid,
  boolean,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  text,
  timestamptz
) from public, anon, authenticated;

grant execute on function public.ingest_crm_whatsapp_message(
  text,
  uuid,
  boolean,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  text,
  timestamptz
) to service_role;;
