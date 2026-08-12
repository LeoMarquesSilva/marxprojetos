-- Seed system templates
INSERT INTO briefing_templates (slug, name, description, project_type, is_system, questions) VALUES
(
  'site-institucional',
  'Site Institucional',
  'Briefing completo para sites corporativos e institucionais',
  'website',
  true,
  '[
    {"id":"empresa","type":"text","label":"Nome da empresa","required":true,"section":"Sobre o negócio"},
    {"id":"segmento","type":"text","label":"Segmento / nicho de atuação","required":true,"section":"Sobre o negócio"},
    {"id":"sobre","type":"textarea","label":"Descreva a empresa em poucas linhas","required":true,"section":"Sobre o negócio","placeholder":"O que vocês fazem, para quem, há quanto tempo..."},
    {"id":"diferencial","type":"textarea","label":"Principal diferencial competitivo","required":false,"section":"Sobre o negócio"},
    {"id":"publico","type":"textarea","label":"Público-alvo ideal","required":true,"section":"Público e objetivos"},
    {"id":"objetivo","type":"textarea","label":"Qual o principal objetivo do site?","required":true,"section":"Público e objetivos","placeholder":"Ex: gerar leads, credibilidade, vendas..."},
    {"id":"paginas","type":"textarea","label":"Quais páginas/seções o site precisa ter?","required":true,"section":"Estrutura"},
    {"id":"referencias","type":"links","label":"Sites de referência (links)","required":false,"section":"Visual e referências","placeholder":"Cole links separados por linha"},
    {"id":"cores","type":"text","label":"Cores preferidas ou da marca","required":false,"section":"Visual e referências"},
    {"id":"logo","type":"file","label":"Logo da empresa","required":false,"section":"Visual e referências","accept":"image/*,.pdf,.svg"},
    {"id":"materiais","type":"file","label":"Materiais visuais (fotos, PDFs, brandbook)","required":false,"section":"Visual e referências","accept":"image/*,.pdf","multiple":true},
    {"id":"conteudo","type":"select","label":"Quem fornece os textos?","required":true,"section":"Conteúdo","options":["Cliente fornece tudo","Cliente fornece rascunho, vocês refinam","Vocês criam do zero"]},
    {"id":"dominio","type":"text","label":"Domínio desejado (se já tiver)","required":false,"section":"Técnico"},
    {"id":"integracoes","type":"textarea","label":"Integrações necessárias","required":false,"section":"Técnico","placeholder":"WhatsApp, CRM, formulários, pagamento..."},
    {"id":"prazo","type":"text","label":"Prazo desejado","required":false,"section":"Técnico"},
    {"id":"observacoes","type":"textarea","label":"Observações adicionais","required":false,"section":"Extras"}
  ]'::jsonb
),
(
  'landing-page',
  'Landing Page',
  'Briefing focado em conversão para landing pages',
  'landing_page',
  true,
  '[
    {"id":"produto","type":"text","label":"Nome do produto/serviço","required":true,"section":"Oferta"},
    {"id":"proposta","type":"textarea","label":"Proposta de valor principal","required":true,"section":"Oferta","placeholder":"Em uma frase: por que alguém deveria comprar/contratar?"},
    {"id":"publico","type":"textarea","label":"Público-alvo","required":true,"section":"Oferta"},
    {"id":"dor","type":"textarea","label":"Qual dor/problema você resolve?","required":true,"section":"Oferta"},
    {"id":"cta","type":"text","label":"Ação principal desejada (CTA)","required":true,"section":"Conversão","placeholder":"Ex: Comprar, Agendar demo, Baixar e-book..."},
    {"id":"oferta_especial","type":"textarea","label":"Oferta, promoção ou bônus","required":false,"section":"Conversão"},
    {"id":"provas","type":"textarea","label":"Provas sociais disponíveis","required":false,"section":"Conversão","placeholder":"Depoimentos, números, logos de clientes..."},
    {"id":"referencias","type":"links","label":"LPs de referência (links)","required":false,"section":"Visual"},
    {"id":"logo","type":"file","label":"Logo","required":false,"section":"Visual","accept":"image/*,.pdf,.svg"},
    {"id":"imagens","type":"file","label":"Imagens do produto/equipe","required":false,"section":"Visual","accept":"image/*","multiple":true},
    {"id":"pixel","type":"select","label":"Vai usar tráfego pago?","required":true,"section":"Tracking","options":["Sim, Meta Ads","Sim, Google Ads","Sim, ambos","Não / orgânico apenas"]},
    {"id":"integracoes","type":"textarea","label":"Integrações (CRM, checkout, email...)","required":false,"section":"Tracking"},
    {"id":"dominio","type":"text","label":"Domínio/subdomínio","required":false,"section":"Técnico"},
    {"id":"prazo","type":"text","label":"Prazo desejado","required":false,"section":"Técnico"},
    {"id":"observacoes","type":"textarea","label":"Observações adicionais","required":false,"section":"Extras"}
  ]'::jsonb
),
(
  'redesign',
  'Redesign / Atualização',
  'Briefing para reformulação de site existente',
  'redesign',
  true,
  '[
    {"id":"site_atual","type":"url","label":"URL do site atual","required":true,"section":"Situação atual"},
    {"id":"problemas","type":"textarea","label":"O que não funciona no site atual?","required":true,"section":"Situação atual"},
    {"id":"manter","type":"textarea","label":"O que deve ser mantido?","required":false,"section":"Situação atual"},
    {"id":"objetivo","type":"textarea","label":"Objetivo do redesign","required":true,"section":"Objetivos"},
    {"id":"referencias","type":"links","label":"Referências visuais (links)","required":false,"section":"Visual"},
    {"id":"materiais","type":"file","label":"Materiais atualizados","required":false,"section":"Visual","multiple":true},
    {"id":"prazo","type":"text","label":"Prazo desejado","required":false,"section":"Técnico"},
    {"id":"observacoes","type":"textarea","label":"Observações adicionais","required":false,"section":"Extras"}
  ]'::jsonb
);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'briefing-files',
  'briefing-files',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/svg+xml','image/gif','application/pdf','application/zip']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: anon can upload to briefing path with valid structure
CREATE POLICY "Anon upload briefing files" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'briefing-files'
    AND (storage.foldername(name))[1] = 'briefings'
  );

CREATE POLICY "Authenticated read own briefing files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'briefing-files'
    AND EXISTS (
      SELECT 1 FROM briefing_files bf
      JOIN projects p ON p.id = bf.project_id
      WHERE bf.file_path = name AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated download own files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'briefing-files');

CREATE POLICY "Anon read uploaded files temporarily" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'briefing-files');;
