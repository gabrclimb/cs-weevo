-- Fase 1b: cadastro (empresas, turmas, dias da imersão, participantes).
-- FKs sempre ON DELETE RESTRICT e indexadas; nada aqui se apaga (arquivar).

-- Quem registrou: sempre o usuário da sessão, nunca o valor enviado pelo cliente (nulo para service_role/postgres).
create function public.carimbar_registrado_por()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.registrado_por := (select auth.uid());
  return new;
end;
$$;

-- Índice que o advisor apontou na 1a.
create index configuracoes_atualizado_por_idx on public.configuracoes (atualizado_por);

-- Empresas -----------------------------------------------------------------

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  observacoes text,
  arquivada boolean not null default false,
  registrado_por uuid references public.perfis (user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index empresas_nome_key on public.empresas (lower(btrim(nome)));
create index empresas_registrado_por_idx on public.empresas (registrado_por);

create trigger empresas_updated_at before update on public.empresas
  for each row execute function public.set_updated_at();
create trigger empresas_registrado_por before insert on public.empresas
  for each row execute function public.carimbar_registrado_por();

-- Turmas -------------------------------------------------------------------

create table public.turmas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (btrim(nome) <> ''),
  tipo text not null check (tipo in ('aberta', 'in_company')),
  empresa_id uuid references public.empresas (id) on delete restrict,
  modelo_suporte text not null check (modelo_suporte in ('horario_escolhido', 'plantao')),
  link_grupo text,
  arquivada boolean not null default false,
  registrado_por uuid references public.perfis (user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint turmas_empresa_conforme_tipo check ((tipo = 'in_company') = (empresa_id is not null))
);

create index turmas_empresa_idx on public.turmas (empresa_id);
create index turmas_registrado_por_idx on public.turmas (registrado_por);

create trigger turmas_updated_at before update on public.turmas
  for each row execute function public.set_updated_at();
create trigger turmas_registrado_por before insert on public.turmas
  for each row execute function public.carimbar_registrado_por();

alter table public.empresas enable row level security;
alter table public.turmas enable row level security;
