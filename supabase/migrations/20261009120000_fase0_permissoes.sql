-- Fase 0: higiene de permissões.
-- O RLS continua decidindo o acesso; os privilégios de tabela só abrem o que cada papel precisa.

-- anon não lê nada do CS; só a tabela da LP pública.
revoke select on all tables in schema public from anon;
grant select on public.weevo_depoimentos to anon;
