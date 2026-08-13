-- Aviso no WhatsApp quando o cliente aceita a proposta.
--
-- Esta coluna existe só para o aviso sair UMA vez. `accept_proposal` devolve
-- o `accepted_at` mesmo no segundo clique (é o estado atual da proposta, não
-- "acabei de aceitar"), então o retorno dela não serve para decidir se avisa.
-- Sem uma marca própria, cada reload ou retry mandaria outra mensagem.
--
-- A reserva é feita com um update condicional (`accept_notified_at is null`):
-- só quem conseguir marcar é que envia. Dois cliques simultâneos, retry de
-- rede ou reenvio do formulário disputam a mesma linha e só um ganha.
--
-- Não tem grant para anon: quem marca é a rota no servidor com service-role.
-- Se fosse uma RPC pública, qualquer um com o link poderia queimar a reserva
-- e me deixar sem o aviso.
--
-- Aplicado manualmente via Supabase SQL Editor / Management API — este repo
-- não tem migrations rastreadas. Projeto: ywbvybaeakptbaobrcte.

alter table proposals
  add column if not exists accept_notified_at timestamptz;
