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

-- Convocação ---------------------------------------------------------------------
-- Quem está convocado para a sessão e com qual CS (a distribuição orienta, não bloqueia o registro: D3).

create table public.sessao_participantes (
  id uuid primary key default gen_random_uuid(),
  sessao_id uuid not null references public.sessoes (id) on delete restrict,
  participante_id uuid not null references public.participantes (id) on delete restrict,
  cs_id uuid references public.perfis (user_id) on delete restrict,
  registrado_por uuid references public.perfis (user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sessao_id, participante_id)
);

create index sessao_participantes_participante_idx on public.sessao_participantes (participante_id);
create index sessao_participantes_cs_idx on public.sessao_participantes (cs_id);
create index sessao_participantes_registrado_por_idx on public.sessao_participantes (registrado_por);

create trigger sessao_participantes_updated_at before update on public.sessao_participantes
  for each row execute function public.set_updated_at();
create trigger sessao_participantes_registrado_por before insert on public.sessao_participantes
  for each row execute function public.carimbar_registrado_por();

alter table public.sessao_participantes enable row level security;

-- Membro lê; revisor e admin convocam, distribuem e removem (a remoção com registro é barrada pela FK da fase 1c).
grant select, delete on public.sessao_participantes to authenticated;
grant insert (sessao_id, participante_id, cs_id) on public.sessao_participantes to authenticated;
grant update (cs_id) on public.sessao_participantes to authenticated;

create policy "membros_leem" on public.sessao_participantes for select to authenticated using ((select public.tem_papel('cs')));
create policy "revisor_insere" on public.sessao_participantes for insert to authenticated with check ((select public.tem_papel('revisor')));
create policy "revisor_altera" on public.sessao_participantes for update to authenticated
  using ((select public.tem_papel('revisor'))) with check ((select public.tem_papel('revisor')));
create policy "revisor_remove" on public.sessao_participantes for delete to authenticated using ((select public.tem_papel('revisor')));

-- Convoca e define o CS de cada um; chamar de novo redistribui. Tudo ou nada.
-- SECURITY INVOKER: quem grava é decidido pelo RLS acima.
create function public.distribuir_participantes(p_sessao uuid, p_itens jsonb)
returns int
language plpgsql
set search_path = ''
as $$
declare
  s public.sessoes;
  p public.participantes;
  item jsonb;
  v_participante uuid;
  v_cs uuid;
  n int := 0;
begin
  select * into s from public.sessoes where id = p_sessao;
  if s.id is null then
    raise exception 'Sessão não encontrada.' using errcode = 'no_data_found';
  end if;
  if s.status <> 'agendada' then
    raise exception 'Só é possível convocar para sessão agendada.' using errcode = 'check_violation';
  end if;

  for item in select value from jsonb_array_elements(p_itens) loop
    v_participante := (item ->> 'participante_id')::uuid;
    v_cs := nullif(item ->> 'cs_id', '')::uuid;
    select * into p from public.participantes where id = v_participante;
    if p.id is null then
      raise exception 'Participante não encontrado.' using errcode = 'no_data_found';
    end if;
    if p.turma_suporte_id <> s.turma_id then
      raise exception 'O participante precisa ser da turma de suporte da sessão.' using errcode = 'check_violation';
    end if;
    if v_cs is not null and not exists (select 1 from public.perfis where user_id = v_cs and ativo) then
      raise exception 'O CS precisa ter perfil ativo.' using errcode = 'check_violation';
    end if;
    insert into public.sessao_participantes (sessao_id, participante_id, cs_id)
    values (p_sessao, v_participante, v_cs)
    on conflict (sessao_id, participante_id) do update set cs_id = excluded.cs_id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

grant execute on function public.distribuir_participantes(uuid, jsonb) to authenticated;
