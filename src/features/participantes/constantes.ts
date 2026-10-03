import type { ParticipanteStatus, WeevoStart } from '@/lib/database.types'

export const STATUS_PARTICIPANTE: Record<ParticipanteStatus, { label: string; classe: string }> = {
  ativo: { label: 'Ativo', classe: 'bg-emerald-100 text-emerald-800' },
  aguardando: { label: 'Aguardando', classe: 'bg-violet-100 text-violet-800' },
  sem_resposta: { label: 'Sem resposta', classe: 'bg-amber-100 text-amber-800' },
  inativo: { label: 'Inativo', classe: 'bg-muted text-muted-foreground' },
}

export const WEEVO_START: Record<WeevoStart, { label: string; classe: string }> = {
  nao_avaliado: { label: 'Não avaliado', classe: 'bg-muted text-muted-foreground' },
  candidato: { label: 'Candidato', classe: 'bg-sky-100 text-sky-800' },
  repassado_comercial: { label: 'Repassado ao comercial', classe: 'bg-violet-100 text-violet-800' },
  cadastrado: { label: 'Cadastrado', classe: 'bg-amber-100 text-amber-800' },
  assinante: { label: 'Assinante', classe: 'bg-emerald-100 text-emerald-800' },
  recusou: { label: 'Recusou', classe: 'bg-rose-100 text-rose-800' },
}

export const STATUS_KEYS = Object.keys(STATUS_PARTICIPANTE) as ParticipanteStatus[]
export const WEEVO_START_KEYS = Object.keys(WEEVO_START) as WeevoStart[]

/** Nome usado no placeholder [nome]: apelido, senão primeiro nome. */
export function nomeTratamento(p: { nome: string; apelido: string | null }): string {
  return p.apelido?.trim() || p.nome.trim().split(/\s+/)[0]
}
