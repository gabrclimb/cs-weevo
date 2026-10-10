# CS Weevo

## Git e CI

- Merge na `main` só com o CI verde no branch.
- Nunca pular, desativar ou enfraquecer testes para o CI passar (`.skip`, `.only`, `--passWithNoTests`, remover asserção, mudar expectativa sem explicar ao usuário).
- Nunca fazer push direto na `main`. Trabalho em branch, push do branch para rodar o CI.

## Aplicar migrations no remoto (sem Docker)

Não usar `supabase db push` (sobe um container auxiliar do `pg-delta`) nem `apply_migration` do MCP (grava outra versão no histórico). Só ferramentas oficiais, nesta ordem:

1. Ver o pendente: `SUPABASE_DB_PASSWORD=… ctx sb migration list --linked`. Mostrar a lista ao usuário antes de aplicar.
2. Aplicar cada arquivo pendente, em ordem, numa transação única pelo pooler (modo sessão, porta 5432):
   `PGPASSWORD=… psql "host=aws-0-us-west-2.pooler.supabase.com port=5432 dbname=postgres user=postgres.viztyypoqlryemlcacjx sslmode=require" -v ON_ERROR_STOP=1 -1 -f supabase/migrations/<arquivo>.sql`
3. Registrar cada versão aplicada: `ctx sb migration repair --linked --status applied <versão>`.
4. Conferir: `ctx sb migration list --linked` de novo; local e remoto precisam bater.

A senha vem do `.env` (`SUPABASE_DB_PASSWORD`) direto para a variável de ambiente, nunca no comando nem na saída. Depois: `pnpm db:types` e advisors pelo MCP.
