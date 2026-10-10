import { Badge } from '@/components/ui'
import { Dica } from '@/components/dica'
import type { ParticipanteStatus, WeevoStart } from '@/lib/tipos'
import { DICA_STATUS_PARTICIPANTE, DICA_WEEVO_START } from '@/lib/textos-dicas'
import { STATUS_PARTICIPANTE, WEEVO_START } from './constantes'

export function StatusBadge({ status }: { status: ParticipanteStatus }) {
  return (
    <Dica texto={DICA_STATUS_PARTICIPANTE[status]}>
      <Badge className={STATUS_PARTICIPANTE[status].classe}>{STATUS_PARTICIPANTE[status].label}</Badge>
    </Dica>
  )
}

export function WeevoStartBadge({ valor }: { valor: WeevoStart }) {
  return (
    <Dica texto={DICA_WEEVO_START[valor]}>
      <Badge className={WEEVO_START[valor].classe}>{WEEVO_START[valor].label}</Badge>
    </Dica>
  )
}
