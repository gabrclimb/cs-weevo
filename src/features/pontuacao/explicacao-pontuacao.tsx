import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Check, X } from 'lucide-react'
import type { PlantaoRow } from '@/lib/database.types'
import type { Explicacao } from '@/lib/explicacao'
import type { Pontuacao } from '@/lib/pontuacao'
import { PESOS } from '@/lib/config'
import { cn, dataCurta, dataHora } from '@/lib/utils'

/**
 * Como a pontuação de um participante foi decidida: pontos de cada parte
 * e os registros da linha do tempo que os sustentam.
 */
export function ExplicacaoPontuacao({
  pontuacao: p,
  explicacao: x,
  plantoes,
}: {
  pontuacao: Pontuacao
  explicacao: Explicacao
  plantoes: PlantaoRow[]
}) {
  const plantaoPorId = new Map(plantoes.map((pl) => [pl.id, pl]))
  const d = p.detalhe

  return (
    <div className="grid gap-3 text-sm md:grid-cols-2">
      <Parte titulo="Implementou" pontos={p.implementou} max={PESOS.implementou}>
        {x.implementou ? (
          <p>
            Marcado em {dataCurta(x.implementou.em)}
            {x.implementou.nota && <span className="text-muted-foreground">: {x.implementou.nota}</span>}
          </p>
        ) : (
          <Nada>Nenhum registro de implementação.</Nada>
        )}
      </Parte>

      <Parte
        titulo="Plantões"
        pontos={p.plantoes}
        max={PESOS.tetoPlantoes}
        conta={`${d.presencas} presença(s) × ${PESOS.porPresenca}${d.presencas * PESOS.porPresenca > PESOS.tetoPlantoes ? `, limitado a ${PESOS.tetoPlantoes}` : ''}`}
      >
        {x.presencas.length ? (
          <ul className="space-y-0.5">
            {x.presencas.map((pr) => {
              const pl = pr.plantaoId ? plantaoPorId.get(pr.plantaoId) : undefined
              return (
                <li key={pr.id}>
                  {pl ? `Plantão ${pl.numero}` : 'Plantão'}
                  <span className="text-muted-foreground"> · {dataCurta(pl?.data ?? pr.em)}</span>
                </li>
              )
            })}
          </ul>
        ) : (
          <Nada>Nenhuma presença registrada.</Nada>
        )}
      </Parte>

      <Parte
        titulo="Responsividade"
        pontos={p.responsividade}
        max={PESOS.responsividadeMax}
        conta={
          d.envios
            ? `${d.enviosRespondidos} de ${d.envios} respondida(s) em até ${PESOS.janelaRespostaHoras}h → ${d.enviosRespondidos}/${d.envios} × ${PESOS.responsividadeMax}`
            : undefined
        }
        className="md:col-span-2"
      >
        {x.envios.length ? (
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1 pr-3 font-medium">Mensagem enviada</th>
                <th className="py-1 pr-3 font-medium">Resposta seguinte</th>
                <th className="py-1 font-medium">Contou?</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {x.envios.map((e) => (
                <tr key={e.id}>
                  <td className="py-1 pr-3 tabular-nums">{dataHora(e.em)}</td>
                  <td className="py-1 pr-3 tabular-nums">
                    {e.respostaEm ? (
                      <>
                        {dataHora(e.respostaEm)}
                        <span className="text-muted-foreground"> ({formatarHoras(e.horasAteResposta!)} depois)</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">sem resposta</span>
                    )}
                  </td>
                  <td className="py-1">
                    {e.contou ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <Check className="size-3.5" /> sim
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <X className="size-3.5" />
                        {e.respostaEm ? `não (passou de ${PESOS.janelaRespostaHoras}h)` : 'não'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Nada>Nenhuma mensagem enviada registrada (clique em "Enviei" nas tarefas).</Nada>
        )}
      </Parte>

      <Parte titulo="Recência" pontos={p.recencia} max={PESOS.recencia7Dias}>
        {x.ultimaResposta ? (
          <p>
            Última resposta em {dataCurta(x.ultimaResposta)}{' '}
            <span className="text-muted-foreground">
              (há {d.diasDesdeResposta} dia{d.diasDesdeResposta === 1 ? '' : 's'}:{' '}
              {d.diasDesdeResposta! <= 7 ? 'até 7 dias' : d.diasDesdeResposta! <= 14 ? 'de 8 a 14 dias' : 'mais de 14 dias'})
            </span>
          </p>
        ) : (
          <Nada>Nunca respondeu.</Nada>
        )}
      </Parte>

      <Parte
        titulo="Grupo"
        pontos={p.grupo}
        max={PESOS.tetoGrupo}
        conta={`${d.interacoesGrupo} interação(ões) × ${PESOS.porInteracaoGrupo}${d.interacoesGrupo * PESOS.porInteracaoGrupo > PESOS.tetoGrupo ? `, limitado a ${PESOS.tetoGrupo}` : ''}`}
      >
        {x.interacoes.length ? (
          <ul className="space-y-0.5">
            {x.interacoes.map((i) => (
              <li key={i.id}>
                {dataCurta(i.em)}
                {i.nota && <span className="text-muted-foreground"> · {i.nota}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <Nada>Nenhuma interação no grupo registrada.</Nada>
        )}
      </Parte>

      <p className="text-xs text-muted-foreground md:col-span-2">
        Total {p.total} = {p.implementou} + {p.plantoes} + {p.responsividade} + {p.recencia} + {p.grupo}.{' '}
        <Link to="/ajuda" className="text-primary hover:underline">
          Ver todas as regras
        </Link>
      </p>
    </div>
  )
}

function formatarHoras(h: number) {
  return h < 48 ? `${h}h` : `${Math.round(h / 24)} dias`
}

function Parte({
  titulo,
  pontos,
  max,
  conta,
  className,
  children,
}: {
  titulo: string
  pontos: number
  max: number
  conta?: string
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn('space-y-2 rounded-lg border bg-card p-3', className)}>
      <header className="flex items-baseline justify-between gap-2">
        <h4 className="font-semibold">{titulo}</h4>
        <span className="tabular-nums">
          <strong className={cn(pontos === 0 && 'text-muted-foreground')}>{pontos}</strong>
          <span className="text-muted-foreground"> / {max}</span>
        </span>
      </header>
      {conta && <p className="text-xs text-muted-foreground">{conta}</p>}
      {children}
    </section>
  )
}

function Nada({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground">{children}</p>
}
