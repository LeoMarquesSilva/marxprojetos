# Briefing Studio

Sistema de gestão de briefings para criação de sites e landing pages.

## Funcionalidades

- **Painel admin** com login via Supabase Auth
- **Templates prontos**: Site institucional, Landing page, Redesign
- **Personalização** de perguntas por projeto
- **Link único** para o cliente (`/b/{token}`)
- **Links de materiais** (logo, imagens, PDFs e referências)
- **Organização** de respostas por seção no painel
- **Geração automática de perguntas com IA** (nicho + tipo de produto)

## Setup

### 1. Variáveis de ambiente

Copie `.env.local.example` para `.env.local` e preencha:

```bash
cp .env.local.example .env.local
```

Obtenha as chaves em: [Supabase Dashboard](https://supabase.com/dashboard/project/ywbvybaeakptbaobrcte/settings/api)

- `NEXT_PUBLIC_SUPABASE_URL` — URL do projeto
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — chave anon/public
- `SUPABASE_SERVICE_ROLE_KEY` — service role (apenas server-side)
- `NEXT_PUBLIC_APP_URL` — URL pública do app (ex: `http://localhost:3000`)
- `OPENAI_API_KEY` (ou `NEXT_OPENAI_API_KEY`) — chave da API para gerar perguntas por IA
- `OPENAI_MODEL` — opcional (padrão: `gpt-4o-mini`)

### 2. Criar usuário admin

No Supabase Dashboard → Authentication → Users → Add user

Use o e-mail e senha que você usará para login.

### 3. Rodar localmente

```bash
npm install
npm run dev
```

Acesse:
- Painel: http://localhost:3000/dashboard
- Login: http://localhost:3000/login

### 4. Fluxo de uso

1. Faça login no painel
2. Clique em **Novo briefing**
3. Escolha template, preencha dados do cliente, personalize perguntas
4. Copie o link gerado e envie ao cliente
5. Quando o cliente responder, veja tudo organizado em **Projetos**

## Banco de dados

O schema já foi aplicado no Supabase `creator-site`:

- `briefing_templates` — templates com perguntas
- `projects` — briefings enviados (com token único)
- `briefing_submissions` — respostas dos clientes

Materiais de marca são informados nas respostas por links; o formulário não
envia arquivos binários ao Supabase Storage.

A migration
`20260811204419_remove_obsolete_anon_briefing_upload_policy.sql` removeu do
projeto remoto a policy obsoleta `Anon upload briefing files` de
`storage.objects`.

## Deploy

Recomendado: Vercel. Configure as mesmas variáveis de ambiente e defina `NEXT_PUBLIC_APP_URL` com a URL de produção.
