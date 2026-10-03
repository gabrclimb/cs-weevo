import { useMemo } from 'react'
import { Tooltip } from 'radix-ui'
import { AlertTriangle } from 'lucide-react'
import { alertasParticipante, type AlertaParticipante } from '@/lib/alertas'
import { calcularPontuacao, type Pontuacao } from '@/lib/pontuacao'
import { FAIXAS_PONTUACAO, PESOS } from '@/lib/config'
import { cn } from '@/lib/utils'
import { DICA_ALERTA } from '@/lib/textos-dicas'
import { Dica } from '@/components/dica'
import { useParticipantes } from '@/features/participantes/queries'
import { useTodosEventos } from '@/features/eventos/queries'

export type Engajamento = { pontuacao: Pontuacao; alertas: AlertaParticipante[] }

/** Pontuação e alertas de todos os participantes, recalculados quando eventos mudam. */
export function useEngajamento() {
  const participantes = useParticipantes()
  const eventos = useTodosEventos()

  const porParticipante = useMemo(() => {
    const mapa = new Map<string, Engajamento>()
    if (!participantes.data || !eventos.data) return mapa
    const eventosPorParticipante = new Map<string, { tipo: string; ocorrido_em: string }[]>()
    for (const e of eventos.data) {
      const lista = eventosPorParticipante.get(e.participante_id) ?? []
      lista.push(e)
      eventosPorParticipante.set(e.participante_id, lista)
    }
    const agora = new Date()
    for (const p of participantes.data) {
      const evs = eventosPorParticipante.get(p.id) ?? []
      mapa.set(p.id, { pontuacao: calcularPontuacao(p, evs, agora), alertas: alertasParticipante(p, evs, agora) })
    }
    return mapa
  }, [participantes.data, eventos.data])

  return { porParticipante, carregando: participantes.isLoading || eventos.isLoading }
}

export const ROTULO_ALERTA: Record<AlertaParticipante['tipo'], string> = {
  sem_contato: 'Sem contato',
  sem_resposta: 'Sem resposta',
}

export function AlertasBadges({ alertas }: { alertas: AlertaParticipante[] }) {
  if (!alertas.length) return null
  return (
    <div className="flex flex-wrap gap-1">
      {alertas.map((a) => (
        <Dica key={a.tipo} texto={`${DICA_ALERTA[a.tipo]} Agora: ${a.dias} dias.`}>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            <AlertTriangle className="size-3" />
            {ROTULO_ALERTA[a.tipo]} · {a.dias}d
          </span>
        </Dica>
      ))}
    </div>
  )
}

function corPontuacao(total: number) {
  if (total >= FAIXAS_PONTUACAO.alta) return 'bg-emerald-100 text-emerald-800'
  if (total >= FAIXAS_PONTUACAO.media) return 'bg-amber-100 text-amber-800'
  return 'bg-muted text-muted-foreground'
}

/** Pontuação com decomposição ao passar o mouse. */
export function PontuacaoBadge({ pontuacao, className }: { pontuacao?: Pontuacao; className?: string }) {
  if (!pontuacao) return <span className="text-muted-foreground/70">—</span>
  const d = pontuacao.detalhe
  const linhas: [string, number, number, string][] = [
    ['Implementou', pontuacao.implementou, PESOS.implementou, pontuacao.implementou ? 'sim' : 'não'],
    ['Plantões', pontuacao.plantoes, PESOS.tetoPlantoes, `${d.presencas} presença(s)`],
    ['Responsividade', pontuacao.responsividade, PESOS.responsividadeMax, `${d.enviosRespondidos} de ${d.envios} em até ${PESOS.janelaRespostaHoras}h`],
    ['Recência', pontuacao.recencia, PESOS.recencia7Dias, d.diasDesdeResposta === null ? 'nunca respondeu' : `última resposta há ${d.diasDesdeResposta}d`],
    ['Grupo', pontuacao.grupo, PESOS.tetoGrupo, `${d.interacoesGrupo} interação(ões)`],
  ]
  return (
    <Tooltip.Root delayDuration={150}>
      <Tooltip.Trigger asChild>
        <span
          tabIndex={0}
          className={cn(
            'inline-flex min-w-10 cursor-help justify-center rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums',
            corPontuacao(pontuacao.total),
            className,
          )}
        >
          {pontuacao.total}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="left" sideOffset={6} className="z-[70] w-72 rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-lg">
          <p className="mb-2 font-semibold text-foreground">Pontuação {pontuacao.total} de 100</p>
          <table className="w-full">
            <tbody>
              {linhas.map(([nome, pts, max, explicacao]) => (
                <tr key={nome}>
                  <td className="py-0.5 pr-2 text-foreground">{nome}</td>
                  <td className="py-0.5 pr-2 text-right font-medium tabular-nums">
                    {pts}/{max}
                  </td>
                  <td className="py-0.5 text-muted-foreground">{explicacao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
