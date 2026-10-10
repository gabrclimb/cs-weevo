# CS Weevo

## Git e CI

- Merge na `main` só com o CI verde no branch.
- Nunca pular, desativar ou enfraquecer testes para o CI passar (`.skip`, `.only`, `--passWithNoTests`, remover asserção, mudar expectativa sem explicar ao usuário).
- Nunca fazer push direto na `main`. Trabalho em branch, push do branch para rodar o CI.
