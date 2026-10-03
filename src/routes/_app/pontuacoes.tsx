import { Fragment, useMemo, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { Input, Select } from '@/components/ui'
import type { PlantaoRow } from '@/lib/database.types'
import { normalize } from '@/lib/csv'
import { explicarPontuacao } from '@/lib/explicacao'
import { PESOS } from '@/lib/config'
import { cn } from '@/lib/utils'
import { useParticipantes, useTurmas } from '@/features/participantes/queries'
import { StatusBadge } from '@/features/participantes/badges'
import { Dica } from '@/components/dica'
import { DICA_COLUNA } from '@/lib/textos-dicas'
import { usePlantoes } from '@/features/turmas/queries'
import { useTodosEventos } from '@/features/eventos/queries'
import { PontuacaoBadge, useEngajamento } from '@/features/engajamento'
import { GradePlantoes, LegendaPlantoes, estadosPlantoes } from '@/features/pontuacao/grade-plantoes'
import { ExplicacaoPontuacao } from '@/features/pontuacao/explicacao-pontuacao'

type Ordem = 'pontuacao' | 'nome'
type Busca = { turma?: string; q?: string; ordem?: Ordem }

export const Route = createFileRoute('/_app/pontuacoes')({
  validateSearch: (s: Record<string, unknown>): Busca => ({
    turma: typeof s.turma === 'string' && s.turma ? s.turma : undefined,
    q: typeof s.q === 'string' && s.q ? s.q : undefined,
    ordem: s.ordem === 'nome' ? 'nome' : undefined,
  }),
  component: PontuacoesPage,
})

function PontuacoesPage() {
  const busca = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const participantes = useParticipantes()
  const turmas = useTurmas()
  const plantoes = usePlantoes()
  const eventos = useTodosEventos()
  const { porParticipante } = useEngajamento()
  const [abertos, setAbertos] = useState<Set<string>>(new Set())

  const setBusca = (m: Busca) => navigate({ search: (s) => ({ ...s, ...m }), replace: true })
  const nomeTurma = useMemo(() => new Map(turmas.data?.map((t) => [t.id, t.nome])), [turmas.data])

  const plantoesPorTurma = useMemo(() => {
    const m = new Map<string, PlantaoRow[]>()
    for (const p of plantoes.data ?? []) m.set(p.turma_id, [...(m.get(p.turma_id) ?? []), p])
    return m
  }, [plantoes.data])

  const eventosPorParticipante = useMemo(() => {
    const m = new Map<string, NonNullable<typeof eventos.data>>()
    for (const e of eventos.data ?? []) m.set(e.participante_id, [...(m.get(e.participante_id) ?? []), e])
    return m
  }, [eventos.data])

  const linhas = useMemo(() => {
    const q = normalize(busca.q)
    return (participantes.data ?? [])
      .filter((p) => !busca.turma || p.turma_id === busca.turma)
      .filter((p) => !q || normalize(`${p.nome} ${p.apelido ?? ''}`).includes(q))
      .map((p) => {
        const evs = eventosPorParticipante.get(p.id) ?? []
        const presentes = new Set(evs.filter((e) => e.tipo === 'plantao_presenca' && e.plantao_id).map((e) => e.plantao_id!))
        return {
          p,
          eng: porParticipante.get(p.id),
          estados: estadosPlantoes(p.turma_id ? (plantoesPorTurma.get(p.turma_id) ?? []) : [], presentes),
        }
      })
      .sort((a, b) =>
        busca.ordem === 'nome'
          ? a.p.nome.localeCompare(b.p.nome)
          : (b.eng?.pontuacao.total ?? 0) - (a.eng?.pontuacao.total ?? 0) || a.p.nome.localeCompare(b.p.nome),
      )
  }, [participantes.data, busca, eventosPorParticipante, porParticipante, plantoesPorTurma])

  // Resumo de presença por plantão da turma filtrada.
  const resumoPlantoes = useMemo(() => {
    if (!busca.turma) return null
    return [1, 2, 3, 4].map((n) => {
      const estados = linhas.map((l) => l.estados[n - 1].estado)
      return {
        numero: n,
        veio: estados.filter((e) => e === 'veio').length,
        faltou: estados.filter((e) => e === 'faltou').length,
        existe: estados.some((e) => e !== 'sem_plantao'),
        realizado: plantoesPorTurma.get(busca.turma!)?.find((p) => p.numero === n)?.realizado ?? false,
      }
    })
  }, [busca.turma, linhas, plantoesPorTurma])

  function alternar(id: string) {
    setAbertos((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const carregando = participantes.isLoading || eventos.isLoading

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Plantões e pontuação</h1>
        <p className="text-sm text-muted-foreground">
          Presença em cada plantão e como a pontuação de cada participante foi calculada até agora. Clique numa linha
          para ver os registros que contaram.{' '}
          <Link to="/ajuda" className="text-primary hover:underline">
            Regras da pontuação
          </Link>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            className="pl-9"
            placeholder="Buscar participante"
            defaultValue={busca.q ?? ''}
            onChange={(e) => setBusca({ q: e.target.value || undefined })}
          />
        </div>
        <Select className="w-52" value={busca.turma ?? ''} onValueChange={(v) => setBusca({ turma: v || undefined })}>
          <option value="">Todas as turmas</option>
          {turmas.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </Select>
        <Select
          className="w-52"
          value={busca.ordem ?? 'pontuacao'}
          onValueChange={(v) => setBusca({ ordem: v === 'nome' ? 'nome' : undefined })}
        >
          <option value="pontuacao">Ordenar por pontuação</option>
          <option value="nome">Ordenar por nome</option>
        </Select>
      </div>

      {resumoPlantoes && (
        <div className="grid gap-2 sm:grid-cols-4">
          {resumoPlantoes.map((r) => (
            <div key={r.numero} className="rounded-lg border bg-card px-3 py-2 text-sm">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">Plantão {r.numero}</span>
                <span className="text-xs text-muted-foreground">
                  {!r.existe ? 'não cadastrado' : r.realizado ? 'realizado' : 'a realizar'}
                </span>
              </div>
              {r.existe && (
                <p className="text-muted-foreground">
                  <strong className="text-foreground tabular-nums">{r.veio}</strong> de {linhas.length} vieram
                  {r.realizado && r.faltou > 0 && ` · ${r.faltou} faltaram`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <LegendaPlantoes />

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="w-8 px-2 py-3" />
              <th className="px-3 py-3 font-medium">
                <Dica texto="Clique na linha para ver os registros que contaram na pontuação." sublinhado>
                  Participante
                </Dica>
              </th>
              <th className="px-3 py-3 font-medium">
                <Dica texto={DICA_COLUNA.gradePlantoes} sublinhado>
                  Plantões
                </Dica>
              </th>
              <Th titulo="Implementou" max={PESOS.implementou} dica={DICA_COLUNA.pontoImplementou} />
              <Th titulo="Plantões" max={PESOS.tetoPlantoes} dica={DICA_COLUNA.pontoPlantoes} />
              <Th titulo="Resposta" max={PESOS.responsividadeMax} dica={DICA_COLUNA.pontoResposta} />
              <Th titulo="Recência" max={PESOS.recencia7Dias} dica={DICA_COLUNA.pontoRecencia} />
              <Th titulo="Grupo" max={PESOS.tetoGrupo} dica={DICA_COLUNA.pontoGrupo} />
              <th className="px-3 py-3 text-right font-medium">
                <Dica texto={DICA_COLUNA.pontuacao} sublinhado>
                  Total
                </Dica>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {linhas.map(({ p, eng, estados }) => {
              const aberto = abertos.has(p.id)
              const pt = eng?.pontuacao
              const d = pt?.detalhe
              return (
                <Fragment key={p.id}>
                  <tr
                    onClick={() => alternar(p.id)}
                    className={cn('cursor-pointer hover:bg-muted/50', aberto && 'bg-muted/30', p.status === 'inativo' && 'opacity-60')}
                  >
                    <td className="px-2 py-2.5 text-muted-foreground">
                      <button
                        type="button"
                        aria-expanded={aberto}
                        aria-label={aberto ? 'Fechar detalhes' : 'Ver detalhes'}
                        onClick={(e) => {
                          e.stopPropagation()
                          alternar(p.id)
                        }}
                        className="rounded p-0.5 hover:bg-muted"
                      >
                        {aberto ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        to="/participantes/$id"
                        params={{ id: p.id }}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {p.nome}
                      </Link>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {!busca.turma && <span>{p.turma_id ? nomeTurma.get(p.turma_id) : 'Sem turma'}</span>}
                        {p.status !== 'ativo' && (
                          <StatusBadge status={p.status} />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <GradePlantoes estados={estados} />
                    </td>
                    <Td pontos={pt?.implementou} detalhe={p.implementou ? 'sim' : 'não'} />
                    <Td pontos={pt?.plantoes} detalhe={d && `${d.presencas} pres.`} />
                    <Td pontos={pt?.responsividade} detalhe={d && (d.envios ? `${d.enviosRespondidos}/${d.envios} a tempo` : 'sem envios')} />
                    <Td
                      pontos={pt?.recencia}
                      detalhe={d && (d.diasDesdeResposta === null ? 'nunca resp.' : `há ${d.diasDesdeResposta}d`)}
                    />
                    <Td pontos={pt?.grupo} detalhe={d && `${d.interacoesGrupo} inter.`} />
                    <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <PontuacaoBadge pontuacao={pt} />
                    </td>
                  </tr>
                  {aberto && pt && (
                    <tr className="bg-muted/20">
                      <td />
                      <td colSpan={8} className="px-3 pt-1 pb-4">
                        <ExplicacaoPontuacao
                          pontuacao={pt}
                          explicacao={explicarPontuacao(eventosPorParticipante.get(p.id) ?? [])}
                          plantoes={plantoes.data ?? []}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {!carregando && linhas.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhum participante com esses filtros.
                </td>
              </tr>
            )}
            {carregando && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({ titulo, max, dica }: { titulo: string; max: number; dica: string }) {
  return (
    <th className="px-3 py-3 text-right font-medium whitespace-nowrap">
      <Dica texto={dica} sublinhado>
        {titulo}
      </Dica>
      <span className="block text-[10px] font-normal normal-case">de {max}</span>
    </th>
  )
}

function Td({ pontos, detalhe }: { pontos?: number; detalhe?: string }) {
  return (
    <td className="px-3 py-2.5 text-right whitespace-nowrap">
      <span className={cn('font-medium tabular-nums', !pontos && 'text-muted-foreground')}>{pontos ?? '—'}</span>
      {detalhe && <span className="block text-[11px] text-muted-foreground">{detalhe}</span>}
    </td>
  )
}
