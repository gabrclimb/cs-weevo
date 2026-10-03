-- Campos de acompanhamento vindos da planilha de controle do suporte.
alter table public.weevo_participantes
  add column responsavel text,          -- quem do time acompanha (texto livre)
  add column dia_escolhido text,        -- horário de plantão escolhido, ex.: "Quinta 14h às 16h"
  add column cadastro_plataforma text,  -- "Sim", "Informou que iria"...
  add column sistema text,              -- o que ele está construindo
  add column dificuldades text,
  add column suporte_extra text,
  add column nps text;                  -- respondeu o NPS?

create index weevo_participantes_responsavel_idx on public.weevo_participantes (responsavel);
