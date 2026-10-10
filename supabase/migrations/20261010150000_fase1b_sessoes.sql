-- Fase 1b: sessões de suporte (coringa: horário escolhido ou plantão) e convocação com CS.

create table public.sessoes (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turmas (id) on delete restrict,
  tipo text not null check (tipo in ('regular', 'extra')),
  numero int,          -- encontro 1..n da turma (regular)
  repoe_numero int,    -- encontro que a extra repõe (remarcação)
  data date not null,
  hora_inicio time,
  hora_fim time,
  formato text not null check (formato in ('presencial', 'online')),
  link text,
  status text not null default 'agendada' check (status in ('agendada', 'realizada', 'cancelada')),
  registrado_por uuid references public.perfis (user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sessoes_regular_ou_extra check (
    (tipo = 'regular' and numero is not null and numero >= 1 and repoe_numero is null)
    or (tipo = 'extra' and numero is null and (repoe_numero is null or repoe_numero >= 1))
  ),
  constraint sessoes_horario check (hora_fim is null or hora_inicio is null or hora_fim > hora_inicio)
);

create index sessoes_turma_idx on public.sessoes (turma_id, data);
create index sessoes_registrado_por_idx on public.sessoes (registrado_por);

create trigger sessoes_updated_at before update on public.sessoes
  for each row execute function public.set_updated_at();
create trigger sessoes_registrado_por before insert on public.sessoes
  for each row execute function public.carimbar_registrado_por();

alter table public.sessoes enable row level security;

-- O mesmo encontro pode ter várias sessões (dias e horários diferentes, 8.3), mas não duas iguais.
-- Extras não entram: duas remarcações para o mesmo horário podem ou não dividir a sessão.
create unique index sessoes_regular_key on public.sessoes (turma_id, numero, data, hora_inicio) nulls not distinct
  where tipo = 'regular';

-- Acesso: membro lê; cs cria só extra (remarcação, suporte extra); revisor e admin criam e remarcam.
-- status muda por RPC (fechar/cancelar, fase 1c). Ninguém apaga: cancelar.
grant select on public.sessoes to authenticated;
grant insert (turma_id, tipo, numero, repoe_numero, data, hora_inicio, hora_fim, formato, link) on public.sessoes to authenticated;
grant update (data, hora_inicio, hora_fim, formato, link) on public.sessoes to authenticated;

create policy "membros_leem" on public.sessoes for select to authenticated using ((select public.tem_papel('cs')));
create policy "cria_conforme_papel" on public.sessoes for insert to authenticated
  with check ((select public.tem_papel('revisor')) or (tipo = 'extra' and (select public.tem_papel('cs'))));
create policy "revisor_altera" on public.sessoes for update to authenticated
  using ((select public.tem_papel('revisor'))) with check ((select public.tem_papel('revisor')));
