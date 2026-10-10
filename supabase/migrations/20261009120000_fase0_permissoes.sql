-- Fase 0: higiene de permissões.
-- O RLS continua decidindo o acesso; os privilégios de tabela só abrem o que cada papel precisa.

-- anon não lê nem grava nada do CS; só lê a tabela da LP pública.
revoke all on all tables in schema public from anon;
grant select on public.weevo_depoimentos to anon;

-- authenticated: só o DML que as policies usam (o RLS decide quem). Explícito, sem depender
-- de o projeto expor tabelas novas automaticamente.
revoke all on all tables in schema public from authenticated;
grant select, insert, update, delete on
  public.weevo_turmas,
  public.weevo_plantoes,
  public.weevo_participantes,
  public.weevo_tarefas,
  public.message_template_categories,
  public.message_templates
to authenticated;
grant select, insert, delete on public.weevo_eventos to authenticated;
grant select on public.weevo_admins to authenticated;
grant select, update on public.weevo_depoimentos to authenticated;

-- Função de trigger não pode ser chamada como RPC. O trigger continua disparando: EXECUTE não é checado no disparo.
revoke execute on function public.weevo_recalcular_participante() from public, anon, authenticated;

-- Objetos futuros criados pelo postgres (as migrations) não nascem expostos: cada migration faz GRANT explícito.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
-- O EXECUTE para PUBLIC é padrão global do Postgres: só sai sem IN SCHEMA.
alter default privileges for role postgres revoke execute on functions from public;
