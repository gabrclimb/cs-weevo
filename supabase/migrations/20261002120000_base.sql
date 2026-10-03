-- Weevo Controle: esquema base (fase 1a)
-- Todas as tabelas com RLS restrita a admins desde a primeira migration.

-- ---------------------------------------------------------------------------
-- Admins e is_admin()
-- ---------------------------------------------------------------------------

create table public.weevo_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.weevo_admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.weevo_admins where user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Cada usuário só enxerga a própria linha (para o app saber se é admin).
-- Inserção de admins é feita por SQL com service role.
create policy "admins_select_self" on public.weevo_admins
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Turmas
-- ---------------------------------------------------------------------------

create table public.weevo_turmas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  tipo text not null default 'aberta' check (tipo in ('aberta', 'in_company')),
  data_imersao date,
  link_grupo text,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger weevo_turmas_updated_at before update on public.weevo_turmas
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Plantões
-- ---------------------------------------------------------------------------

create table public.weevo_plantoes (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.weevo_turmas (id) on delete cascade,
  numero int not null check (numero between 1 and 4),
  data date,
  horario time,
  formato text not null default 'online' check (formato in ('presencial', 'online')),
  link text,
  realizado boolean not null default false,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (turma_id, numero)
);

create trigger weevo_plantoes_updated_at before update on public.weevo_plantoes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Participantes
-- ---------------------------------------------------------------------------

create table public.weevo_participantes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  apelido text,
  telefone text check (telefone is null or telefone ~ '^\+55\d{10,11}$'),
  empresa text,
  turma_id uuid references public.weevo_turmas (id) on delete set null,
  status text not null default 'ativo'
    check (status in ('ativo', 'aguardando', 'sem_resposta', 'inativo')),
  weevo_start text not null default 'nao_avaliado'
    check (weevo_start in ('nao_avaliado', 'candidato', 'repassado_comercial', 'assinante', 'recusou')),
  implementou boolean not null default false,
  ultimo_contato_em timestamptz,
  ultima_resposta_em timestamptz,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index weevo_participantes_telefone_key
  on public.weevo_participantes (telefone) where telefone is not null;
create index weevo_participantes_turma_idx on public.weevo_participantes (turma_id);

create trigger weevo_participantes_updated_at before update on public.weevo_participantes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Templates
-- ---------------------------------------------------------------------------

create table public.message_template_categories (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.message_template_categories (id) on delete set null,
  titulo text not null,
  conteudo text not null,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger message_templates_updated_at before update on public.message_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tarefas
-- ---------------------------------------------------------------------------

create table public.weevo_tarefas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo text not null default 'mensagem_privada'
    check (tipo in ('mensagem_privada', 'conteudo_grupo', 'plantao', 'ligacao', 'interna')),
  status text not null default 'a_fazer'
    check (status in ('a_fazer', 'em_andamento', 'aguardando_resposta', 'feito')),
  participante_id uuid references public.weevo_participantes (id) on delete cascade,
  turma_id uuid references public.weevo_turmas (id) on delete cascade,
  parent_id uuid references public.weevo_tarefas (id) on delete set null,
  para_quem text,
  data text,
  data_prevista date,
  horario time,
  canal text,
  objetivo text,
  mensagem text,
  enviado_em timestamptz,
  respondido_em timestamptz,
  resultado text,
  ordem double precision not null default 0,
  import_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weevo_tarefas_vinculo_unico
    check (participante_id is null or turma_id is null)
);

create index weevo_tarefas_participante_idx on public.weevo_tarefas (participante_id);
create index weevo_tarefas_turma_idx on public.weevo_tarefas (turma_id);
create index weevo_tarefas_parent_idx on public.weevo_tarefas (parent_id);
create index weevo_tarefas_status_idx on public.weevo_tarefas (status);

create trigger weevo_tarefas_updated_at before update on public.weevo_tarefas
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Eventos (linha do tempo, imutável)
-- ---------------------------------------------------------------------------

create table public.weevo_eventos (
  id uuid primary key default gen_random_uuid(),
  participante_id uuid not null references public.weevo_participantes (id) on delete cascade,
  tipo text not null check (tipo in (
    'mensagem_enviada', 'resposta_recebida', 'ligacao', 'plantao_presenca',
    'plantao_ausencia_contatada', 'interacao_grupo', 'implementou',
    'status_alterado', 'repassado_comercial', 'nota'
  )),
  ocorrido_em timestamptz not null default now(),
  tarefa_id uuid references public.weevo_tarefas (id) on delete set null,
  plantao_id uuid references public.weevo_plantoes (id) on delete cascade,
  categoria text check (categoria is null or categoria in (
    'confirmou', 'duvida_tecnica', 'evidencia_implementacao',
    'interesse_continuar', 'sinal_desistencia', 'so_conversa'
  )),
  nota text,
  origem text not null default 'manual' check (origem in ('manual', 'import', 'webhook')),
  created_at timestamptz not null default now()
);

create index weevo_eventos_participante_idx
  on public.weevo_eventos (participante_id, ocorrido_em desc);
create index weevo_eventos_tarefa_idx on public.weevo_eventos (tarefa_id);
create unique index weevo_eventos_presenca_key
  on public.weevo_eventos (participante_id, plantao_id) where tipo = 'plantao_presenca';

-- Campos derivados do participante (último contato, última resposta, implementou)
-- são recalculados a partir dos eventos, inclusive quando um evento é excluído.
create or replace function public.weevo_recalcular_participante()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid uuid := coalesce(new.participante_id, old.participante_id);
begin
  update public.weevo_participantes p set
    ultimo_contato_em = (
      select max(e.ocorrido_em) from public.weevo_eventos e
      where e.participante_id = pid and e.tipo in ('mensagem_enviada', 'ligacao')
    ),
    ultima_resposta_em = (
      select max(e.ocorrido_em) from public.weevo_eventos e
      where e.participante_id = pid and e.tipo = 'resposta_recebida'
    ),
    implementou = exists (
      select 1 from public.weevo_eventos e
      where e.participante_id = pid and e.tipo = 'implementou'
    )
  where p.id = pid;
  return null;
end;
$$;

create trigger weevo_eventos_recalcular
  after insert or delete on public.weevo_eventos
  for each row execute function public.weevo_recalcular_participante();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.weevo_turmas enable row level security;
alter table public.weevo_plantoes enable row level security;
alter table public.weevo_participantes enable row level security;
alter table public.message_template_categories enable row level security;
alter table public.message_templates enable row level security;
alter table public.weevo_tarefas enable row level security;
alter table public.weevo_eventos enable row level security;

create policy "admin_all" on public.weevo_turmas
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin_all" on public.weevo_plantoes
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin_all" on public.weevo_participantes
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin_all" on public.message_template_categories
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin_all" on public.message_templates
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin_all" on public.weevo_tarefas
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Eventos: sem UPDATE pela interface (registro imutável).
create policy "admin_select" on public.weevo_eventos
  for select to authenticated using ((select public.is_admin()));
create policy "admin_insert" on public.weevo_eventos
  for insert to authenticated with check ((select public.is_admin()));
create policy "admin_delete" on public.weevo_eventos
  for delete to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.weevo_tarefas;
alter publication supabase_realtime add table public.weevo_participantes;
alter publication supabase_realtime add table public.weevo_eventos;
