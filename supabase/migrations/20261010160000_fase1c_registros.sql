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
  new.registrado_em := clock_timestamp(); -- now() é fixo na transação; a ordem das versões precisa do instante real
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
  v_estado public.estados_presenca;
  v_sessao public.sessoes;
  v_participante uuid := (p ->> 'participante_id')::uuid;
  v_extra uuid;
  v_local timestamp;
begin
  select * into v_estado from public.estados_presenca where id = (p ->> 'presenca_id')::uuid;
  select * into v_sessao from public.sessoes where id = (p ->> 'sessao_id')::uuid;

  -- Remarcou (6.4): sessão extra que repõe o encontro, com o mesmo CS da convocação original.
  -- A sessão guarda data e hora locais; a nova data chega com fuso.
  if v_estado.pede_nova_data then
    if p ->> 'nova_data' is null then
      raise exception 'Informe a nova data da remarcação.' using errcode = 'check_violation';
    end if;
    v_local := (p ->> 'nova_data')::timestamptz at time zone 'America/Fortaleza';
    insert into public.sessoes (turma_id, tipo, repoe_numero, data, hora_inicio, hora_fim, formato, link)
    values (
      v_sessao.turma_id, 'extra', coalesce(v_sessao.numero, v_sessao.repoe_numero), v_local::date, v_local::time,
      case when v_sessao.hora_inicio is not null and v_sessao.hora_fim is not null
           then v_local::time + (v_sessao.hora_fim - v_sessao.hora_inicio) end,
      v_sessao.formato, v_sessao.link
    )
    returning id into v_extra;
    insert into public.sessao_participantes (sessao_id, participante_id, cs_id)
    select v_extra, v_participante, sp.cs_id
    from public.sessao_participantes sp
    where sp.sessao_id = v_sessao.id and sp.participante_id = v_participante;
  end if;

  insert into public.registros_encontro (
    sessao_id, participante_id, presenca_id, modalidade, motivo_id, motivo_texto, feito, planejado,
    cumpriu_planejado_anterior, status_projeto, travou_motivo_id, travou_texto, nova_data, sessao_extra_id,
    substitui_id, correcao_motivo_id, correcao_motivo_texto
  ) values (
    (p ->> 'sessao_id')::uuid, v_participante, (p ->> 'presenca_id')::uuid, p ->> 'modalidade',
    (p ->> 'motivo_id')::uuid, p ->> 'motivo_texto', p ->> 'feito', p ->> 'planejado',
    p ->> 'cumpriu_planejado_anterior', p ->> 'status_projeto', (p ->> 'travou_motivo_id')::uuid, p ->> 'travou_texto',
    (p ->> 'nova_data')::timestamptz, v_extra,
    (p ->> 'substitui_id')::uuid, (p ->> 'correcao_motivo_id')::uuid, p ->> 'correcao_motivo_texto'
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

-- Origem: import (carga da planilha) e webhook (CRM) só pelo service_role ou conexão direta ao banco.
-- Olha o papel do JWT e o da conexão, para valer também dentro de funções SECURITY DEFINER.
create function public.origem_confiavel()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'role', '') not in ('authenticated', 'anon')
     and current_user not in ('authenticated', 'anon');
$$;

grant execute on function public.origem_confiavel() to authenticated, service_role;

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
  alvo public.registros_encontro;
  tipo_motivo text;
begin
  if new.origem <> 'manual' and not public.origem_confiavel() then
    raise exception 'Registro com origem % só pode ser gravado pela carga (service_role).', new.origem using errcode = 'insufficient_privilege';
  end if;

  -- Correção e anulação (nova versão): o autor corrige o seu; o de outra pessoa (ou da carga) só revisor ou admin,
  -- com motivo de correção ou de anulação (chip + texto). Anulação sempre exige motivo (6.1).
  if new.substitui_id is not null then
    select * into alvo from public.registros_encontro where id = new.substitui_id;
    if alvo.anulado then
      raise exception 'Registro anulado não pode ser corrigido nem anulado de novo.' using errcode = 'check_violation';
    end if;
    tipo_motivo := case when new.anulado then 'anulacao' else 'correcao' end;
    if new.correcao_motivo_id is not null
       and (select tipo_registro from public.motivos where id = new.correcao_motivo_id) <> tipo_motivo then
      raise exception 'Escolha um motivo de %.', case when new.anulado then 'anulação' else 'correção' end using errcode = 'check_violation';
    end if;
    if alvo.registrado_por is distinct from new.registrado_por and new.origem = 'manual' then
      if not public.tem_papel('revisor') then
        raise exception 'Só revisor ou admin corrigem ou anulam registro de outra pessoa.' using errcode = 'insufficient_privilege';
      end if;
    end if;
    if (new.anulado or alvo.registrado_por is distinct from new.registrado_por)
       and (new.correcao_motivo_id is null or public.texto_vazio(new.correcao_motivo_texto)) then
      raise exception 'Informe o motivo da %.', case when new.anulado then 'anulação' else 'correção' end using errcode = 'check_violation';
    end if;
  end if;

  if new.anulado then
    return new;
  end if;
  select * into e from public.estados_presenca where id = new.presenca_id;

  if (select status from public.sessoes where id = new.sessao_id) = 'cancelada' then
    raise exception 'Não é possível registrar em sessão cancelada.' using errcode = 'check_violation';
  end if;

  if e.conta_presenca and new.modalidade is null then
    raise exception 'Informe a modalidade (presencial ou online).' using errcode = 'check_violation';
  end if;

  if e.pede_nova_data and new.nova_data is null and new.origem = 'manual' then
    raise exception 'Informe a nova data da remarcação.' using errcode = 'check_violation';
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
    -- Continuidade (6.5): havendo planejado num encontro anterior (de qualquer CS), diga se cumpriu.
    if new.cumpriu_planejado_anterior is null and exists (
      select 1
      from public.registros_encontro r
      join public.sessoes s on s.id = r.sessao_id
      join public.sessoes atual on atual.id = new.sessao_id
      where r.participante_id = new.participante_id
        and not r.anulado
        and not exists (select 1 from public.registros_encontro x where x.substitui_id = r.id)
        and not public.texto_vazio(r.planejado)
        and (s.data, coalesce(s.hora_inicio, '00:00')) < (atual.data, coalesce(atual.hora_inicio, '00:00'))
    ) then
      raise exception 'Diga se cumpriu o planejado do encontro anterior.' using errcode = 'check_violation';
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

