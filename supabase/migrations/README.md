# Migrações do Supabase

As cinco migrations com versões já registradas no projeto remoto foram
fetchadas e permanecem sem alterações:

- `20260626190924_initial_schema.sql`
- `20260626190936_rls_policies_and_rpc.sql`
- `20260626190957_seed_templates_and_storage.sql`
- `20260629144432_remove_unused_briefing_file_storage.sql`
- `20260729203655_crm_whatsapp_inbox_enrichment.sql`

Os arquivos `catch_up_*`, posicionados antes de `20260729203655`, transformam
em migrations os objetos que tinham sido criados manualmente:

1. CRM e WhatsApp;
2. prospecção;
3. revisão de sites;
4. portfólio;
5. workspace compartilhado.

Eles seguem a ordem de dependências, usam operações idempotentes (`if not
exists`, `drop policy if exists` e `create or replace` quando aplicável) e não
contêm seeds, UUIDs pessoais, segredos ou DML de conteúdo específico. O
bootstrap de administrador de `supabase/sql/shared_workspace.sql`, os dados
pessoais de `portfolio-site-settings.sql` e o update editorial de
`portfolio-external-highlights.sql` não foram copiados. As tabelas históricas
`crm_tasks` e `crm_notes` também ficaram de fora: o código atual não as usa e
os campos `crm_clients.next_step`/`next_step_at` substituíram esse fluxo.

A migration forward `20260811201128_harden_briefing_storage_read_policies.sql`
remove as policies amplas de leitura do bucket `briefing-files` e recria
`Authenticated read own briefing files` com escopo ao `owner_id` nativo do
Storage. Objetos enviados anonimamente ou por `service_role` não possuem
proprietário e, portanto, não passam por essa policy.

As migrations `20260811204419_remove_obsolete_anon_briefing_upload_policy.sql`
e `20260811204450_transactional_whatsapp_webhook_ingest.sql` removem o upload
anônimo obsoleto e tornam a ingestão de mensagens/unread transacional e
idempotente. A migration
`20260811205823_restrict_submit_briefing_rpc.sql` limita a gravação pública de
briefings ao fluxo validado pela Server Action.

## Validação e aplicação

As quatro migrations forward foram aplicadas e verificadas no projeto remoto.
As duas policies amplas de leitura e a policy anônima de upload foram removidas;
a RPC transacional, sua coluna de controle e o trigger de status estão ativos.
As cinco migrations `catch_up_*` representam objetos que já existiam no banco
e foram registradas como aplicadas com `migration repair`, conciliando o
histórico sem reexecutar DDL sobre os dados existentes.

Docker não estava disponível para executar `supabase db reset`; por isso, a
validação desta alteração é estática e por inspeção de ordem/dependências.
Antes de promover as migrations, valide em um Supabase local ou em uma branch
descartável:

```sh
npx supabase@latest start
npx supabase@latest db reset
npx supabase@latest db lint --local --level error
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/verification/rls-and-publications.sql
```

Em um banco limpo, nenhum usuário é promovido automaticamente a
administrador. O primeiro admin deve ser definido por um procedimento
específico do ambiente, depois que o usuário existir, sem registrar seu UUID
em migration.

Mantenha `supabase/sql/` apenas como histórico e não altere migrations já
publicadas. Antes de qualquer `db push`, confirme o histórico com
`npx supabase@latest migration list --linked`.
