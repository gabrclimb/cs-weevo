-- Fase 1c: linha do tempo do participante (eventos) e evidências. Imutável, como os registros.

create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  participante_id uuid not null references public.participantes (id) on delete restrict,
  fase text not null check (fase in ('imersao', 'suporte', 'comunidade', 'fechamento')),
  tipo text not null check (tipo in (
    'imersao_presenca', 'projeto_definido', 'cadastro_plataforma', 'contato_privado', 'resposta_recebida',
    'suporte_extra_pedido', 'suporte_transferido', 'saiu_do_suporte', 'retornou_ao_suporte', 'pesquisa', 'dificuldade',
    'interacao_grupo', 'sinal_interesse', 'funil_etapa', 'ganho_declarado', 'evidencia', 'depoimento', 'nota'
  )),
  ocorrido_em timestamptz not null default now(),
  data_aproximada boolean not null default false,
  motivo_id uuid references public.motivos (id) on delete restrict,
  motivo_texto text,
  dados jsonb not null default '{}',
  sessao_id uuid references public.sessoes (id) on delete restrict,
  registro_id uuid references public.registros_encontro (id) on delete restrict,
  correcao_motivo_id uuid references public.motivos (id) on delete restrict,
  correcao_motivo_texto text,
  substitui_id uuid unique,
  anulado boolean not null default false,
  origem text not null default 'manual' check (origem in ('manual', 'import', 'webhook')),
  registrado_por uuid references public.perfis (user_id) on delete restrict,
  registrado_em timestamptz not null default now(),
  unique (id, participante_id),
  foreign key (substitui_id, participante_id) references public.eventos (id, participante_id) on delete restrict,
  constraint eventos_autor check (registrado_por is not null or origem in ('import', 'webhook'))
);

create index eventos_participante_idx on public.eventos (participante_id, ocorrido_em desc);
create index eventos_tipo_idx on public.eventos (tipo);
create index eventos_motivo_idx on public.eventos (motivo_id);
create index eventos_correcao_motivo_idx on public.eventos (correcao_motivo_id);
create index eventos_sessao_idx on public.eventos (sessao_id);
create index eventos_registro_idx on public.eventos (registro_id);
create index eventos_registrado_por_idx on public.eventos (registrado_por);

create table public.evidencias (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos (id) on delete restrict,
  participante_id uuid not null references public.participantes (id) on delete restrict,
  tipo text not null check (tipo in ('imagem', 'video', 'link')),
  storage_path text,
  url text,
  registrado_por uuid references public.perfis (user_id) on delete restrict,
  registrado_em timestamptz not null default now(),
  constraint evidencias_arquivo_ou_link check ((tipo = 'link') = (url is not null and storage_path is null)
                                               and (tipo = 'link' or storage_path is not null))
);

create index evidencias_evento_idx on public.evidencias (evento_id);
create index evidencias_participante_idx on public.evidencias (participante_id);
create index evidencias_registrado_por_idx on public.evidencias (registrado_por);

