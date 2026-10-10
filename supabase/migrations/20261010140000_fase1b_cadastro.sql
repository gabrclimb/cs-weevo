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

-- Dias da imersão ------------------------------------------------------------

create table public.imersao_dias (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turmas (id) on delete restrict,
  data date not null,
  ordem int not null check (ordem >= 1),
  created_at timestamptz not null default now(),
  unique (turma_id, ordem),
  unique (turma_id, data)
);

alter table public.imersao_dias enable row level security;

-- Participantes ----------------------------------------------------------------
-- situacao, turma_suporte_id e projeto são estado derivado de eventos (fase 1c): só o banco grava neles.

create table public.participantes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  apelido text,
  telefone text check (telefone is null or telefone ~ '^\+55\d{10,11}$'),
  email text check (email is null or email ~ '^[^@\s]+@[^@\s]+$'),
  empresa_id uuid references public.empresas (id) on delete restrict,
  turma_imersao_id uuid not null references public.turmas (id) on delete restrict,
  turma_suporte_id uuid not null references public.turmas (id) on delete restrict,
  parceiro_presenca_id uuid references public.participantes (id) on delete restrict,
  situacao text not null default 'ativo' check (situacao in ('ativo', 'fora_do_suporte')),
  projeto text,
  horario_escolhido text,
  arquivado boolean not null default false,
  registrado_por uuid references public.perfis (user_id) on delete restrict,
  atualizado_por uuid references public.perfis (user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participantes_parceiro_outro check (parceiro_presenca_id <> id)
);

create unique index participantes_telefone_key on public.participantes (telefone) where telefone is not null;
create unique index participantes_email_key on public.participantes (lower(email)) where email is not null;
create unique index participantes_parceiro_key on public.participantes (parceiro_presenca_id) where parceiro_presenca_id is not null;
create index participantes_empresa_idx on public.participantes (empresa_id);
create index participantes_turma_imersao_idx on public.participantes (turma_imersao_id);
create index participantes_turma_suporte_idx on public.participantes (turma_suporte_id);
create index participantes_registrado_por_idx on public.participantes (registrado_por);
create index participantes_atualizado_por_idx on public.participantes (atualizado_por);

-- Na criação, a turma de suporte é a da imersão (transferência é evento, fase 1c).
create function public.participante_ao_criar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.turma_suporte_id := new.turma_imersao_id;
  return new;
end;
$$;

create function public.carimbar_atualizado_por()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_por := (select auth.uid());
  return new;
end;
$$;

create trigger participantes_ao_criar before insert on public.participantes
  for each row execute function public.participante_ao_criar();
create trigger participantes_registrado_por before insert on public.participantes
  for each row execute function public.carimbar_registrado_por();
create trigger participantes_atualizado_por before update on public.participantes
  for each row execute function public.carimbar_atualizado_por();
create trigger participantes_updated_at before update on public.participantes
  for each row execute function public.set_updated_at();

alter table public.participantes enable row level security;

-- Acesso ---------------------------------------------------------------------
-- Todo membro ativo lê; revisor e admin cadastram (D2). Ninguém apaga: arquivar.
-- Colunas derivadas (situacao, turma_suporte_id, projeto) e a dupla não têm GRANT: só as RPCs gravam nelas.

grant select on public.empresas, public.turmas, public.imersao_dias, public.participantes to authenticated;

grant insert (nome, observacoes) on public.empresas to authenticated;
grant update (nome, observacoes, arquivada) on public.empresas to authenticated;
grant insert (nome, tipo, empresa_id, modelo_suporte, link_grupo) on public.turmas to authenticated;
grant update (nome, tipo, empresa_id, modelo_suporte, link_grupo, arquivada) on public.turmas to authenticated;
grant insert (turma_id, data, ordem) on public.imersao_dias to authenticated;
grant update (data, ordem) on public.imersao_dias to authenticated;
grant insert (nome, apelido, telefone, email, empresa_id, turma_imersao_id, horario_escolhido) on public.participantes to authenticated;
grant update (nome, apelido, telefone, email, empresa_id, horario_escolhido, arquivado) on public.participantes to authenticated;

create policy "membros_leem" on public.empresas for select to authenticated using ((select public.tem_papel('cs')));
create policy "membros_leem" on public.turmas for select to authenticated using ((select public.tem_papel('cs')));
create policy "membros_leem" on public.imersao_dias for select to authenticated using ((select public.tem_papel('cs')));
create policy "membros_leem" on public.participantes for select to authenticated using ((select public.tem_papel('cs')));

create policy "revisor_insere" on public.empresas for insert to authenticated with check ((select public.tem_papel('revisor')));
create policy "revisor_altera" on public.empresas for update to authenticated using ((select public.tem_papel('revisor'))) with check ((select public.tem_papel('revisor')));
create policy "revisor_insere" on public.turmas for insert to authenticated with check ((select public.tem_papel('revisor')));
create policy "revisor_altera" on public.turmas for update to authenticated using ((select public.tem_papel('revisor'))) with check ((select public.tem_papel('revisor')));
create policy "revisor_insere" on public.imersao_dias for insert to authenticated with check ((select public.tem_papel('revisor')));
create policy "revisor_altera" on public.imersao_dias for update to authenticated using ((select public.tem_papel('revisor'))) with check ((select public.tem_papel('revisor')));
create policy "revisor_insere" on public.participantes for insert to authenticated with check ((select public.tem_papel('revisor')));
create policy "revisor_altera" on public.participantes for update to authenticated using ((select public.tem_papel('revisor'))) with check ((select public.tem_papel('revisor')));

-- Dupla ------------------------------------------------------------------------
-- A coluna parceiro_presenca_id não tem GRANT: só estas RPCs gravam, sempre os dois lados.
-- SECURITY DEFINER por isso; conferem o papel explicitamente.

create function public.definir_dupla(a uuid, b uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  pa public.participantes;
  pb public.participantes;
begin
  if not public.tem_papel('revisor') then
    raise exception 'Apenas revisor ou admin definem dupla.' using errcode = 'insufficient_privilege';
  end if;
  if a = b then
    raise exception 'Participante não pode formar dupla consigo mesmo.' using errcode = 'check_violation';
  end if;
  select * into pa from public.participantes where id = a for update;
  select * into pb from public.participantes where id = b for update;
  if pa.id is null or pb.id is null then
    raise exception 'Participante não encontrado.' using errcode = 'no_data_found';
  end if;
  if pa.turma_suporte_id <> pb.turma_suporte_id then
    raise exception 'A dupla precisa ser da mesma turma de suporte.' using errcode = 'check_violation';
  end if;
  if (pa.parceiro_presenca_id is not null and pa.parceiro_presenca_id <> b)
     or (pb.parceiro_presenca_id is not null and pb.parceiro_presenca_id <> a) then
    raise exception 'Participante já tem dupla.' using errcode = 'check_violation';
  end if;
  update public.participantes set parceiro_presenca_id = b where id = a;
  update public.participantes set parceiro_presenca_id = a where id = b;
end;
$$;

create function public.desfazer_dupla(a uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.tem_papel('revisor') then
    raise exception 'Apenas revisor ou admin desfazem dupla.' using errcode = 'insufficient_privilege';
  end if;
  update public.participantes set parceiro_presenca_id = null
  where id = a or parceiro_presenca_id = a;
end;
$$;

grant execute on function public.definir_dupla(uuid, uuid), public.desfazer_dupla(uuid) to authenticated;
