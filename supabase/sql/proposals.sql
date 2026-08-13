-- Propostas comerciais com link público e leitura rastreada.
--
-- Mesma ideia do link de revisão (/r/<token>): o cliente abre sem login, e a
-- fronteira pública é uma RPC security definer com allowlist de colunas —
-- nunca abrir RLS para anon. Aqui, além de ler, o visitante grava a própria
-- sessão de leitura, então existe uma RPC de escrita também, restrita a
-- atualizar métricas da sessão dela mesma.
--
-- O conteúdo fica em JSONB de blocos tipados em vez de colunas fixas: cada
-- proposta tem seções diferentes, e criar coluna por seção não escala.
--
-- Aplicado manualmente via Supabase SQL Editor / Management API — este repo
-- não tem migrations rastreadas. Projeto: ywbvybaeakptbaobrcte.

create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  crm_client_id uuid references crm_clients(id) on delete set null,
  -- Token separado do id: o id vaza em log/URL interna, e o link público
  -- deve poder ser revogado sem perder a proposta.
  token uuid not null default gen_random_uuid() unique,
  title text not null,
  subtitle text,
  client_name text not null,
  status text not null default 'rascunho'
    check (status in ('rascunho','enviada','aceita','recusada')),
  -- Só propostas publicadas abrem pelo link. Rascunho fica invisível mesmo
  -- para quem tiver o token.
  published boolean not null default false,
  content jsonb not null default '[]'::jsonb,
  valid_until date,
  sent_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table proposals enable row level security;

drop policy if exists "Authenticated select proposals" on proposals;
create policy "Authenticated select proposals" on proposals
  for select using (auth.uid() is not null);

drop policy if exists "Owners insert proposals" on proposals;
create policy "Owners insert proposals" on proposals
  for insert with check (auth.uid() = owner_id);

drop policy if exists "Authenticated update proposals" on proposals;
create policy "Authenticated update proposals" on proposals
  for update using (auth.uid() is not null);

drop policy if exists "Authenticated delete proposals" on proposals;
create policy "Authenticated delete proposals" on proposals
  for delete using (auth.uid() is not null);

-- Uma linha por sessão de leitura (aba aberta). Duas visitas do mesmo
-- cliente em dias diferentes são duas linhas — é isso que responde
-- "quantas vezes ele abriu".
create table if not exists proposal_sessions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  -- Segundos com a aba realmente visível, não tempo de janela aberta.
  seconds_reading int not null default 0,
  max_scroll_percent int not null default 0,
  sections_seen text[] not null default '{}',
  reached_end boolean not null default false,
  -- User agent cru é suficiente para distinguir celular de desktop. IP não
  -- é guardado: é dado pessoal e não acrescenta nada à decisão de venda.
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists proposal_sessions_proposal_idx
  on proposal_sessions (proposal_id, started_at desc);

alter table proposal_sessions enable row level security;

drop policy if exists "Authenticated select proposal_sessions" on proposal_sessions;
create policy "Authenticated select proposal_sessions" on proposal_sessions
  for select using (auth.uid() is not null);

-- Leitura pública da proposta. Allowlist explícita: sem owner_id, sem
-- crm_client_id, sem o próprio token.
create or replace function public.get_proposal_by_token(p_token uuid)
returns table (
  id uuid,
  title text,
  subtitle text,
  client_name text,
  status text,
  content jsonb,
  valid_until date,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select p.id, p.title, p.subtitle, p.client_name, p.status, p.content,
         p.valid_until, p.created_at
  from public.proposals p
  where p.token = p_token and p.published = true;
$$;

revoke execute on function public.get_proposal_by_token(uuid) from public;
grant execute on function public.get_proposal_by_token(uuid) to anon, authenticated;

-- Abre uma sessão de leitura e devolve o id para os heartbeats seguintes.
-- Recebe o token (não o id da proposta) para o visitante não precisar
-- conhecer o id interno.
create or replace function public.start_proposal_session(
  p_token uuid,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal_id uuid;
  v_session_id uuid;
begin
  select id into v_proposal_id
  from public.proposals
  where token = p_token and published = true;

  if v_proposal_id is null then
    return null;
  end if;

  insert into public.proposal_sessions (proposal_id, user_agent)
  values (v_proposal_id, left(coalesce(p_user_agent, ''), 400))
  returning id into v_session_id;

  return v_session_id;
end;
$$;

revoke execute on function public.start_proposal_session(uuid, text) from public;
grant execute on function public.start_proposal_session(uuid, text) to anon, authenticated;

-- Heartbeat. As métricas só sobem (greatest/union), então reenvio fora de
-- ordem ou repetido não corrompe o número — e ninguém consegue "zerar" a
-- leitura de outra sessão mandando valores menores.
create or replace function public.track_proposal_session(
  p_session_id uuid,
  p_seconds int,
  p_scroll_percent int,
  p_sections text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.proposal_sessions
  set seconds_reading = greatest(seconds_reading, coalesce(p_seconds, 0)),
      max_scroll_percent = least(
        100,
        greatest(max_scroll_percent, coalesce(p_scroll_percent, 0))
      ),
      sections_seen = (
        select coalesce(array_agg(distinct s), '{}')
        from unnest(sections_seen || coalesce(p_sections, '{}')) as s
      ),
      reached_end = reached_end
        or least(100, coalesce(p_scroll_percent, 0)) >= 95,
      last_seen_at = now()
  where id = p_session_id;
end;
$$;

revoke execute on function public.track_proposal_session(uuid, int, int, text[]) from public;
grant execute on function public.track_proposal_session(uuid, int, int, text[]) to anon, authenticated;
