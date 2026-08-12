drop policy if exists "Authenticated download own files" on storage.objects;
drop policy if exists "Anon read uploaded files temporarily" on storage.objects;

drop policy if exists "Authenticated read own briefing files" on storage.objects;
create policy "Authenticated read own briefing files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'briefing-files'
    and owner_id = (select auth.uid()::text)
  );

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated read own briefing files'
      and cmd = 'SELECT'
      and 'authenticated' = any (roles)
  ) then
    raise exception 'Policy restrita de leitura do briefing-files ausente';
  end if;
end
$$;;
