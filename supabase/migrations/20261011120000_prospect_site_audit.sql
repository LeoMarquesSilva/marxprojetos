-- Auditoria do site do lead feita pelo robô com navegador (celular em 4G):
-- tempo para aparecer, layout no celular, botão de WhatsApp, prévia do link,
-- certificado... Vira a nota do site, entra na prioridade do lead e alimenta
-- o {{diagnostico}} da mensagem para quem já tem site.
alter table public.prospects
  add column if not exists site_audit jsonb,
  add column if not exists site_score smallint,
  add column if not exists site_audited_at timestamptz;

-- Modelo próprio para quem já tem site: cita o que a auditoria encontrou.
alter table public.prospecting_settings
  add column if not exists site_template text;
