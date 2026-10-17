-- Colunas personalizadas dos kanbans. Cada quadro (tarefas por status, participantes por status, etc.)
-- tem as colunas fixas do sistema e pode ganhar colunas criadas pela equipe.

create table public.weevo_kanban_colunas (
  id uuid primary key default gen_random_uuid(),
  quadro text not null check (quadro in (
    'tarefas',
    'participantes.status',
    'participantes.weevo_start',
    'participantes.responsavel',
    'participantes.dia_escolhido',
    'participantes.cadastro_plataforma',
    'turmas.situacao',
    'turmas.tipo'
  )),
  titulo text not null check (btrim(titulo) <> ''),
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  unique (quadro, id)
);

create unique index weevo_kanban_colunas_titulo_key on public.weevo_kanban_colunas (quadro, lower(btrim(titulo)));

-- Item (tarefa, participante, turma) colocado numa coluna personalizada. `valor_base` guarda o valor do
-- campo do quadro (ex.: o status) no momento em que o card entrou na coluna: se o campo mudar por outro
-- caminho, o card volta para a coluna fixa correspondente. Excluir a coluna devolve os cards.
create table public.weevo_kanban_cards (
  quadro text not null,
  item_id uuid not null,
  coluna_id uuid not null,
  valor_base text not null,
  created_at timestamptz not null default now(),
  primary key (quadro, item_id),
  foreign key (quadro, coluna_id) references public.weevo_kanban_colunas (quadro, id) on delete cascade
);

create index weevo_kanban_cards_coluna_idx on public.weevo_kanban_cards (coluna_id);

alter table public.weevo_kanban_colunas enable row level security;
alter table public.weevo_kanban_cards enable row level security;

create policy "admin_all" on public.weevo_kanban_colunas
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin_all" on public.weevo_kanban_cards
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

grant select, insert, update, delete on public.weevo_kanban_colunas, public.weevo_kanban_cards to authenticated;
