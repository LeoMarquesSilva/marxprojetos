-- Reescreve as perguntas dos templates do sistema e adiciona o template de
-- escritório de advocacia. Critérios: obrigatórias só as essenciais, múltipla
-- escolha quando a resposta é previsível, exemplos em todo campo aberto e
-- materiais sempre por link do Google Drive (o tipo "file" com upload não é
-- mais usado). Projetos existentes não mudam: cada projeto guarda a própria
-- cópia das perguntas em projects.questions.

insert into public.briefing_templates (slug, name, description, project_type, is_system, questions)
values
(
  'site-institucional',
  'Site Institucional',
  'Briefing completo para sites corporativos e institucionais',
  'website',
  true,
  $json$[
  {
    "id": "empresa",
    "type": "text",
    "label": "Nome da empresa como deve aparecer no site",
    "required": true,
    "section": "Sobre o negócio"
  },
  {
    "id": "sobre",
    "type": "textarea",
    "label": "Em 3 ou 4 frases: o que a empresa faz, para quem e desde quando?",
    "required": true,
    "section": "Sobre o negócio",
    "placeholder": "Ex.: Somos uma clínica de fisioterapia em Campinas, desde 2012, especializada em reabilitação esportiva…"
  },
  {
    "id": "servicos",
    "type": "textarea",
    "label": "Quais serviços ou produtos devem aparecer no site? Marque os mais importantes",
    "required": true,
    "section": "Sobre o negócio",
    "placeholder": "Um por linha. Coloque um * nos que dão mais retorno"
  },
  {
    "id": "diferenciais",
    "type": "textarea",
    "label": "Por que um cliente escolhe vocês e não um concorrente? Traga fatos",
    "required": true,
    "section": "Sobre o negócio",
    "placeholder": "Ex.: atendimento em até 24h; 12 anos de mercado; equipe com mestrado; 3 unidades"
  },
  {
    "id": "provas",
    "type": "textarea",
    "label": "Números, prêmios, certificações ou clientes conhecidos que podemos citar",
    "required": false,
    "section": "Sobre o negócio",
    "placeholder": "Ex.: +2.000 clientes atendidos; selo GPTW 2025; atendemos a Empresa X"
  },
  {
    "id": "publico",
    "type": "textarea",
    "label": "Quem é o cliente ideal? (perfil, região, principal necessidade)",
    "required": true,
    "section": "Público e objetivo",
    "placeholder": "Ex.: donos de pequenas empresas da Grande SP que precisam terceirizar a contabilidade"
  },
  {
    "id": "objetivo",
    "type": "select",
    "label": "Qual o principal objetivo do site?",
    "required": true,
    "section": "Público e objetivo",
    "options": [
      "Gerar contatos / pedidos de orçamento",
      "Passar credibilidade para quem já nos conhece",
      "Vender online",
      "Apresentar a empresa a parceiros e investidores",
      "Recrutar pessoas"
    ]
  },
  {
    "id": "concorrentes",
    "type": "links",
    "label": "Sites de concorrentes (um link por linha)",
    "required": false,
    "section": "Público e objetivo",
    "placeholder": "https://concorrente.com.br"
  },
  {
    "id": "paginas",
    "type": "multiselect",
    "label": "Quais páginas o site precisa ter?",
    "required": false,
    "section": "Estrutura",
    "options": [
      "Início",
      "Sobre / Quem somos",
      "Serviços",
      "Equipe",
      "Blog",
      "Perguntas frequentes",
      "Trabalhe conosco",
      "Contato"
    ]
  },
  {
    "id": "acao_principal",
    "type": "select",
    "label": "Qual ação você mais quer que o visitante faça no site?",
    "required": true,
    "section": "Contato e conversão",
    "options": [
      "Chamar no WhatsApp",
      "Agendar uma reunião",
      "Preencher um formulário",
      "Ligar",
      "Comprar / contratar online"
    ]
  },
  {
    "id": "canais_contato",
    "type": "multiselect",
    "label": "Quais canais de contato devem aparecer no site?",
    "required": false,
    "section": "Contato e conversão",
    "options": [
      "WhatsApp",
      "Telefone",
      "E-mail",
      "Formulário",
      "Agendamento online",
      "Endereço com mapa"
    ]
  },
  {
    "id": "contato_dados",
    "type": "textarea",
    "label": "Dados de contato que devem aparecer no site",
    "required": true,
    "section": "Contato e conversão",
    "placeholder": "WhatsApp, telefone, e-mail, endereço completo, horário de atendimento"
  },
  {
    "id": "responsavel_leads",
    "type": "text",
    "label": "Quem recebe os contatos do site e em quanto tempo costuma responder?",
    "required": false,
    "section": "Contato e conversão",
    "placeholder": "Ex.: Ana, da recepção; responde em até 2 horas no horário comercial"
  },
  {
    "id": "textos",
    "type": "select",
    "label": "Quem vai escrever os textos do site?",
    "required": true,
    "section": "Conteúdo",
    "options": [
      "Nós enviamos os textos prontos",
      "Enviamos um rascunho e vocês refinam",
      "Vocês escrevem a partir deste briefing"
    ]
  },
  {
    "id": "fotos",
    "type": "select",
    "label": "Como estão as fotos (equipe, espaço, produtos)?",
    "required": false,
    "section": "Conteúdo",
    "options": [
      "Temos fotos profissionais atuais",
      "Temos fotos, mas estão desatualizadas",
      "Não temos: vamos precisar de ensaio",
      "Podemos usar imagens de banco"
    ]
  },
  {
    "id": "materiais_link",
    "type": "url",
    "label": "Link de uma pasta no Google Drive com fotos, textos e materiais",
    "required": false,
    "section": "Conteúdo",
    "placeholder": "https://drive.google.com/..."
  },
  {
    "id": "identidade_status",
    "type": "select",
    "label": "Situação da identidade visual (logo, cores, fontes)",
    "required": true,
    "section": "Identidade visual",
    "options": [
      "Temos identidade definida e vamos manter",
      "Manter o logo, mas aceitamos atualizar cores e fontes",
      "A identidade está sendo refeita",
      "Não temos identidade: precisamos criar"
    ]
  },
  {
    "id": "logo_link",
    "type": "url",
    "label": "Link do logo (de preferência em vetor: SVG, AI, EPS ou PDF) e do manual da marca",
    "required": false,
    "section": "Identidade visual",
    "placeholder": "https://drive.google.com/..."
  },
  {
    "id": "sensacao",
    "type": "multiselect",
    "label": "Que sensação o site deve passar? (escolha até 3)",
    "required": false,
    "section": "Identidade visual",
    "options": [
      "Sóbrio e tradicional",
      "Moderno e minimalista",
      "Sofisticado / premium",
      "Próximo e acolhedor",
      "Tecnológico / inovador",
      "Jovem e descontraído"
    ]
  },
  {
    "id": "referencias_visuais",
    "type": "links",
    "label": "Sites que você admira (um link por linha) e o que gosta em cada um",
    "required": false,
    "section": "Identidade visual",
    "placeholder": "https://exemplo.com.br (gosto das fotos grandes)\nhttps://outro.com.br"
  },
  {
    "id": "nao_quer",
    "type": "textarea",
    "label": "O que você NÃO quer ver no site?",
    "required": false,
    "section": "Identidade visual",
    "placeholder": "Ex.: cores muito vibrantes, fotos de banco genéricas, visual carregado"
  },
  {
    "id": "dominio",
    "type": "text",
    "label": "Domínio do site (se já tiver)",
    "required": false,
    "section": "Parte técnica",
    "placeholder": "Ex.: suaempresa.com.br"
  },
  {
    "id": "acesso_dominio",
    "type": "select",
    "label": "Quem tem acesso ao registro do domínio (Registro.br ou outro)?",
    "required": false,
    "section": "Parte técnica",
    "options": [
      "Nós mesmos temos o login",
      "Está com a agência / desenvolvedor atual",
      "Não sabemos",
      "Ainda não temos domínio"
    ]
  },
  {
    "id": "emails_dominio",
    "type": "select",
    "label": "Onde ficam os e-mails com o domínio da empresa?",
    "required": false,
    "section": "Parte técnica",
    "options": [
      "Google Workspace (Gmail)",
      "Microsoft 365 (Outlook)",
      "Na hospedagem atual",
      "Não usamos",
      "Não sabemos"
    ]
  },
  {
    "id": "ferramentas",
    "type": "multiselect",
    "label": "Ferramentas que precisam estar integradas ao site",
    "required": false,
    "section": "Parte técnica",
    "options": [
      "Google Analytics",
      "Google Tag Manager",
      "Pixel da Meta",
      "Google Ads",
      "Perfil da Empresa no Google (Maps)",
      "CRM / RD Station",
      "Newsletter / e-mail marketing"
    ]
  },
  {
    "id": "prazo",
    "type": "text",
    "label": "Existe uma data ou evento para o site estar no ar?",
    "required": false,
    "section": "Prazos e aprovação",
    "placeholder": "Ex.: antes do lançamento em 15/11; sem data fixa"
  },
  {
    "id": "aprovador",
    "type": "text",
    "label": "Quem aprova o site do seu lado? (nome e WhatsApp)",
    "required": true,
    "section": "Prazos e aprovação",
    "placeholder": "Ex.: Maria Souza, (11) 99999-9999"
  },
  {
    "id": "observacoes",
    "type": "textarea",
    "label": "Algo mais que devemos saber?",
    "required": false,
    "section": "Prazos e aprovação",
    "placeholder": "Concorrentes, restrições, ideias, qualquer detalhe"
  }
]$json$::jsonb
),
(
  'landing-page',
  'Landing Page',
  'Briefing focado em conversão para landing pages',
  'landing_page',
  true,
  $json$[
  {
    "id": "produto",
    "type": "text",
    "label": "Nome da oferta (produto, serviço ou evento)",
    "required": true,
    "section": "Oferta"
  },
  {
    "id": "proposta",
    "type": "textarea",
    "label": "Em uma frase: por que alguém deveria aceitar essa oferta agora?",
    "required": true,
    "section": "Oferta",
    "placeholder": "Ex.: Regularize seu imóvel em 60 dias sem sair de casa"
  },
  {
    "id": "publico",
    "type": "textarea",
    "label": "Para quem é a página? Descreva quem vai chegar nela",
    "required": true,
    "section": "Oferta",
    "placeholder": "Ex.: mulheres de 30 a 45 anos, de SP, que já tentaram dietas e desistiram"
  },
  {
    "id": "dor",
    "type": "textarea",
    "label": "Qual problema essa pessoa quer resolver e o que a impede hoje?",
    "required": true,
    "section": "Oferta"
  },
  {
    "id": "objecoes",
    "type": "textarea",
    "label": "Quais dúvidas ou objeções mais aparecem antes de fechar?",
    "required": false,
    "section": "Oferta",
    "placeholder": "Ex.: “é caro”, “não tenho tempo”, “funciona para o meu caso?”"
  },
  {
    "id": "oferta_especial",
    "type": "textarea",
    "label": "Condição especial, bônus ou garantia",
    "required": false,
    "section": "Oferta"
  },
  {
    "id": "cta",
    "type": "select",
    "label": "Qual a ação principal da página?",
    "required": true,
    "section": "Conversão",
    "options": [
      "Chamar no WhatsApp",
      "Preencher formulário",
      "Agendar reunião",
      "Comprar",
      "Baixar material",
      "Inscrever-se em evento"
    ]
  },
  {
    "id": "campos_formulario",
    "type": "text",
    "label": "Se houver formulário, quais dados pedir?",
    "required": false,
    "section": "Conversão",
    "placeholder": "Ex.: nome, WhatsApp e cidade"
  },
  {
    "id": "provas",
    "type": "textarea",
    "label": "Provas que podemos usar (depoimentos, números, logos de clientes, mídia)",
    "required": false,
    "section": "Conversão"
  },
  {
    "id": "trafego",
    "type": "select",
    "label": "De onde virão os visitantes?",
    "required": true,
    "section": "Conversão",
    "options": [
      "Meta Ads",
      "Google Ads",
      "Meta e Google Ads",
      "Orgânico / redes sociais",
      "Lista de e-mails / WhatsApp"
    ]
  },
  {
    "id": "destino_leads",
    "type": "text",
    "label": "Para onde devem ir os contatos gerados?",
    "required": false,
    "section": "Conversão",
    "placeholder": "Ex.: WhatsApp da equipe comercial; RD Station; planilha"
  },
  {
    "id": "identidade_status",
    "type": "select",
    "label": "Situação da identidade visual (logo, cores, fontes)",
    "required": true,
    "section": "Visual",
    "options": [
      "Temos identidade definida e vamos manter",
      "Manter o logo, mas aceitamos atualizar cores e fontes",
      "A identidade está sendo refeita",
      "Não temos identidade: precisamos criar"
    ]
  },
  {
    "id": "logo_link",
    "type": "url",
    "label": "Link do logo (de preferência em vetor: SVG, AI, EPS ou PDF) e do manual da marca",
    "required": false,
    "section": "Visual",
    "placeholder": "https://drive.google.com/..."
  },
  {
    "id": "sensacao",
    "type": "multiselect",
    "label": "Que sensação o site deve passar? (escolha até 3)",
    "required": false,
    "section": "Visual",
    "options": [
      "Sóbrio e tradicional",
      "Moderno e minimalista",
      "Sofisticado / premium",
      "Próximo e acolhedor",
      "Tecnológico / inovador",
      "Jovem e descontraído"
    ]
  },
  {
    "id": "referencias_visuais",
    "type": "links",
    "label": "Sites que você admira (um link por linha) e o que gosta em cada um",
    "required": false,
    "section": "Visual",
    "placeholder": "https://exemplo.com.br (gosto das fotos grandes)\nhttps://outro.com.br"
  },
  {
    "id": "nao_quer",
    "type": "textarea",
    "label": "O que você NÃO quer ver no site?",
    "required": false,
    "section": "Visual",
    "placeholder": "Ex.: cores muito vibrantes, fotos de banco genéricas, visual carregado"
  },
  {
    "id": "dominio",
    "type": "text",
    "label": "Domínio ou subdomínio da página",
    "required": false,
    "section": "Técnico",
    "placeholder": "Ex.: oferta.suaempresa.com.br"
  },
  {
    "id": "ferramentas",
    "type": "multiselect",
    "label": "Rastreamento necessário",
    "required": false,
    "section": "Técnico",
    "options": [
      "Pixel da Meta",
      "Google Ads",
      "Google Analytics",
      "Google Tag Manager",
      "CRM / RD Station"
    ]
  },
  {
    "id": "prazo",
    "type": "text",
    "label": "Existe uma data ou evento para o site estar no ar?",
    "required": false,
    "section": "Prazos e aprovação",
    "placeholder": "Ex.: antes do lançamento em 15/11; sem data fixa"
  },
  {
    "id": "aprovador",
    "type": "text",
    "label": "Quem aprova o site do seu lado? (nome e WhatsApp)",
    "required": true,
    "section": "Prazos e aprovação",
    "placeholder": "Ex.: Maria Souza, (11) 99999-9999"
  },
  {
    "id": "observacoes",
    "type": "textarea",
    "label": "Algo mais que devemos saber?",
    "required": false,
    "section": "Prazos e aprovação",
    "placeholder": "Concorrentes, restrições, ideias, qualquer detalhe"
  }
]$json$::jsonb
),
(
  'redesign',
  'Redesign / Atualização',
  'Briefing para reformular um site que já existe',
  'redesign',
  true,
  $json$[
  {
    "id": "site_atual",
    "type": "url",
    "label": "Endereço do site atual",
    "required": true,
    "section": "Site atual",
    "placeholder": "https://"
  },
  {
    "id": "motivo",
    "type": "textarea",
    "label": "Por que refazer o site agora? O que mais incomoda no atual?",
    "required": true,
    "section": "Site atual",
    "placeholder": "Ex.: visual datado, não funciona bem no celular, não traz contatos, difícil de atualizar"
  },
  {
    "id": "manter",
    "type": "textarea",
    "label": "O que funciona hoje e deve ser mantido?",
    "required": false,
    "section": "Site atual"
  },
  {
    "id": "resultado_atual",
    "type": "select",
    "label": "Hoje o site traz clientes?",
    "required": false,
    "section": "Site atual",
    "options": [
      "Sim, com frequência",
      "Às vezes",
      "Raramente",
      "Não sabemos medir"
    ]
  },
  {
    "id": "origem_clientes",
    "type": "multiselect",
    "label": "De onde vêm os clientes hoje?",
    "required": false,
    "section": "Site atual",
    "options": [
      "Indicação",
      "Google",
      "Instagram",
      "LinkedIn",
      "Site",
      "Anúncios pagos",
      "Eventos / networking"
    ]
  },
  {
    "id": "mudou",
    "type": "textarea",
    "label": "O que mudou no negócio desde o último site? (serviços, público, equipe, posicionamento)",
    "required": true,
    "section": "Posicionamento"
  },
  {
    "id": "objetivo",
    "type": "select",
    "label": "Qual o principal objetivo do novo site?",
    "required": true,
    "section": "Posicionamento",
    "options": [
      "Gerar mais contatos",
      "Passar mais credibilidade",
      "Refletir um novo posicionamento",
      "Facilitar a atualização de conteúdo",
      "Vender online"
    ]
  },
  {
    "id": "diferenciais",
    "type": "textarea",
    "label": "Por que um cliente escolhe vocês? Traga fatos e números",
    "required": false,
    "section": "Posicionamento"
  },
  {
    "id": "blog",
    "type": "select",
    "label": "O que fazer com o blog / artigos atuais?",
    "required": false,
    "section": "Conteúdo",
    "options": [
      "Migrar todos",
      "Migrar só os melhores",
      "Começar do zero",
      "Não teremos blog",
      "O site atual não tem blog"
    ]
  },
  {
    "id": "textos",
    "type": "select",
    "label": "Quem vai escrever os textos do site?",
    "required": true,
    "section": "Conteúdo",
    "options": [
      "Nós enviamos os textos prontos",
      "Enviamos um rascunho e vocês refinam",
      "Vocês escrevem a partir deste briefing"
    ]
  },
  {
    "id": "fotos",
    "type": "select",
    "label": "Como estão as fotos (equipe, espaço, produtos)?",
    "required": false,
    "section": "Conteúdo",
    "options": [
      "Temos fotos profissionais atuais",
      "Temos fotos, mas estão desatualizadas",
      "Não temos: vamos precisar de ensaio",
      "Podemos usar imagens de banco"
    ]
  },
  {
    "id": "acao_principal",
    "type": "select",
    "label": "Qual ação você mais quer que o visitante faça no site?",
    "required": true,
    "section": "Contato e conversão",
    "options": [
      "Chamar no WhatsApp",
      "Agendar uma reunião",
      "Preencher um formulário",
      "Ligar",
      "Comprar / contratar online"
    ]
  },
  {
    "id": "canais_contato",
    "type": "multiselect",
    "label": "Quais canais de contato devem aparecer no site?",
    "required": false,
    "section": "Contato e conversão",
    "options": [
      "WhatsApp",
      "Telefone",
      "E-mail",
      "Formulário",
      "Agendamento online",
      "Endereço com mapa"
    ]
  },
  {
    "id": "responsavel_leads",
    "type": "text",
    "label": "Quem recebe os contatos do site e em quanto tempo costuma responder?",
    "required": false,
    "section": "Contato e conversão",
    "placeholder": "Ex.: Ana, da recepção; responde em até 2 horas no horário comercial"
  },
  {
    "id": "contato_mudancas",
    "type": "textarea",
    "label": "Algum dado de contato do site atual mudou?",
    "required": false,
    "section": "Contato e conversão",
    "placeholder": "Deixe em branco se estiver tudo igual"
  },
  {
    "id": "identidade_status",
    "type": "select",
    "label": "Situação da identidade visual (logo, cores, fontes)",
    "required": true,
    "section": "Identidade visual",
    "options": [
      "Temos identidade definida e vamos manter",
      "Manter o logo, mas aceitamos atualizar cores e fontes",
      "A identidade está sendo refeita",
      "Não temos identidade: precisamos criar"
    ]
  },
  {
    "id": "logo_link",
    "type": "url",
    "label": "Link do logo (de preferência em vetor: SVG, AI, EPS ou PDF) e do manual da marca",
    "required": false,
    "section": "Identidade visual",
    "placeholder": "https://drive.google.com/..."
  },
  {
    "id": "sensacao",
    "type": "multiselect",
    "label": "Que sensação o site deve passar? (escolha até 3)",
    "required": false,
    "section": "Identidade visual",
    "options": [
      "Sóbrio e tradicional",
      "Moderno e minimalista",
      "Sofisticado / premium",
      "Próximo e acolhedor",
      "Tecnológico / inovador",
      "Jovem e descontraído"
    ]
  },
  {
    "id": "referencias_visuais",
    "type": "links",
    "label": "Sites que você admira (um link por linha) e o que gosta em cada um",
    "required": false,
    "section": "Identidade visual",
    "placeholder": "https://exemplo.com.br (gosto das fotos grandes)\nhttps://outro.com.br"
  },
  {
    "id": "nao_quer",
    "type": "textarea",
    "label": "O que você NÃO quer ver no site?",
    "required": false,
    "section": "Identidade visual",
    "placeholder": "Ex.: cores muito vibrantes, fotos de banco genéricas, visual carregado"
  },
  {
    "id": "materiais_link",
    "type": "url",
    "label": "Link de uma pasta no Google Drive com fotos, textos e materiais novos",
    "required": false,
    "section": "Identidade visual",
    "placeholder": "https://drive.google.com/..."
  },
  {
    "id": "gestao_site",
    "type": "select",
    "label": "Quem cuida do site atual (hospedagem e atualizações)?",
    "required": false,
    "section": "Parte técnica",
    "options": [
      "Nós mesmos",
      "Uma agência / desenvolvedor",
      "Ninguém no momento",
      "Não sabemos"
    ]
  },
  {
    "id": "acesso_dominio",
    "type": "select",
    "label": "Quem tem acesso ao registro do domínio (Registro.br ou outro)?",
    "required": false,
    "section": "Parte técnica",
    "options": [
      "Nós mesmos temos o login",
      "Está com a agência / desenvolvedor atual",
      "Não sabemos",
      "Ainda não temos domínio"
    ]
  },
  {
    "id": "emails_dominio",
    "type": "select",
    "label": "Onde ficam os e-mails com o domínio da empresa?",
    "required": false,
    "section": "Parte técnica",
    "options": [
      "Google Workspace (Gmail)",
      "Microsoft 365 (Outlook)",
      "Na hospedagem atual",
      "Não usamos",
      "Não sabemos"
    ]
  },
  {
    "id": "ferramentas",
    "type": "multiselect",
    "label": "Ferramentas que precisam estar integradas ao site",
    "required": false,
    "section": "Parte técnica",
    "options": [
      "Google Analytics",
      "Google Tag Manager",
      "Pixel da Meta",
      "Google Ads",
      "Perfil da Empresa no Google (Maps)",
      "CRM / RD Station",
      "Newsletter / e-mail marketing"
    ]
  },
  {
    "id": "prazo",
    "type": "text",
    "label": "Existe uma data ou evento para o site estar no ar?",
    "required": false,
    "section": "Prazos e aprovação",
    "placeholder": "Ex.: antes do lançamento em 15/11; sem data fixa"
  },
  {
    "id": "aprovador",
    "type": "text",
    "label": "Quem aprova o site do seu lado? (nome e WhatsApp)",
    "required": true,
    "section": "Prazos e aprovação",
    "placeholder": "Ex.: Maria Souza, (11) 99999-9999"
  },
  {
    "id": "observacoes",
    "type": "textarea",
    "label": "Algo mais que devemos saber?",
    "required": false,
    "section": "Prazos e aprovação",
    "placeholder": "Concorrentes, restrições, ideias, qualquer detalhe"
  }
]$json$::jsonb
),
(
  'escritorio-advocacia',
  'Escritório de Advocacia',
  'Site novo ou reformulação para escritórios de advocacia, alinhado às regras de publicidade da OAB',
  'website',
  true,
  $json$[
  {
    "id": "escritorio",
    "type": "text",
    "label": "Nome do escritório como deve aparecer no site",
    "required": true,
    "section": "O escritório"
  },
  {
    "id": "site_atual",
    "type": "url",
    "label": "Endereço do site atual (se houver)",
    "required": false,
    "section": "O escritório",
    "placeholder": "https://"
  },
  {
    "id": "resumo",
    "type": "textarea",
    "label": "Em 3 ou 4 frases: quem são, desde quando e onde atuam",
    "required": true,
    "section": "O escritório",
    "placeholder": "Ex.: Fundado em 2010 em Curitiba, atende empresas do Sul do país com foco em direito tributário e societário"
  },
  {
    "id": "abrangencia",
    "type": "select",
    "label": "Onde atendem clientes?",
    "required": false,
    "section": "O escritório",
    "options": [
      "Só na nossa cidade / região",
      "No estado todo",
      "Em todo o Brasil",
      "Brasil e exterior"
    ]
  },
  {
    "id": "publico",
    "type": "select",
    "label": "Quem é o cliente principal?",
    "required": true,
    "section": "Posicionamento",
    "options": [
      "Empresas e empresários",
      "Pessoas físicas",
      "Empresas e pessoas físicas, com o mesmo peso"
    ]
  },
  {
    "id": "perfil_cliente",
    "type": "textarea",
    "label": "Descreva o cliente ideal (setor, porte, momento, necessidade)",
    "required": false,
    "section": "Posicionamento",
    "placeholder": "Ex.: construtoras e incorporadoras de médio porte que precisam estruturar lançamentos"
  },
  {
    "id": "areas",
    "type": "textarea",
    "label": "Áreas de atuação que devem aparecer no site (uma por linha)",
    "required": true,
    "section": "Posicionamento",
    "placeholder": "Direito Tributário\nDireito Trabalhista empresarial\nDireito Imobiliário…"
  },
  {
    "id": "areas_prioritarias",
    "type": "text",
    "label": "Quais 2 ou 3 áreas o escritório mais quer fortalecer com o site?",
    "required": true,
    "section": "Posicionamento"
  },
  {
    "id": "diferenciais",
    "type": "textarea",
    "label": "O que diferencia o escritório de outros bons escritórios? Traga fatos",
    "required": true,
    "section": "Posicionamento",
    "placeholder": "Ex.: atendimento direto com o sócio; relatórios mensais ao cliente; equipe com mestrado; 15 anos em tributário"
  },
  {
    "id": "credibilidade",
    "type": "textarea",
    "label": "Dados de credibilidade que podem ser citados",
    "required": false,
    "section": "Posicionamento",
    "placeholder": "Anos de atuação, rankings (Análise Advocacia, Leaders League), publicações, palestras, associações"
  },
  {
    "id": "equipe",
    "type": "textarea",
    "label": "Quem deve aparecer na página de equipe? (nome, cargo, OAB, formação e uma linha de bio)",
    "required": true,
    "section": "Equipe",
    "placeholder": "Ex.: Dra. Ana Lima, sócia, OAB/SP 123.456, mestre em Direito Tributário (FGV)…"
  },
  {
    "id": "equipe_apoio",
    "type": "select",
    "label": "A equipe de apoio (administrativo, financeiro) deve aparecer?",
    "required": false,
    "section": "Equipe",
    "options": [
      "Sim",
      "Não",
      "Só os nomes, sem fotos"
    ]
  },
  {
    "id": "espaco",
    "type": "select",
    "label": "A sede é um diferencial a mostrar no site (fotos, vídeo do espaço)?",
    "required": false,
    "section": "Equipe",
    "options": [
      "Sim, e já temos fotos / vídeo",
      "Sim, mas precisamos produzir",
      "Não é prioridade"
    ]
  },
  {
    "id": "blog",
    "type": "select",
    "label": "O escritório vai publicar artigos no site?",
    "required": false,
    "section": "Conteúdo",
    "options": [
      "Sim, com frequência (semanal / quinzenal)",
      "De vez em quando",
      "Temos artigos antigos para migrar",
      "Não teremos blog"
    ]
  },
  {
    "id": "restricoes_oab",
    "type": "textarea",
    "label": "Alguma orientação de comunicação que devemos seguir além do Provimento 205/2021 da OAB?",
    "required": false,
    "section": "Conteúdo",
    "placeholder": "Ex.: não citar nomes de clientes; tom mais formal; evitar a palavra “especialista”"
  },
  {
    "id": "textos",
    "type": "select",
    "label": "Quem vai escrever os textos do site?",
    "required": true,
    "section": "Conteúdo",
    "options": [
      "Nós enviamos os textos prontos",
      "Enviamos um rascunho e vocês refinam",
      "Vocês escrevem a partir deste briefing"
    ]
  },
  {
    "id": "fotos",
    "type": "select",
    "label": "Como estão as fotos (equipe, espaço, produtos)?",
    "required": false,
    "section": "Conteúdo",
    "options": [
      "Temos fotos profissionais atuais",
      "Temos fotos, mas estão desatualizadas",
      "Não temos: vamos precisar de ensaio",
      "Podemos usar imagens de banco"
    ]
  },
  {
    "id": "acao_principal",
    "type": "select",
    "label": "Qual ação você mais quer que o visitante faça no site?",
    "required": true,
    "section": "Contato e conversão",
    "options": [
      "Chamar no WhatsApp",
      "Agendar uma reunião",
      "Preencher um formulário",
      "Ligar",
      "Comprar / contratar online"
    ]
  },
  {
    "id": "canais_contato",
    "type": "multiselect",
    "label": "Quais canais de contato devem aparecer no site?",
    "required": false,
    "section": "Contato e conversão",
    "options": [
      "WhatsApp",
      "Telefone",
      "E-mail",
      "Formulário",
      "Agendamento online",
      "Endereço com mapa"
    ]
  },
  {
    "id": "contato_dados",
    "type": "textarea",
    "label": "Dados de contato que devem aparecer no site",
    "required": true,
    "section": "Contato e conversão",
    "placeholder": "WhatsApp, telefone, e-mail, endereço completo, horário de atendimento"
  },
  {
    "id": "responsavel_leads",
    "type": "text",
    "label": "Quem recebe os contatos do site e em quanto tempo costuma responder?",
    "required": false,
    "section": "Contato e conversão",
    "placeholder": "Ex.: Ana, da recepção; responde em até 2 horas no horário comercial"
  },
  {
    "id": "identidade_status",
    "type": "select",
    "label": "Situação da identidade visual (logo, cores, fontes)",
    "required": true,
    "section": "Identidade visual",
    "options": [
      "Temos identidade definida e vamos manter",
      "Manter o logo, mas aceitamos atualizar cores e fontes",
      "A identidade está sendo refeita",
      "Não temos identidade: precisamos criar"
    ]
  },
  {
    "id": "logo_link",
    "type": "url",
    "label": "Link do logo (de preferência em vetor: SVG, AI, EPS ou PDF) e do manual da marca",
    "required": false,
    "section": "Identidade visual",
    "placeholder": "https://drive.google.com/..."
  },
  {
    "id": "sensacao",
    "type": "multiselect",
    "label": "Que sensação o site deve passar? (escolha até 3)",
    "required": false,
    "section": "Identidade visual",
    "options": [
      "Sóbrio e tradicional",
      "Moderno e minimalista",
      "Sofisticado / premium",
      "Próximo e acolhedor",
      "Tecnológico / inovador",
      "Jovem e descontraído"
    ]
  },
  {
    "id": "referencias_visuais",
    "type": "links",
    "label": "Sites que você admira (um link por linha) e o que gosta em cada um",
    "required": false,
    "section": "Identidade visual",
    "placeholder": "https://exemplo.com.br (gosto das fotos grandes)\nhttps://outro.com.br"
  },
  {
    "id": "nao_quer",
    "type": "textarea",
    "label": "O que você NÃO quer ver no site?",
    "required": false,
    "section": "Identidade visual",
    "placeholder": "Ex.: cores muito vibrantes, fotos de banco genéricas, visual carregado"
  },
  {
    "id": "materiais_link",
    "type": "url",
    "label": "Link de uma pasta no Google Drive com fotos da equipe, do escritório e outros materiais",
    "required": false,
    "section": "Identidade visual",
    "placeholder": "https://drive.google.com/..."
  },
  {
    "id": "dominio",
    "type": "text",
    "label": "Domínio do site (se já tiver)",
    "required": false,
    "section": "Parte técnica",
    "placeholder": "Ex.: suaempresa.com.br"
  },
  {
    "id": "acesso_dominio",
    "type": "select",
    "label": "Quem tem acesso ao registro do domínio (Registro.br ou outro)?",
    "required": false,
    "section": "Parte técnica",
    "options": [
      "Nós mesmos temos o login",
      "Está com a agência / desenvolvedor atual",
      "Não sabemos",
      "Ainda não temos domínio"
    ]
  },
  {
    "id": "emails_dominio",
    "type": "select",
    "label": "Onde ficam os e-mails com o domínio da empresa?",
    "required": false,
    "section": "Parte técnica",
    "options": [
      "Google Workspace (Gmail)",
      "Microsoft 365 (Outlook)",
      "Na hospedagem atual",
      "Não usamos",
      "Não sabemos"
    ]
  },
  {
    "id": "ferramentas",
    "type": "multiselect",
    "label": "Ferramentas que precisam estar integradas ao site",
    "required": false,
    "section": "Parte técnica",
    "options": [
      "Google Analytics",
      "Google Tag Manager",
      "Pixel da Meta",
      "Google Ads",
      "Perfil da Empresa no Google (Maps)",
      "CRM / RD Station",
      "Newsletter / e-mail marketing"
    ]
  },
  {
    "id": "politicas",
    "type": "select",
    "label": "Termos de uso e política de privacidade (LGPD)",
    "required": false,
    "section": "Parte técnica",
    "options": [
      "Já temos e vamos reaproveitar",
      "Temos, mas precisam ser revistos",
      "Não temos",
      "O escritório vai redigir"
    ]
  },
  {
    "id": "prazo",
    "type": "text",
    "label": "Existe uma data ou evento para o site estar no ar?",
    "required": false,
    "section": "Prazos e aprovação",
    "placeholder": "Ex.: antes do lançamento em 15/11; sem data fixa"
  },
  {
    "id": "aprovador",
    "type": "text",
    "label": "Quem aprova o site do seu lado? (nome e WhatsApp)",
    "required": true,
    "section": "Prazos e aprovação",
    "placeholder": "Ex.: Maria Souza, (11) 99999-9999"
  },
  {
    "id": "observacoes",
    "type": "textarea",
    "label": "Algo mais que devemos saber?",
    "required": false,
    "section": "Prazos e aprovação",
    "placeholder": "Concorrentes, restrições, ideias, qualquer detalhe"
  }
]$json$::jsonb
)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    project_type = excluded.project_type,
    is_system = excluded.is_system,
    questions = excluded.questions,
    updated_at = now();
