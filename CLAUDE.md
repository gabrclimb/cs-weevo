# CS Weevo

## Git e CI

- Merge na `main` só com o CI verde no branch.
- Nunca pular, desativar ou enfraquecer testes para o CI passar (`.skip`, `.only`, `--passWithNoTests`, remover asserção, mudar expectativa sem explicar ao usuário).
- Nunca fazer push direto na `main`. Trabalho em branch, push do branch para rodar o CI.

## Aplicar migrations no remoto (sem Docker)

Não usar `supabase db push` (sobe um container auxiliar do `pg-delta`) nem `apply_migration` do MCP (grava outra versão no histórico). Só ferramentas oficiais, nesta ordem:

1. Ver o pendente com `ctx sb migration list --linked` e mostrar a lista ao usuário antes de aplicar.
2. Para cada arquivo pendente, em ordem, aplicar numa transação única pelo pooler (modo sessão, porta 5432), sempre com:
   `psql -1 -v ON_ERROR_STOP=1 -f supabase/migrations/<arquivo>.sql`
   com a conexão em `PGHOST=aws-0-us-west-2.pooler.supabase.com PGPORT=5432 PGDATABASE=postgres PGUSER=postgres.viztyypoqlryemlcacjx PGSSLMODE=require`.
3. Só se o `psql` terminar com código 0: `ctx sb migration repair --linked --status applied <versão>`. Se falhar, parar, não registrar nada e mostrar o erro ao usuário (a transação única garante que nada daquele arquivo ficou aplicado).
4. Conferir com `ctx sb migration list --linked`: local e remoto precisam bater.

Senha: `PGPASSWORD` (e `SUPABASE_DB_PASSWORD` para o CLI) recebem o valor lido do `.env` na hora, por substituição de comando (`PGPASSWORD="$(grep '^SUPABASE_DB_PASSWORD=' .env | cut -d= -f2-)"`). O valor nunca aparece escrito na linha de comando nem na saída. Depois: `pnpm db:types` e advisors pelo MCP.
