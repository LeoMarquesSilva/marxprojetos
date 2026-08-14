-- Verificação de quais leads realmente têm WhatsApp.
--
-- `is_mobile` é só um palpite pela quantidade de dígitos, e erra nos dois
-- sentidos: escritório com WhatsApp Business em linha fixa existe, e celular
-- sem WhatsApp também. Tentar enviar para descobrir gastava um clique e
-- devolvia erro — agora a Evolution responde isso direto, sem mandar
-- mensagem nenhuma.
--
-- Três estados, e por isso a coluna é nullable: null = nunca verificado,
-- true = tem, false = não tem. Sem o nulo, "não verificado" e "não tem"
-- ficariam iguais na tela.
--
-- Aplicado manualmente via Supabase SQL Editor / Management API — este repo
-- não tem migrations rastreadas. Projeto: ywbvybaeakptbaobrcte.

alter table prospects
  add column if not exists has_whatsapp boolean,
  add column if not exists whatsapp_checked_at timestamptz;

-- A verificação varre os leads ainda não checados; o índice evita varredura
-- completa da tabela a cada rodada.
create index if not exists prospects_whatsapp_pendente_idx
  on prospects (whatsapp_checked_at)
  where phone_e164 is not null;
