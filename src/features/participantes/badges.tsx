import { Badge } from '@/components/ui'
import { Dica } from '@/components/dica'
import type { ColunaKanban } from '@/components/kanban'
import { cn } from '@/lib/utils'
import type { ParticipanteStatus, WeevoStart } from '@/lib/tipos'
import { DICA_STATUS_PARTICIPANTE, DICA_WEEVO_START } from '@/lib/textos-dicas'
import { STATUS_PARTICIPANTE, WEEVO_START } from './constantes'

/** Coluna criada pela equipe no lugar do status ou da Weevo Start (o valor original aparece na dica). */
function ColunaBadge({ coluna, original }: { coluna: ColunaKanban; original: string }) {
  return (
    <Dica texto={`Coluna criada pela equipe. Valor no cadastro: ${original}.`}>
      <Badge className="gap-1.5 bg-muted text-foreground">
        <span className={cn('size-1.5 rounded-full', coluna.ponto)} />
        {coluna.titulo}
      </Badge>
    </Dica>
  )
}

/** Com `coluna`, mostra a coluna criada pela equipe em que o participante está no kanban de status. */
export function StatusBadge({ status, coluna }: { status: ParticipanteStatus; coluna?: ColunaKanban }) {
  if (coluna) return <ColunaBadge coluna={coluna} original={STATUS_PARTICIPANTE[status].label} />
  return (
    <Dica texto={DICA_STATUS_PARTICIPANTE[status]}>
      <Badge className={STATUS_PARTICIPANTE[status].classe}>{STATUS_PARTICIPANTE[status].label}</Badge>
    </Dica>
  )
}

/** Com `coluna`, mostra a coluna criada pela equipe em que o participante está no kanban de Weevo Start. */
export function WeevoStartBadge({ valor, coluna }: { valor: WeevoStart; coluna?: ColunaKanban }) {
  if (coluna) return <ColunaBadge coluna={coluna} original={WEEVO_START[valor].label} />
  return (
    <Dica texto={DICA_WEEVO_START[valor]}>
      <Badge className={WEEVO_START[valor].classe}>{WEEVO_START[valor].label}</Badge>
    </Dica>
  )
}