-- A remarcação feita por qualquer cs convoca o participante na sessão extra criada para ele.
create policy "cs_convoca_em_extra" on public.sessao_participantes for insert to authenticated
  with check (
    (select public.tem_papel('cs'))
    and exists (select 1 from public.sessoes s where s.id = sessao_id and s.tipo = 'extra')
  );

-- Imutabilidade (5.4) ------------------------------------------------------------------
-- Além da falta de GRANT de UPDATE/DELETE, um trigger barra qualquer papel, inclusive service_role e postgres.
-- Correção e anulação são novas versões (substitui_id).

-- Única exceção: o --resetar da carga (seção 8.1) apaga linhas de origem import, só pelo service_role
-- e só enquanto configuracoes.carga_liberada = true (o admin desliga no lançamento).
create function public.reset_de_carga_permitido(p_origem text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_origem = 'import'
     and coalesce((select auth.jwt()) ->> 'role', '') = 'service_role'
     and coalesce((select valor = 'true'::jsonb from public.configuracoes where chave = 'carga_liberada'), false);
$$;

grant execute on function public.reset_de_carga_permitido(text) to authenticated, service_role;

create function public.bloquear_alteracao()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_origem text;
begin
  if tg_op = 'DELETE' then
    -- Um ramo por tabela: o plpgsql resolve o campo de old mesmo num CASE que não o usaria.
    if tg_table_name = 'registro_temas' then
      select r.origem into v_origem from public.registros_encontro r where r.id = old.registro_id;
    elsif tg_table_name = 'evidencias' then
      v_origem := null; -- a carga não cria evidências: nunca se apagam
    else
      v_origem := old.origem;
    end if;
    if public.reset_de_carga_permitido(v_origem) then
      return old;
    end if;
  end if;
  raise exception 'Registros não se alteram nem se apagam: corrija com uma nova versão.' using errcode = 'restrict_violation';
end;
$$;

create trigger registros_encontro_imutavel before update or delete on public.registros_encontro
  for each row execute function public.bloquear_alteracao();
create trigger registro_temas_imutavel before update or delete on public.registro_temas
  for each row execute function public.bloquear_alteracao();

-- Correção: nova versão do mesmo par sessão-participante, com as mesmas validações do registro.
create function public.corrigir_registro_encontro(p_substitui uuid, p jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_alvo public.registros_encontro;
begin
  select * into v_alvo from public.registros_encontro where id = p_substitui;
  if v_alvo.id is null then
    raise exception 'Registro não encontrado.' using errcode = 'no_data_found';
  end if;
  return public.registrar_encontro(
    p || jsonb_build_object('substitui_id', p_substitui, 'sessao_id', v_alvo.sessao_id, 'participante_id', v_alvo.participante_id)
  );
end;
$$;

grant execute on function public.corrigir_registro_encontro(uuid, jsonb) to authenticated;

-- Anulação: nova versão marcada como anulada; o par fica sem registro vigente. Motivo e autoria: trigger de validação.
create function public.anular_registro_encontro(p_registro uuid, p_motivo_id uuid, p_motivo_texto text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_alvo public.registros_encontro;
  v_id uuid;
begin
  select * into v_alvo from public.registros_encontro where id = p_registro;
  if v_alvo.id is null then
    raise exception 'Registro não encontrado.' using errcode = 'no_data_found';
  end if;
  insert into public.registros_encontro (
    sessao_id, participante_id, presenca_id, modalidade, substitui_id, anulado, correcao_motivo_id, correcao_motivo_texto
  ) values (
    v_alvo.sessao_id, v_alvo.participante_id, v_alvo.presenca_id, v_alvo.modalidade, v_alvo.id, true, p_motivo_id, p_motivo_texto
  )
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.anular_registro_encontro(uuid, uuid, text) to authenticated;