-- Fase de cada tipo (nota vale para qualquer fase e precisa vir informada).
create function public.fase_do_tipo(p_tipo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_tipo in ('imersao_presenca', 'projeto_definido', 'cadastro_plataforma') then 'imersao'
    when p_tipo in ('interacao_grupo') then 'comunidade'
    when p_tipo in ('sinal_interesse', 'funil_etapa') then 'fechamento'
    when p_tipo = 'nota' then null
    else 'suporte'
  end
$$;

-- Formato de dados por tipo (5.3). Devolve o problema encontrado, ou null se estiver certo.
create function public.problema_nos_dados(p_tipo text, d jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  permitidas text[];
  k text;
begin
  if d is null or jsonb_typeof(d) <> 'object' then
    return 'dados precisa ser um objeto';
  end if;
  permitidas := case p_tipo
    when 'imersao_presenca' then array['dia', 'presente']
    when 'projeto_definido' then array['projeto']
    when 'cadastro_plataforma' then array['valor', 'conferido']
    when 'contato_privado' then array['objetivo', 'texto']
    when 'resposta_recebida' then array['texto']
    when 'suporte_transferido' then array['de_turma', 'para_turma']
    when 'pesquisa' then array['tipo', 'respondeu', 'nota']
    when 'dificuldade' then array['texto']
    when 'interacao_grupo' then array['estado']
    when 'sinal_interesse' then array['texto']
    when 'funil_etapa' then array['de', 'para', 'responsavel_id']
    when 'ganho_declarado' then array['antes', 'depois', 'unidade']
    when 'evidencia' then array['descricao']
    when 'depoimento' then array['frase']
    when 'nota' then array['texto']
    else array[]::text[]  -- suporte_extra_pedido, saiu_do_suporte, retornou_ao_suporte: o motivo diz tudo
  end;
  for k in select jsonb_object_keys(d) loop
    if not k = any (permitidas) then
      return format('o campo %s não existe para %s', k, p_tipo);
    end if;
  end loop;

  -- Campos obrigatórios e valores aceitos. Campo ausente vira '' (não NULL), para o IF não aceitar por omissão.
  if p_tipo = 'imersao_presenca' and not (coalesce(jsonb_typeof(d -> 'dia'), '') = 'string' and coalesce(jsonb_typeof(d -> 'presente'), '') = 'boolean') then
    return 'informe o dia e se esteve presente';
  elsif p_tipo = 'cadastro_plataforma' and not (
    d ->> 'valor' in ('sim', 'informou_que_iria', 'nao', 'nao_informado') and coalesce(jsonb_typeof(d -> 'conferido'), '') = 'boolean') then
    return 'valor precisa ser sim, informou_que_iria, nao ou nao_informado, e conferido verdadeiro ou falso';
  elsif p_tipo = 'contato_privado' and coalesce(d ->> 'objetivo', '') not in ('convite', 'check_in', 'lembrete', 'pesquisa', 'outro') then
    return 'objetivo precisa ser convite, check_in, lembrete, pesquisa ou outro';
  elsif p_tipo = 'suporte_transferido' and jsonb_typeof(d -> 'para_turma') is distinct from 'string' then
    return 'informe a turma de destino';
  elsif p_tipo = 'pesquisa' and not (
    d ->> 'tipo' in ('nps_imersao', 'ces', 'nps_suporte') and coalesce(jsonb_typeof(d -> 'respondeu'), '') = 'boolean'
    and (d -> 'nota' is null or coalesce(jsonb_typeof(d -> 'nota'), '') = 'number')) then
    return 'pesquisa precisa de tipo (nps_imersao, ces, nps_suporte), respondeu e nota numérica opcional';
  elsif p_tipo = 'interacao_grupo' and coalesce(d ->> 'estado', '') not in ('sim', 'so_le', 'sem_sinal') then
    return 'estado precisa ser sim, so_le ou sem_sinal';
  elsif p_tipo = 'funil_etapa' and jsonb_typeof(d -> 'para') is distinct from 'string' then
    return 'informe a etapa de destino';
  elsif p_tipo = 'ganho_declarado' and not (
    coalesce(jsonb_typeof(d -> 'antes'), '') in ('string', 'number') and coalesce(jsonb_typeof(d -> 'depois'), '') in ('string', 'number')) then
    return 'informe o antes e o depois';
  end if;

  -- Textos obrigatórios e opcionais.
  k := case p_tipo
    when 'projeto_definido' then 'projeto' when 'dificuldade' then 'texto' when 'sinal_interesse' then 'texto'
    when 'depoimento' then 'frase' when 'nota' then 'texto'
  end;
  if k is not null and (jsonb_typeof(d -> k) is distinct from 'string' or btrim(d ->> k) = '') then
    return format('informe %s', k);
  end if;
  foreach k in array array['texto', 'descricao', 'unidade'] loop
    if d -> k is not null and jsonb_typeof(d -> k) <> 'string' then
      return format('%s precisa ser texto', k);
    end if;
  end loop;
  return null;
end;
$$;

create function public.validar_evento()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  problema text;
  fase_esperada text;
  tipo_motivo text;
  tipo_correcao text;
  alvo public.eventos;
begin
  if new.origem <> 'manual' and not public.origem_confiavel() then
    raise exception 'Evento com origem % só pode ser gravado pela carga ou pela integração (service_role).', new.origem
      using errcode = 'insufficient_privilege';
  end if;

  fase_esperada := public.fase_do_tipo(new.tipo);
  if new.fase is null then
    new.fase := fase_esperada;
  end if;

  -- Correção e anulação: mesmas regras dos registros de encontro.
  if new.substitui_id is not null then
    select * into alvo from public.eventos where id = new.substitui_id;
    if alvo.anulado then
      raise exception 'Evento anulado não pode ser corrigido nem anulado de novo.' using errcode = 'check_violation';
    end if;
    if new.tipo <> alvo.tipo then
      raise exception 'A correção mantém o tipo do evento; para mudar o tipo, anule e registre outro.' using errcode = 'check_violation';
    end if;
    tipo_correcao := case when new.anulado then 'anulacao' else 'correcao' end;
    if new.correcao_motivo_id is not null
       and (select tipo_registro from public.motivos where id = new.correcao_motivo_id) <> tipo_correcao then
      raise exception 'Escolha um motivo de %.', case when new.anulado then 'anulação' else 'correção' end using errcode = 'check_violation';
    end if;
    if alvo.registrado_por is distinct from new.registrado_por and new.origem = 'manual' and not public.tem_papel('revisor') then
      raise exception 'Só revisor ou admin corrigem ou anulam evento de outra pessoa.' using errcode = 'insufficient_privilege';
    end if;
    if (new.anulado or alvo.registrado_por is distinct from new.registrado_por)
       and (new.correcao_motivo_id is null or public.texto_vazio(new.correcao_motivo_texto)) then
      raise exception 'Informe o motivo da %.', case when new.anulado then 'anulação' else 'correção' end using errcode = 'check_violation';
    end if;
  end if;

  if new.anulado then
    return new;
  end if;

  problema := public.problema_nos_dados(new.tipo, new.dados);
  if problema is not null then
    raise exception 'Dados inválidos para %: %.', new.tipo, problema using errcode = 'check_violation';
  end if;

  if fase_esperada is null and new.fase is null then
    raise exception 'Informe a fase da nota.' using errcode = 'check_violation';
  end if;
  if fase_esperada is not null and new.fase <> fase_esperada then
    raise exception 'A fase de % é %.', new.tipo, fase_esperada using errcode = 'check_violation';
  end if;

  -- Desvio do esperado (6.1): chip do tipo certo + texto (a carga pode vir sem texto).
  tipo_motivo := case
    when new.tipo = 'suporte_extra_pedido' then 'suporte_extra'
    when new.tipo = 'suporte_transferido' then 'transferencia'
    when new.tipo = 'saiu_do_suporte' then 'saida_suporte'
    when new.tipo = 'imersao_presenca' and new.dados -> 'presente' = 'false'::jsonb then 'falta'
  end;
  if tipo_motivo is not null then
    if new.motivo_id is null then
      raise exception 'Escolha o motivo.' using errcode = 'check_violation';
    end if;
    if (select tipo_registro from public.motivos where id = new.motivo_id) <> tipo_motivo then
      raise exception 'Escolha um motivo do tipo %.', tipo_motivo using errcode = 'check_violation';
    end if;
    if new.origem = 'manual' and public.texto_vazio(new.motivo_texto) then
      raise exception 'Escreva o texto do motivo.' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger eventos_carimbo before insert on public.eventos
  for each row execute function public.carimbar_registro();
create trigger eventos_validar before insert on public.eventos
  for each row execute function public.validar_evento();
create trigger eventos_imutavel before update or delete on public.eventos
  for each row execute function public.bloquear_alteracao();
create trigger evidencias_carimbo before insert on public.evidencias
  for each row execute function public.carimbar_registro();

grant execute on function public.fase_do_tipo(text), public.problema_nos_dados(text, jsonb) to authenticated, service_role;

alter table public.eventos enable row level security;
alter table public.evidencias enable row level security;

grant select on public.eventos, public.evidencias to authenticated;
grant insert (participante_id, fase, tipo, ocorrido_em, data_aproximada, motivo_id, motivo_texto, dados, sessao_id, registro_id,
              correcao_motivo_id, correcao_motivo_texto, substitui_id, anulado, origem)
  on public.eventos to authenticated;
grant insert (evento_id, participante_id, tipo, storage_path, url) on public.evidencias to authenticated;

create policy "membros_leem" on public.eventos for select to authenticated using ((select public.tem_papel('cs')));
create policy "membros_registram" on public.eventos for insert to authenticated with check ((select public.tem_papel('cs')));
create policy "membros_leem" on public.evidencias for select to authenticated using ((select public.tem_papel('cs')));
create policy "membros_registram" on public.evidencias for insert to authenticated with check ((select public.tem_papel('cs')));

-- RPC: um evento na linha do tempo. SECURITY INVOKER: RLS e triggers decidem e validam.
create function public.registrar_evento(p jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.eventos (
    participante_id, fase, tipo, ocorrido_em, data_aproximada, motivo_id, motivo_texto, dados, sessao_id, registro_id,
    substitui_id, correcao_motivo_id, correcao_motivo_texto
  ) values (
    (p ->> 'participante_id')::uuid, p ->> 'fase', p ->> 'tipo', coalesce((p ->> 'ocorrido_em')::timestamptz, now()),
    coalesce((p ->> 'data_aproximada')::boolean, false), (p ->> 'motivo_id')::uuid, p ->> 'motivo_texto',
    coalesce(p -> 'dados', '{}'::jsonb), (p ->> 'sessao_id')::uuid, (p ->> 'registro_id')::uuid,
    (p ->> 'substitui_id')::uuid, (p ->> 'correcao_motivo_id')::uuid, p ->> 'correcao_motivo_texto'
  )
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.registrar_evento(jsonb) to authenticated;

-- Correção: nova versão do mesmo evento (mesmo participante e tipo), com as mesmas validações.
create function public.corrigir_evento(p_substitui uuid, p jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_alvo public.eventos;
begin
  select * into v_alvo from public.eventos where id = p_substitui;
  if v_alvo.id is null then
    raise exception 'Evento não encontrado.' using errcode = 'no_data_found';
  end if;
  return public.registrar_evento(p || jsonb_build_object('substitui_id', p_substitui, 'participante_id', v_alvo.participante_id));
end;
$$;

-- Anulação: nova versão marcada como anulada (copia o essencial; validação de dados não se aplica).
create function public.anular_evento(p_evento uuid, p_motivo_id uuid, p_motivo_texto text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_alvo public.eventos;
  v_id uuid;
begin
  select * into v_alvo from public.eventos where id = p_evento;
  if v_alvo.id is null then
    raise exception 'Evento não encontrado.' using errcode = 'no_data_found';
  end if;
  insert into public.eventos (participante_id, fase, tipo, ocorrido_em, dados, substitui_id, anulado, correcao_motivo_id, correcao_motivo_texto)
  values (v_alvo.participante_id, v_alvo.fase, v_alvo.tipo, v_alvo.ocorrido_em, v_alvo.dados, v_alvo.id, true, p_motivo_id, p_motivo_texto)
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.corrigir_evento(uuid, jsonb), public.anular_evento(uuid, uuid, text) to authenticated;
