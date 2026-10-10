-- Fase 0: higiene de permissões.
-- O RLS continua decidindo o acesso; os privilégios de tabela só abrem o que cada papel precisa.

-- anon não lê nem grava nada do CS; só lê a tabela da LP pública.
revoke all on all tables in schema public from anon;
grant select on public.weevo_depoimentos to anon;

-- Função de trigger não pode ser chamada como RPC. O trigger continua disparando: EXECUTE não é checado no disparo.
revoke execute on function public.weevo_recalcular_participante() from public, anon, authenticated;
