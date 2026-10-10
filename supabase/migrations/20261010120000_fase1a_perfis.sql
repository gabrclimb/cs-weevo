-- Fase 1a: perfis do CS e papéis (cs < revisor < admin).

create table public.perfis (
  user_id uuid primary key references auth.users (id) on delete restrict,
  nome text not null check (btrim(nome) <> ''),
  papel text not null default 'cs' check (papel in ('cs', 'revisor', 'admin')),
  ativo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.perfis enable row level security;

create trigger perfis_updated_at before update on public.perfis
  for each row execute function public.set_updated_at();

-- Papel mínimo exigido: cada papel inclui os de baixo. Perfil inativo não passa em nada.
create function public.tem_papel(minimo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis p
    where p.user_id = (select auth.uid())
      and p.ativo
      and array_position(array['cs', 'revisor', 'admin'], p.papel)
          >= array_position(array['cs', 'revisor', 'admin'], minimo)
  );
$$;

revoke execute on function public.tem_papel(text) from public, anon;
grant execute on function public.tem_papel(text) to authenticated, service_role;

-- Todo usuário novo do Auth (convite pelo painel) ganha perfil cs inativo; o admin ativa e define o papel.
-- Falha aqui bloquearia o cadastro no Auth: só usa colunas estáveis (id, email, raw_user_meta_data).
create function public.criar_perfil_de_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (user_id, nome)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nome'), ''), nullif(split_part(new.email, '@', 1), ''), 'Sem nome')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.criar_perfil_de_usuario() from public, anon, authenticated;

create trigger criar_perfil_de_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_de_usuario();

-- Admins atuais (weevo_admins) viram perfil admin ativo. Idempotente; testado em tests/db/papeis.test.ts.
-- migração de dados: início
insert into public.perfis (user_id, nome, papel, ativo)
select a.user_id,
       coalesce(nullif(btrim(u.raw_user_meta_data ->> 'nome'), ''), nullif(split_part(u.email, '@', 1), ''), 'Sem nome'),
       'admin',
       true
from public.weevo_admins a
join auth.users u on u.id = a.user_id
on conflict (user_id) do update set papel = 'admin', ativo = true;
-- migração de dados: fim

-- As policies antigas (weevo_* e templates) seguem com is_admin() até trocarem para tem_papel: passa a seguir o perfil.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.tem_papel('admin');
$$;
