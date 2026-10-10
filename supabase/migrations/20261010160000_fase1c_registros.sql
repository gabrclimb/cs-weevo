-- Fase 1c: registro do encontro (o ritual), imutável, com correção por nova versão.

create table public.registros_encontro (
  id uuid primary key default gen_random_uuid(),
  sessao_id uuid not null,
  participante_id uuid not null,
  presenca_id uuid not null references public.estados_presenca (id) on delete restrict,
  modalidade text check (modalidade in ('presencial', 'online')),
  motivo_id uuid references public.motivos (id) on delete restrict,
  motivo_texto text,
  feito text,
  planejado text,
  cumpriu_planejado_anterior text check (cumpriu_planejado_anterior in ('sim', 'parcial', 'nao')),
  status_projeto text check (status_projeto in ('rodando', 'travou', 'nao_comecou', 'sem_info')),
  travou_motivo_id uuid references public.motivos (id) on delete restrict,
  travou_texto text,
  nova_data timestamptz,
  sessao_extra_id uuid references public.sessoes (id) on delete restrict,
  correcao_motivo_id uuid references public.motivos (id) on delete restrict,
  correcao_motivo_texto text,
  substitui_id uuid unique,
  anulado boolean not null default false,
  origem text not null default 'manual' check (origem in ('manual', 'import')),
  registrado_por uuid references public.perfis (user_id) on delete restrict,
  registrado_em timestamptz not null default now(),
  -- Só convocado tem registro, e a convocação com registro não pode sair.
  foreign key (sessao_id, participante_id) references public.sessao_participantes (sessao_id, participante_id) on delete restrict,
  unique (id, sessao_id, participante_id),
  -- A correção é do mesmo par sessão-participante.
  foreign key (substitui_id, sessao_id, participante_id) references public.registros_encontro (id, sessao_id, participante_id) on delete restrict,
  constraint registros_autor check (registrado_por is not null or origem = 'import')
);

-- Uma cadeia de versões por par: só a primeira versão não substitui ninguém.
create unique index registros_encontro_primeira_versao on public.registros_encontro (sessao_id, participante_id) where substitui_id is null;
create index registros_encontro_participante_idx on public.registros_encontro (participante_id);
create index registros_encontro_presenca_idx on public.registros_encontro (presenca_id);
create index registros_encontro_motivo_idx on public.registros_encontro (motivo_id);
create index registros_encontro_travou_motivo_idx on public.registros_encontro (travou_motivo_id);
create index registros_encontro_correcao_motivo_idx on public.registros_encontro (correcao_motivo_id);
create index registros_encontro_sessao_extra_idx on public.registros_encontro (sessao_extra_id);
create index registros_encontro_registrado_por_idx on public.registros_encontro (registrado_por);

create table public.registro_temas (
  registro_id uuid not null references public.registros_encontro (id) on delete restrict,
  tema_id uuid not null references public.temas (id) on delete restrict,
  primary key (registro_id, tema_id)
);

create index registro_temas_tema_idx on public.registro_temas (tema_id);

-- Quem registrou e quando vêm sempre do banco.
create function public.carimbar_registro()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.registrado_por := (select auth.uid());
  new.registrado_em := now();
  return new;
end;
$$;

create trigger registros_encontro_carimbo before insert on public.registros_encontro
  for each row execute function public.carimbar_registro();

alter table public.registros_encontro enable row level security;
alter table public.registro_temas enable row level security;

grant select on public.registros_encontro, public.registro_temas to authenticated;
grant insert (sessao_id, participante_id, presenca_id, modalidade, motivo_id, motivo_texto, feito, planejado,
              cumpriu_planejado_anterior, status_projeto, travou_motivo_id, travou_texto, nova_data, sessao_extra_id,
              correcao_motivo_id, correcao_motivo_texto, substitui_id, anulado, origem)
  on public.registros_encontro to authenticated;
grant insert on public.registro_temas to authenticated;

create policy "membros_leem" on public.registros_encontro for select to authenticated using ((select public.tem_papel('cs')));
create policy "membros_registram" on public.registros_encontro for insert to authenticated with check ((select public.tem_papel('cs')));
create policy "membros_leem" on public.registro_temas for select to authenticated using ((select public.tem_papel('cs')));
create policy "membros_registram" on public.registro_temas for insert to authenticated with check ((select public.tem_papel('cs')));

