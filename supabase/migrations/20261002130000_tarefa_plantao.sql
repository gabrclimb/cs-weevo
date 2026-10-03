-- Tarefa de contato leve gerada a partir de um plantão (quem não veio).
-- Ao marcar "Enviei", o evento plantao_ausencia_contatada nasce ligado a esse plantão.
alter table public.weevo_tarefas
  add column plantao_id uuid references public.weevo_plantoes (id) on delete set null;

create index weevo_tarefas_plantao_idx on public.weevo_tarefas (plantao_id);
