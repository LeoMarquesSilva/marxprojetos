-- Aceite da proposta pelo próprio cliente, direto no link.
--
-- Guardamos quem aceitou e quando. Não guardamos IP: mantém a mesma linha
-- do rastreamento de leitura, e o par nome + horário já é o que serve para
-- confirmar o aceite numa conversa.
--
-- Aplicado manualmente via Supabase SQL Editor / Management API — este repo
-- não tem migrations rastreadas. Projeto: ywbvybaeakptbaobrcte.

alter table proposals
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_by_name text;

-- A RPC pública devolve o aceite junto, para a página já abrir no estado
-- confirmado em vez de oferecer aceitar de novo.
drop function if exists public.get_proposal_by_token(uuid);

create function public.get_proposal_by_token(p_token uuid)
returns table (
  id uuid,
  title text,
  subtitle text,
  client_name text,
  status text,
  content jsonb,
  valid_until date,
  accepted_at timestamptz,
  accepted_by_name text,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select p.id, p.title, p.subtitle, p.client_name, p.status, p.content,
         p.valid_until, p.accepted_at, p.accepted_by_name, p.created_at
  from public.proposals p
  where p.token = p_token and p.published = true;
$$;

revoke execute on function public.get_proposal_by_token(uuid) from public;
grant execute on function public.get_proposal_by_token(uuid) to anon, authenticated;

-- Idempotente: "where accepted_at is null" faz o segundo clique não
-- sobrescrever quem aceitou primeiro nem mover a data.
create or replace function public.accept_proposal(
  p_token uuid,
  p_name text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_accepted timestamptz;
begin
  if v_name is null then
    return null;
  end if;

  update public.proposals
  set accepted_at = now(),
      accepted_by_name = left(v_name, 120),
      status = 'aceita',
      decided_at = now(),
      updated_at = now()
  where token = p_token
    and published = true
    and accepted_at is null;

  select accepted_at into v_accepted
  from public.proposals
  where token = p_token and published = true;

  return v_accepted;
end;
$$;

revoke execute on function public.accept_proposal(uuid, text) from public;
grant execute on function public.accept_proposal(uuid, text) to anon, authenticated;
