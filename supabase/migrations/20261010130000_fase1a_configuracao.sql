-- Fase 1a: listas configuráveis (estados de presença, motivos, temas, funil) e parâmetros.
-- Nada aqui se apaga: o que sai de uso é desativado (ativo = false), porque registros antigos apontam para cá.

create table public.estados_presenca (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  rotulo text not null check (btrim(rotulo) <> ''),
  conta_presenca boolean not null,   -- veio: exige os campos do encontro e conta na presença
  pede_motivo boolean not null,
  pede_nova_data boolean not null,   -- remarcou: cria a sessão extra
  ativo boolean not null default true, -- disponível para registros novos
  ordem int not null,
  created_at timestamptz not null default now()
);

create table public.motivos (
  id uuid primary key default gen_random_uuid(),
  tipo_registro text not null check (tipo_registro in (
    'falta', 'travou', 'suporte_extra', 'transferencia', 'saida_suporte', 'recusa_weevo_start', 'anulacao', 'correcao'
  )),
  rotulo text not null check (btrim(rotulo) <> ''),
  ordem int not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tipo_registro, rotulo)
);

create table public.temas (
  id uuid primary key default gen_random_uuid(),
  rotulo text not null unique check (btrim(rotulo) <> ''),
  ordem int not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.funil_etapas (
  id uuid primary key default gen_random_uuid(),
  rotulo text not null unique check (btrim(rotulo) <> ''),
  ordem int not null,
  final text check (final in ('sucesso', 'perda')),
  pede_motivo boolean not null default false,
  tipo_motivo text check (tipo_motivo in (
    'falta', 'travou', 'suporte_extra', 'transferencia', 'saida_suporte', 'recusa_weevo_start', 'anulacao', 'correcao'
  )),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  check (pede_motivo = (tipo_motivo is not null))
);

create table public.configuracoes (
  chave text primary key,
  valor jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.perfis (user_id) on delete restrict
);

alter table public.estados_presenca enable row level security;
alter table public.motivos enable row level security;
alter table public.temas enable row level security;
alter table public.funil_etapas enable row level security;
alter table public.configuracoes enable row level security;

-- Membros ativos leem tudo.
grant select on public.estados_presenca, public.motivos, public.temas, public.funil_etapas, public.configuracoes to authenticated;

create policy "membros_leem" on public.estados_presenca for select to authenticated using ((select public.tem_papel('cs')));
create policy "membros_leem" on public.motivos for select to authenticated using ((select public.tem_papel('cs')));
create policy "membros_leem" on public.temas for select to authenticated using ((select public.tem_papel('cs')));
create policy "membros_leem" on public.funil_etapas for select to authenticated using ((select public.tem_papel('cs')));
create policy "membros_leem" on public.configuracoes for select to authenticated using ((select public.tem_papel('cs')));

-- Seeds -------------------------------------------------------------------

insert into public.estados_presenca (chave, rotulo, conta_presenca, pede_motivo, pede_nova_data, ativo, ordem) values
  ('veio', 'Veio', true, false, false, true, 1),
  ('nao_veio', 'Não veio', false, true, false, true, 2),
  ('nao_respondeu', 'Não respondeu ao convite', false, true, false, true, 3),
  ('remarcou', 'Remarcou', false, true, true, true, 4),
  ('confirmou_nao_veio', 'Confirmou e não veio', false, true, false, false, 5);

insert into public.motivos (tipo_registro, rotulo, ordem)
select tipo, rotulo, ordem
from (values
  ('falta', array['Compromisso de trabalho', 'Viagem', 'Confundiu a data', 'Imprevisto na empresa', 'Saúde', 'Depende de terceiros', 'Não informou', 'Outro']),
  ('travou', array['Acesso ou conta', 'Ferramenta', 'Dado ou integração', 'Tempo', 'Não sabe o próximo passo', 'Depende de terceiros', 'Outro']),
  ('suporte_extra', array['Repor encontro perdido', 'Travou na ferramenta', 'Escopo maior que o previsto', 'Não consegue vir aos encontros', 'Pedido do participante', 'Outro']),
  ('transferencia', array['Sem computador', 'Agenda', 'Pedido do participante', 'Outro']),
  ('saida_suporte', array['Não precisa de suporte', 'Desistiu', 'Participou como convidado', 'Outro']),
  ('recusa_weevo_start', array['Preço', 'Momento', 'Não vê valor', 'Já resolveu o que queria', 'Sem resposta', 'Outro']),
  ('anulacao', array['Lançado por engano', 'Duplicado', 'Outro']),
  ('correcao', array['Dado incorreto', 'Complemento', 'Outro'])
) as t (tipo, rotulos),
lateral unnest(rotulos) with ordinality as r (rotulo, ordem);

insert into public.temas (rotulo, ordem)
select rotulo, ordem
from unnest(array[
  'Cowork', 'Sistema/aplicação', 'Dashboard', 'Agente', 'Automação', 'Banco de dados',
  'Publicar/domínio', 'GitHub', 'Plataforma Weevo Start', 'Outro'
]) with ordinality as t (rotulo, ordem);

insert into public.funil_etapas (rotulo, ordem, final, pede_motivo, tipo_motivo) values
  ('Não avaliado', 1, null, false, null),
  ('Candidato', 2, null, false, null),
  ('Em abordagem', 3, null, false, null),
  ('Em conversa', 4, null, false, null),
  ('Assinou', 5, 'sucesso', false, null),
  ('Recusou', 6, 'perda', true, 'recusa_weevo_start');

insert into public.configuracoes (chave, valor) values
  ('pesos', '{"status_projeto": 30, "presenca": 20, "resposta": 15, "grupo": 15, "plataforma": 10, "interesse": 10}'),
  ('faixas', '{"quente": 70, "morno": 40}'),
  ('alertas', '{"sem_contato_dias": 10, "contato_sem_resposta_horas": 48, "sessao_sem_registro_dias": 1}'),
  -- O admin desliga no lançamento: daí em diante a carga da planilha não pode mais ser resetada.
  ('carga_liberada', 'true');
