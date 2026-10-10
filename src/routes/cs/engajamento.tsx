import { Fragment, useMemo, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import Papa from 'papaparse'
import { DropdownMenu } from 'radix-ui'
import { Calculator, ChevronDown, ChevronRight, Download, Handshake, MoreHorizontal, Plus, Search, UserRound } from 'lucide-react'
import { Button, Input, Select } from '@/components/ui'
import { Dica } from '@/components/dica'
import { Paginacao, usePaginacao } from '@/components/paginacao'
import type { ParticipanteRow, PlantaoRow } from '@/lib/tipos'
import { normalize } from '@/lib/csv'
import { explicarPontuacao } from '@/lib/explicacao'
import { PESOS } from '@/lib/config'
import { formatarTelefone } from '@/lib/telefone'
import { DICA_COLUNA } from '@/lib/textos-dicas'
import { cn, dataCurta, hojeISO } from '@/lib/utils'
import { useParticipantes, useTurmas } from '@/features/participantes/queries'
import { WEEVO_START } from '@/features/participantes/constantes'
import { StatusBadge, WeevoStartBadge } from '@/features/participantes/badges'
import { usePlantoes } from '@/features/turmas/queries'
import { useTodosEventos } from '@/features/eventos/queries'
import { PontuacaoBadge, useEngajamento } from '@/features/engajamento'
import { GradePlantoes, LegendaPlantoes, estadosPlantoes, type EstadoPlantao } from '@/features/pontuacao/grade-plantoes'
import { ExplicacaoPontuacao } from '@/features/pontuacao/explicacao-pontuacao'
import { podeRepassar, useRepassar } from '@/features/pontuacao/repassar'
import { TarefaForm } from '@/features/tarefas/tarefa-form'
import { ENTRADA_VISAO, VisaoToggle, lerVisao, type Visao } from '@/components/kanban'
import { lerAgrupamento, type Agrupamento } from '@/features/participantes/agrupamentos'
import { AgruparPor, ParticipantesKanban } from '@/features/participantes/participantes-kanban'

/** Cabeçalho da tabela com fundo próprio; o rodapé da paginação repete o mesmo estilo. */
const CABECALHO_ENGAJAMENTO = 'bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase'

type Ordem = 'pontuacao' | 'nome'
export type BuscaEngajamento = {
  turma?: string
  q?: string
  ordem?: Ordem
  visao?: Visao
  agrupar?: Agrupamento
}

export const Route = createFileRoute('/cs/engajamento')({
  validateSearch: (s: Record<string, unknown>): BuscaEngajamento => ({
    turma: typeof s.turma === 'string' && s.turma ? s.turma : undefined,
    q: typeof s.q === 'string' && s.q ? s.q : undefined,
    ordem: s.ordem === 'nome' ? 'nome' : undefined,
    visao: lerVisao(s.visao),
    agrupar: lerAgrupamento(s.agrupar),
  }),
  component: EngajamentoPage,
})

const ROTULO_ESTADO_CSV: Record<EstadoPlantao, string> = {
  veio: 'Veio',
  faltou: 'Faltou',
  pendente: 'A realizar',
  sem_plantao: '—',
}

function EngajamentoPage() {
  const busca = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const participantes = useParticipantes()
  const turmas = useTurmas()
  const plantoes = usePlantoes()
  const eventos = useTodosEventos()
  const { porParticipante } = useEngajamento()
  const repassar = useRepassar()
  const [abertos, setAbertos] = useState<Set<string>>(new Set())
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [tarefaPara, setTarefaPara] = useState<ParticipanteRow | null>(null)

  const setBusca = (m: BuscaEngajamento) => navigate({ search: (s) => ({ ...s, ...m }), replace: true })
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
      .filter((p) => !q || normalize(`${p.nome} ${p.apelido ?? ''} ${p.empresa ?? ''}`).includes(q))
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
          : // Empate: vem antes quem respondeu mais recentemente.
            (b.eng?.pontuacao.total ?? 0) - (a.eng?.pontuacao.total ?? 0) ||
            (b.p.ultima_resposta_em ?? '').localeCompare(a.p.ultima_resposta_em ?? '') ||
            a.p.nome.localeCompare(b.p.nome),
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

  const visao = busca.visao ?? 'tabela'
  // No kanban, o padrão é separar por faixa de engajamento (alto, médio, baixo).
  const agrupamento = busca.agrupar ?? 'faixa'
  const participantesFiltrados = useMemo(() => linhas.map((l) => l.p), [linhas])

  const { itensPagina, inicio, controles } = usePaginacao(linhas, { ...busca, visao: undefined, agrupar: undefined })
  // "Selecionar todos" vale para a página visível, para não marcar quem não está na tela.
  const selecionadosLista = linhas.filter(({ p }) => selecionados.has(p.id)).map(({ p }) => p)
  // A seleção vale para todos; o repasse só atinge quem ainda pode ser repassado.
  const repassaveis = selecionadosLista.filter(podeRepassar)
  const paginaToda = itensPagina.length > 0 && itensPagina.every(({ p }) => selecionados.has(p.id))
  const paginaParcial = !paginaToda && itensPagina.some(({ p }) => selecionados.has(p.id))

  function alternarAberto(id: string) {
    setAbertos((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function alternarSelecionado(id: string, marcado: boolean) {
    setSelecionados((s) => {
      const n = new Set(s)
      if (marcado) n.add(id)
      else n.delete(id)
      return n
    })
  }

  function exportar() {
    const csv = Papa.unparse(
      linhas.map(({ p, eng, estados }, i) => {
        const pt = eng?.pontuacao
        return {
          Posição: i + 1,
          Nome: p.nome,
          Telefone: formatarTelefone(p.telefone),
          Empresa: p.empresa ?? '',
          Turma: p.turma_id ? (nomeTurma.get(p.turma_id) ?? '') : '',
          P1: ROTULO_ESTADO_CSV[estados[0].estado],
          P2: ROTULO_ESTADO_CSV[estados[1].estado],
          P3: ROTULO_ESTADO_CSV[estados[2].estado],
          P4: ROTULO_ESTADO_CSV[estados[3].estado],
          'Pts implementou': pt?.implementou ?? 0,
          'Pts plantões': pt?.plantoes ?? 0,
          'Pts resposta': pt?.responsividade ?? 0,
          'Pts recência': pt?.recencia ?? 0,
          'Pts grupo': pt?.grupo ?? 0,
          Pontuação: pt?.total ?? 0,
          Implementou: p.implementou ? 'Sim' : 'Não',
          Presenças: pt?.detalhe.presencas ?? 0,
          'Última resposta': dataCurta(p.ultima_resposta_em),
          'Weevo Start': WEEVO_START[p.weevo_start].label,
        }
      }),
      { delimiter: ';' },
    )
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `engajamento-weevo-${hojeISO()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const carregando = participantes.isLoading || eventos.isLoading
  const colunas = 13

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Engajamento</h1>
        <p className="text-sm text-muted-foreground">
          Quem está mais engajado, presença nos plantões e como cada pontuação foi calculada. Clique numa linha para ver
          os registros que contaram.{' '}
          <Link to="/cs/ajuda" className="text-primary hover:underline">
            Como funciona a pontuação
          </Link>
        </p>
      </div>

      {/* Tudo numa linha: visão, busca, filtros e ações. A busca é o campo que encolhe; se faltar espaço, a linha quebra. */}
      <div className="flex flex-wrap items-center gap-2">
        <VisaoToggle valor={visao} onChange={(v) => setBusca({ visao: v === 'tabela' ? undefined : v })} />
        {visao === 'kanban' && (
          <AgruparPor valor={agrupamento} onChange={(a) => setBusca({ agrupar: a === 'faixa' ? undefined : a })} />
        )}
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            className="pl-9"
            placeholder="Buscar participante"
            defaultValue={busca.q ?? ''}
            onChange={(e) => setBusca({ q: e.target.value || undefined })}
          />
        </div>
        <Select className="w-44" value={busca.turma ?? ''} onValueChange={(v) => setBusca({ turma: v || undefined })}>
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
        <Button variante="secundario" onClick={exportar} disabled={!linhas.length}>
          <Download className="size-4" />
          Exportar CSV
        </Button>
        <Dica
          texto={
            selecionadosLista.length > repassaveis.length
              ? `${selecionadosLista.length - repassaveis.length} dos selecionados não entram no repasse: só vale para quem está “Não avaliado” ou “Candidato”.`
              : undefined
          }
          lado="bottom"
        >
          <Button
            disabled={!repassaveis.length || repassar.isPending}
            onClick={() => repassar.mutate(repassaveis, { onSuccess: () => setSelecionados(new Set()) })}
          >
            <Handshake className="size-4" />
            Repassar {repassaveis.length || ''} ao comercial
          </Button>
        </Dica>
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

      {visao === 'kanban' ? (
        <ParticipantesKanban
          participantes={participantesFiltrados}
          turmas={turmas.data ?? []}
          agrupamento={agrupamento}
          porParticipante={porParticipante}
          mostrarTurma={!busca.turma}
          carregando={carregando}
        />
      ) : (
        <>
          <LegendaPlantoes />

          <div className={cn('overflow-hidden rounded-lg border bg-card', ENTRADA_VISAO)}>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={cn('border-b', CABECALHO_ENGAJAMENTO)}>
                <tr>
                  <th className="w-8 px-2 py-3" />
                  <th className="w-8 px-2 py-3">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todos desta página"
                      checked={paginaToda}
                      ref={(el) => {
                        if (el) el.indeterminate = paginaParcial
                      }}
                      onChange={(e) =>
                        setSelecionados((s) => {
                          const n = new Set(s)
                          for (const { p } of itensPagina) {
                            if (e.target.checked) n.add(p.id)
                            else n.delete(p.id)
                          }
                          return n
                        })
                      }
                    />
                  </th>
                  <th className="px-2 py-3 font-medium">
                    <Dica texto={DICA_COLUNA.posicao} sublinhado>
                      #
                    </Dica>
                  </th>
                  <th className="px-3 py-3 font-medium">
                    <Dica texto="Clique na linha para ver os registros que contaram na pontuação." sublinhado>
                      Participante
                    </Dica>
                  </th>
                  <th className="px-3 py-3 text-center font-medium">
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
                  <th className="px-3 py-3 font-medium">
                    <Dica texto={DICA_COLUNA.weevoStart} sublinhado>
                      Weevo Start
                    </Dica>
                  </th>
                  <th className="px-3 py-3 text-center font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {itensPagina.map(({ p, eng, estados }, i) => {
                  const aberto = abertos.has(p.id)
                  const elegivel = podeRepassar(p)
                  const pt = eng?.pontuacao
                  const d = pt?.detalhe
                  const parar = (e: { stopPropagation: () => void }) => e.stopPropagation()
                  return (
                    <Fragment key={p.id}>
                      <tr
                        onClick={() => alternarAberto(p.id)}
                        className={cn('cursor-pointer hover:bg-muted/50', aberto && 'bg-muted/30', p.status === 'inativo' && 'opacity-60')}
                      >
                        <td className="px-2 py-2.5 text-muted-foreground">
                          <button
                            type="button"
                            aria-expanded={aberto}
                            aria-label={aberto ? 'Fechar detalhes' : 'Ver detalhes'}
                            onClick={(e) => {
                              e.stopPropagation()
                              alternarAberto(p.id)
                            }}
                            className="rounded p-0.5 hover:bg-muted"
                          >
                            {aberto ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                          </button>
                        </td>
                        <td className="px-2 py-2.5" onClick={parar}>
                          <input
                            type="checkbox"
                            aria-label={`Selecionar ${p.nome}`}
                            checked={selecionados.has(p.id)}
                            onChange={(e) => alternarSelecionado(p.id, e.target.checked)}
                          />
                        </td>
                        <td className="px-2 py-2.5 text-muted-foreground tabular-nums">{inicio + i + 1}</td>
                        <td className="px-3 py-2.5">
                          <Link
                            to="/cs/participantes/$id"
                            params={{ id: p.id }}
                            onClick={parar}
                            className="font-medium hover:text-primary hover:underline"
                          >
                            {p.nome}
                          </Link>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {!busca.turma && <span>{p.turma_id ? nomeTurma.get(p.turma_id) : 'Sem turma'}</span>}
                            {p.status !== 'ativo' && <StatusBadge status={p.status} />}
                          </div>
                        </td>
                        <td className="px-3 py-2.5" onClick={parar}>
                          <div className="flex justify-center">
                            <GradePlantoes estados={estados} />
                          </div>
                        </td>
                        <Td pontos={pt?.implementou} detalhe={p.implementou ? 'sim' : 'não'} />
                        <Td pontos={pt?.plantoes} detalhe={d && `${d.presencas} pres.`} />
                        <Td
                          pontos={pt?.responsividade}
                          detalhe={d && (d.envios ? `${d.enviosRespondidos}/${d.envios} a tempo` : 'sem envios')}
                        />
                        <Td
                          pontos={pt?.recencia}
                          detalhe={d && (d.diasDesdeResposta === null ? 'nunca resp.' : `há ${d.diasDesdeResposta}d`)}
                        />
                        <Td pontos={pt?.grupo} detalhe={d && `${d.interacoesGrupo} inter.`} />
                        <td className="px-3 py-2.5 text-right" onClick={parar}>
                          <PontuacaoBadge pontuacao={pt} />
                        </td>
                        <td className="px-3 py-2.5" onClick={parar}>
                          <WeevoStartBadge valor={p.weevo_start} />
                        </td>
                        <td className="px-3 py-2.5" onClick={parar}>
                          <div className="flex items-center justify-center">
                            <MenuAcoes
                              nome={p.nome}
                              aberto={aberto}
                              podeRepassar={elegivel && !repassar.isPending}
                              onRepassar={() => repassar.mutate([p])}
                              onAbrirFicha={() => navigate({ to: '/cs/participantes/$id', params: { id: p.id } })}
                              onNovaTarefa={() => setTarefaPara(p)}
                              onVerCalculo={() => alternarAberto(p.id)}
                            />
                          </div>
                        </td>
                      </tr>
                      {aberto && pt && (
                        <tr className="bg-muted/20">
                          <td colSpan={3} />
                          <td colSpan={colunas - 3} className="px-3 pt-1 pb-4">
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
                    <td colSpan={colunas} className="px-4 py-10 text-center text-muted-foreground">
                      Ninguém com esses filtros.
                    </td>
                  </tr>
                )}
                {carregando && (
                  <tr>
                    <td colSpan={colunas} className="px-4 py-10 text-center text-muted-foreground">
                      Carregando…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
            <Paginacao {...controles} className={cn('border-t px-4 py-3', CABECALHO_ENGAJAMENTO)} />
          </div>
        </>
      )}

      <TarefaForm
        aberto={!!tarefaPara}
        onAbertoChange={(a) => !a && setTarefaPara(null)}
        inicial={tarefaPara ? { participante_id: tarefaPara.id, tipo: 'mensagem_privada', canal: 'WhatsApp privado' } : undefined}
      />
    </div>
  )
}

/** Menu "⋯" com as demais ações do participante. */
function MenuAcoes({
  nome,
  aberto,
  podeRepassar,
  onRepassar,
  onAbrirFicha,
  onNovaTarefa,
  onVerCalculo,
}: {
  nome: string
  aberto: boolean
  podeRepassar: boolean
  onRepassar: () => void
  onAbrirFicha: () => void
  onNovaTarefa: () => void
  onVerCalculo: () => void
}) {
  const item =
    'flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-muted data-[highlighted]:text-foreground'
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Mais ações para ${nome}`}
          className="inline-flex size-8 items-center justify-center rounded-md border bg-background text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-[60] min-w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <DropdownMenu.Item className={cn(item, 'items-start')} disabled={!podeRepassar} onSelect={onRepassar}>
            <Handshake className="mt-0.5 size-4" />
            <span>
              Repassar ao comercial
              <span className="block max-w-56 text-xs text-muted-foreground">
                {podeRepassar
                  ? 'Muda a Weevo Start e registra o repasse. Não altera a pontuação.'
                  : 'Só para quem está “Não avaliado” ou “Candidato”.'}
              </span>
            </span>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="-mx-1 my-1 h-px bg-border" />
          <DropdownMenu.Item className={item} onSelect={onAbrirFicha}>
            <UserRound className="size-4" />
            Abrir ficha
          </DropdownMenu.Item>
          <DropdownMenu.Item className={item} onSelect={onNovaTarefa}>
            <Plus className="size-4" />
            Nova tarefa
          </DropdownMenu.Item>
          <DropdownMenu.Item className={item} onSelect={onVerCalculo}>
            <Calculator className="size-4" />
            {aberto ? 'Ocultar cálculo da pontuação' : 'Ver cálculo da pontuação'}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function Th({ titulo, max, dica }: { titulo: string; max: number; dica: string }) {
  return (
    <th className="px-3 py-3 text-center font-medium whitespace-nowrap">
      <Dica texto={dica} sublinhado>
        {titulo}
      </Dica>
      <span className="block text-[10px] font-normal normal-case">de {max}</span>
    </th>
  )
}

function Td({ pontos, detalhe }: { pontos?: number; detalhe?: string }) {
  return (
    <td className="px-3 py-2.5 text-center whitespace-nowrap">
      <span className={cn('font-medium tabular-nums', !pontos && 'text-muted-foreground')}>{pontos ?? '—'}</span>
      {detalhe && <span className="block text-[11px] text-muted-foreground">{detalhe}</span>}
    </td>
  )
}