-- RPC: registro do encontro, tudo ou nada. SECURITY INVOKER: RLS e triggers decidem e validam.
create function public.registrar_encontro(p jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.registros_encontro (
    sessao_id, participante_id, presenca_id, modalidade, motivo_id, motivo_texto, feito, planejado,
    cumpriu_planejado_anterior, status_projeto, travou_motivo_id, travou_texto, nova_data
  ) values (
    (p ->> 'sessao_id')::uuid, (p ->> 'participante_id')::uuid, (p ->> 'presenca_id')::uuid, p ->> 'modalidade',
    (p ->> 'motivo_id')::uuid, p ->> 'motivo_texto', p ->> 'feito', p ->> 'planejado',
    p ->> 'cumpriu_planejado_anterior', p ->> 'status_projeto', (p ->> 'travou_motivo_id')::uuid, p ->> 'travou_texto',
    (p ->> 'nova_data')::timestamptz
  )
  returning id into v_id;

  -- Mesma regra do constraint trigger, mas com erro na hora (a RPC é o caminho do front).
  if (select conta_presenca from public.estados_presenca where id = (p ->> 'presenca_id')::uuid)
     and jsonb_array_length(coalesce(p -> 'temas', '[]'::jsonb)) = 0 then
    raise exception 'Escolha pelo menos um tema trabalhado no encontro.' using errcode = 'check_violation';
  end if;

  insert into public.registro_temas (registro_id, tema_id)
  select v_id, t::uuid from jsonb_array_elements_text(coalesce(p -> 'temas', '[]'::jsonb)) as t;

  return v_id;
end;
$$;

grant execute on function public.registrar_encontro(jsonb) to authenticated;

-- Validação ----------------------------------------------------------------------
-- Dirigida pelos flags de estados_presenca, então segue valendo quando o admin cria estados.
-- Vale para manual; a carga (origem import) tem as exceções da seção 8.5. Anulação não repete os campos.

create function public.texto_vazio(t text)
returns boolean
language sql
immutable
set search_path = ''
as $$ select t is null or btrim(t) = '' $$;

-- Helper puro chamado pelos triggers no papel de quem grava (funções novas nascem sem EXECUTE: fase 0).
grant execute on function public.texto_vazio(text) to authenticated, service_role;

create function public.validar_registro_encontro()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  e public.estados_presenca;
begin
  if new.anulado then
    return new;
  end if;
  select * into e from public.estados_presenca where id = new.presenca_id;

  if e.conta_presenca and new.modalidade is null then
    raise exception 'Informe a modalidade (presencial ou online).' using errcode = 'check_violation';
  end if;

  -- Desvio do esperado: chip de falta (6.1) + texto. Na carga o texto pode faltar (célula sem nota).
  if e.pede_motivo then
    if new.motivo_id is null then
      raise exception 'Escolha o motivo.' using errcode = 'check_violation';
    end if;
    if (select tipo_registro from public.motivos where id = new.motivo_id) <> 'falta' then
      raise exception 'Escolha um motivo de falta ou remarcação.' using errcode = 'check_violation';
    end if;
    if new.origem = 'manual' and public.texto_vazio(new.motivo_texto) then
      raise exception 'Escreva o texto do motivo.' using errcode = 'check_violation';
    end if;
  end if;

  if e.conta_presenca and new.origem = 'manual' then
    if public.texto_vazio(new.feito) then
      raise exception 'Informe o que foi feito no encontro.' using errcode = 'check_violation';
    end if;
    if public.texto_vazio(new.planejado) then
      raise exception 'Informe o planejado para o próximo encontro.' using errcode = 'check_violation';
    end if;
    if new.status_projeto is null then
      raise exception 'Informe o status do projeto.' using errcode = 'check_violation';
    end if;
  end if;

  if new.status_projeto = 'travou' then
    if new.travou_motivo_id is null then
      raise exception 'Escolha o motivo do travamento.' using errcode = 'check_violation';
    end if;
    if (select tipo_registro from public.motivos where id = new.travou_motivo_id) <> 'travou' then
      raise exception 'Escolha um motivo de travamento.' using errcode = 'check_violation';
    end if;
    if new.origem = 'manual' and public.texto_vazio(new.travou_texto) then
      raise exception 'Escreva o texto do travamento.' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger registros_encontro_validar before insert on public.registros_encontro
  for each row execute function public.validar_registro_encontro();

-- Temas: chegam depois do registro (outra tabela), então a conferência é no fim da transação.
create function public.conferir_temas_do_registro()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not new.anulado and new.origem = 'manual'
     and (select conta_presenca from public.estados_presenca where id = new.presenca_id)
     and not exists (select 1 from public.registro_temas where registro_id = new.id) then
    raise exception 'Escolha pelo menos um tema trabalhado no encontro.' using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

create constraint trigger registros_encontro_temas after insert on public.registros_encontro
  deferrable initially deferred
  for each row execute function public.conferir_temas_do_registro();
