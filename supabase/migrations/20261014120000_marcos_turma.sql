-- Datas da turma além dos plantões: o envio do NPS (um por turma) e datas livres (ex.: encerramento).
-- Valem para a turma toda: só data e concluído, sem marcação por participante.

create table public.weevo_marcos (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.weevo_turmas (id) on delete cascade,
  tipo text not null default 'outro' check (tipo in ('nps', 'outro')),
  titulo text not null check (btrim(titulo) <> ''),
  data date,
  horario time,
  observacoes text,
  concluido boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index weevo_marcos_turma_idx on public.weevo_marcos (turma_id, data);
create unique index weevo_marcos_nps_key on public.weevo_marcos (turma_id) where tipo = 'nps';

create trigger weevo_marcos_updated_at before update on public.weevo_marcos
  for each row execute function public.set_updated_at();

alter table public.weevo_marcos enable row level security;

create policy "admin_all" on public.weevo_marcos
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

grant select, insert, update, delete on public.weevo_marcos to authenticated;
