-- Nova etapa da Weevo Start: fez o cadastro, mas ainda não assinou.
alter table public.weevo_participantes
  drop constraint weevo_participantes_weevo_start_check;

alter table public.weevo_participantes
  add constraint weevo_participantes_weevo_start_check
  check (weevo_start in ('nao_avaliado', 'candidato', 'repassado_comercial', 'cadastrado', 'assinante', 'recusou'));
