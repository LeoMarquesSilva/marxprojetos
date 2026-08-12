drop policy if exists "Anon upload briefing files" on storage.objects;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Anon upload briefing files'
  ) then
    raise exception 'Policy obsoleta de upload anônimo ainda presente';
  end if;
end
$$;;
