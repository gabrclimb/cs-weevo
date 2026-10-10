import { Tooltip } from 'radix-ui'
import { Check, Minus, X } from 'lucide-react'
import type { PlantaoRow } from '@/lib/tipos'
import { cn, dataCurta } from '@/lib/utils'

export type EstadoPlantao = 'veio' | 'faltou' | 'pendente' | 'sem_plantao'

/**
 * Situação do participante em cada plantão (1 a 4) da turma:
 * veio (tem presença), faltou (plantão realizado sem presença), pendente (agendado, não realizado)
 * ou sem_plantao (ainda não cadastrado na turma).
 */
export function estadosPlantoes(
  plantoesDaTurma: PlantaoRow[],
  plantoesComPresenca: Set<string>,
): { numero: number; estado: EstadoPlantao; plantao?: PlantaoRow }[] {
  return [1, 2, 3, 4].map((numero) => {
    const plantao = plantoesDaTurma.find((p) => p.numero === numero)
    if (!plantao) return { numero, estado: 'sem_plantao' }
    if (plantoesComPresenca.has(plantao.id)) return { numero, estado: 'veio', plantao }
    return { numero, estado: plantao.realizado ? 'faltou' : 'pendente', plantao }
  })
}

const ESTILO: Record<EstadoPlantao, { classe: string; icone: typeof Check | null; texto: string }> = {
  veio: { classe: 'bg-emerald-100 text-emerald-800', icone: Check, texto: 'Veio' },
  faltou: { classe: 'bg-rose-100 text-rose-800', icone: X, texto: 'Faltou' },
  pendente: { classe: 'bg-muted text-muted-foreground', icone: Minus, texto: 'Ainda não aconteceu' },
  sem_plantao: { classe: 'border border-dashed text-muted-foreground/60', icone: null, texto: 'Plantão não cadastrado' },
}

/** Quatro quadradinhos P1 a P4 com a situação de cada plantão. */
export function GradePlantoes({ estados }: { estados: ReturnType<typeof estadosPlantoes> }) {
  return (
    <div className="flex gap-1">
      {estados.map(({ numero, estado, plantao }) => {
        const { classe, icone: Icone, texto } = ESTILO[estado]
        return (
          <Tooltip.Root key={numero} delayDuration={150}>
            <Tooltip.Trigger asChild>
              <span
                tabIndex={0}
                aria-label={`Plantão ${numero}: ${texto}`}
                className={cn('flex size-7 cursor-help flex-col items-center justify-center rounded-md text-[10px] leading-none font-semibold', classe)}
              >
                {Icone ? <Icone className="size-3.5" /> : <span>P{numero}</span>}
              </span>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content sideOffset={4} className="z-[70] rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md">
                Plantão {numero}: {texto}
                {plantao?.data && ` · ${dataCurta(plantao.data)}`}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        )
      })}
    </div>
  )
}

export function LegendaPlantoes() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {(Object.keys(ESTILO) as EstadoPlantao[]).map((e) => {
        const { classe, icone: Icone, texto } = ESTILO[e]
        return (
          <span key={e} className="inline-flex items-center gap-1.5">
            <span className={cn('flex size-4 items-center justify-center rounded', classe)}>
              {Icone && <Icone className="size-3" />}
            </span>
            {texto}
          </span>
        )
      })}
    </div>
  )
}
