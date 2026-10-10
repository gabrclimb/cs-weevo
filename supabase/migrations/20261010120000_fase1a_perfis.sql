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
