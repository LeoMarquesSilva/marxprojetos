-- Adds: when the review was made available, an approval timestamp (client
-- clicks "aprovar, sem ajustes"), and an RPC to set it.

alter table projects
  add column if not exists review_enabled_at timestamptz,
  add column if not exists review_approved_at timestamptz;

create or replace function get_review_by_token(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'title', title,
    'review_site_path', review_site_path,
    'token', review_token,
    'review_enabled_at', review_enabled_at,
    'review_approved_at', review_approved_at
  ) into v_result
  from projects
  where review_token = p_token and review_enabled = true;
  return v_result;
end;
$$;
grant execute on function get_review_by_token(uuid) to anon;

create or replace function approve_review(p_token uuid)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_approved_at timestamptz;
begin
  update projects
  set review_approved_at = now()
  where review_token = p_token and review_enabled = true
  returning review_approved_at into v_approved_at;

  if v_approved_at is null then
    raise exception 'invalid or disabled review token';
  end if;

  return v_approved_at;
end;
$$;
grant execute on function approve_review(uuid) to anon;
