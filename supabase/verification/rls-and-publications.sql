-- Auditoria somente leitura. Execute com ON_ERROR_STOP para falhar ao detectar
-- tabela pública sem RLS, tabela protegida sem policy ou publicação obrigatória
-- ausente.

select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  count(p.polname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
group by n.nspname, c.relname, c.relrowsecurity
order by c.relname;

select pubname, schemaname, tablename
from pg_publication_tables
where schemaname = 'public'
order by pubname, tablename;

do $$
declare
  tables_without_rls text;
  tables_without_policies text;
  missing_realtime_tables text;
begin
  select string_agg(
    format('%I.%I', n.nspname, c.relname),
    ', ' order by n.nspname, c.relname
  )
  into tables_without_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and not c.relrowsecurity;

  if tables_without_rls is not null then
    raise exception 'Tabelas públicas sem RLS: %', tables_without_rls;
  end if;

  select string_agg(
    format('%I.%I', n.nspname, c.relname),
    ', ' order by n.nspname, c.relname
  )
  into tables_without_policies
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relrowsecurity
    and not exists (
      select 1
      from pg_policy p
      where p.polrelid = c.oid
    );

  if tables_without_policies is not null then
    raise exception 'Tabelas com RLS e sem policies: %', tables_without_policies;
  end if;

  with expected(table_name) as (
    values
      ('crm_whatsapp_chats'),
      ('crm_whatsapp_mensagens')
  )
  select string_agg(expected.table_name, ', ' order by expected.table_name)
  into missing_realtime_tables
  from expected
  where not exists (
    select 1
    from pg_publication_tables published
    where published.pubname = 'supabase_realtime'
      and published.schemaname = 'public'
      and published.tablename = expected.table_name
  );

  if missing_realtime_tables is not null then
    raise exception
      'Tabelas ausentes da publicação supabase_realtime: %',
      missing_realtime_tables;
  end if;
end
$$;
