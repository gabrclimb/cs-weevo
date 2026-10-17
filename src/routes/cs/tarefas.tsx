import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FileUp, ListChecks, Plus, Search, Trash2, X } from 'lucide-react'
import { Button, Dialog, Input, MenuAcoes, Select } from '@/components/ui'
import type { TarefaRow } from '@/lib/tipos'
import { normalize } from '@/lib/csv'
import { cn, dataCurta, hojeISO } from '@/lib/utils'
import { tarefaAtrasada } from '@/lib/alertas'
import { useParticipantes, useTurmas } from '@/features/participantes/queries'
import { STATUS_TAREFA, STATUS_TAREFA_KEYS, TIPO_TAREFA, TIPO_TAREFA_KEYS, type StatusTarefa, type TipoTarefa } from '@/features/tarefas/constantes'
import { ImportTarefasDialog } from '@/features/tarefas/import-dialog'
import { useAcaoTarefa, useExcluirTarefas, useTarefas } from '@/features/tarefas/queries'
import { TarefaCard } from '@/features/tarefas/tarefa-card'
import { TarefaForm } from '@/features/tarefas/tarefa-form'
import { useTarefaAcoes } from '@/features/tarefas/use-tarefa-acoes'
import { ENTRADA_VISAO, Kanban, VisaoToggle, lerVisao, type ColunaKanban, type Visao } from '@/components/kanban'
import { CABECALHO_TABELA, Paginacao, RODAPE_TABELA, usePaginacao } from '@/components/paginacao'
import { CaixaSelecao } from '@/components/caixa-selecao'
import { DICA_STATUS_TAREFA } from '@/lib/textos-dicas'
import { aplicarPersonalizadas } from '@/features/kanban/colunas'
import { useQuadroKanban } from '@/features/kanban/queries'

const PERIODOS = {
  todas: 'Qualquer data',
  atrasadas: 'Atrasadas',
  hoje: 'Hoje',
  semana: 'Próximos 7 dias',
  sem_data: 'Sem data',
} as const
type Periodo = keyof typeof PERIODOS

type Filtros = {
  tarefa?: string
  q?: string
  turma?: string
  tipo?: TipoTarefa
  periodo?: Periodo
  /** Coluna do kanban (status fixo ou coluna criada). */
  coluna?: string
  visao?: Visao
}

export const Route = createFileRoute('/cs/tarefas')({
  validateSearch: (s: Record<string, unknown>): Filtros => ({
    tarefa: typeof s.tarefa === 'string' ? s.tarefa : undefined,
    q: typeof s.q === 'string' && s.q ? s.q : undefined,
    turma: typeof s.turma === 'string' && s.turma ? s.turma : undefined,
    tipo: TIPO_TAREFA_KEYS.includes(s.tipo as TipoTarefa) ? (s.tipo as TipoTarefa) : undefined,
    periodo: typeof s.periodo === 'string' && s.periodo in PERIODOS ? (s.periodo as Periodo) : undefined,
    coluna: typeof s.coluna === 'string' && s.coluna ? s.coluna : undefined,
    visao: lerVisao(s.visao),
  }),
  component: TarefasPage,
})

const COLUNAS: ColunaKanban[] = STATUS_TAREFA_KEYS.map((k) => ({
  chave: k,
  titulo: STATUS_TAREFA[k].label,
  ponto: STATUS_TAREFA[k].ponto,
  dica: DICA_STATUS_TAREFA[k],
}))

function TarefasPage() {
  const filtros = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const tarefas = useTarefas()
  const participantes = useParticipantes()
  const turmas = useTurmas()
  const acao = useAcaoTarefa()
  const { handlers, dialogos, setEditando } = useTarefaAcoes()
  const [novaAberta, setNovaAberta] = useState(false)
  const [importAberto, setImportAberto] = useState(false)
  const excluirVarias = useExcluirTarefas()
  const quadro = useQuadroKanban('tarefas')
  // Colunas fixas (status) mais as criadas pela equipe; a lista mostra a mesma coluna do kanban.
  const montado = useMemo(
    () => aplicarPersonalizadas('tarefas', COLUNAS, quadro.personalizadas, { id: (t: TarefaRow) => t.id, valor: (t) => t.status }),
    [quadro.personalizadas],
  )
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [excluindoSelecionadas, setExcluindoSelecionadas] = useState(false)
  // O kanban continua sendo a visão padrão desta página; a lista entra com ?visao=tabela.
  const visao = filtros.visao ?? 'kanban'

  const hoje = hojeISO()
  const participantePorId = useMemo(() => new Map(participantes.data?.map((p) => [p.id, p])), [participantes.data])
  const turmaPorId = useMemo(() => new Map(turmas.data?.map((t) => [t.id, t])), [turmas.data])

  // Deep link ?tarefa=<id>
  useEffect(() => {
    if (!filtros.tarefa || !tarefas.data) return
    const t = tarefas.data.find((x) => x.id === filtros.tarefa)
    if (t) setEditando(t)
    navigate({ search: (s) => ({ ...s, tarefa: undefined }), replace: true })
  }, [filtros.tarefa, tarefas.data, navigate, setEditando])

  const filhasPorMae = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of tarefas.data ?? []) if (t.parent_id) m.set(t.parent_id, (m.get(t.parent_id) ?? 0) + 1)
    return m
  }, [tarefas.data])

  // Tarefas que passam nos filtros, na ordem de `ordem`. O kanban distribui cada uma na coluna do seu status.
  const filtradas = useMemo(() => {
    const busca = normalize(filtros.q)
    const semana = hojeISO(7)
    const lista: TarefaRow[] = []
    for (const t of tarefas.data ?? []) {
      const p = t.participante_id ? participantePorId.get(t.participante_id) : undefined
      const turmaDaTarefa = t.turma_id ?? p?.turma_id
      if (filtros.turma && turmaDaTarefa !== filtros.turma) continue
      if (filtros.tipo && t.tipo !== filtros.tipo) continue
      if (filtros.periodo === 'atrasadas' && !tarefaAtrasada(t, hoje)) continue
      if (filtros.periodo === 'hoje' && t.data_prevista !== hoje) continue
      if (filtros.periodo === 'semana' && !(t.data_prevista && t.data_prevista >= hoje && t.data_prevista <= semana)) continue
      if (filtros.periodo === 'sem_data' && t.data_prevista) continue
      if (filtros.coluna && montado.colunaDe(t) !== filtros.coluna) continue
      if (busca && !normalize(`${t.titulo} ${p?.nome ?? ''} ${p?.apelido ?? ''} ${t.para_quem ?? ''}`).includes(busca)) continue
      lista.push(t)
    }
    return lista
  }, [tarefas.data, participantePorId, filtros, hoje, montado])

  // Na lista: por data prevista (sem data no fim), depois pela ordem do kanban.
  const ordenadas = useMemo(
    () => [...filtradas].sort((a, b) => (a.data_prevista ?? '9999').localeCompare(b.data_prevista ?? '9999') || a.ordem - b.ordem),
    [filtradas],
  )
  const { itensPagina, controles } = usePaginacao(ordenadas, { ...filtros, tarefa: undefined, visao: undefined })

  // Só conta o que está selecionado e continua visível com os filtros atuais.
  const selecionadasLista = filtradas.filter((t) => selecionados.has(t.id))
  const paginaToda = itensPagina.length > 0 && itensPagina.every((t) => selecionados.has(t.id))
  const paginaParcial = !paginaToda && itensPagina.some((t) => selecionados.has(t.id))

  function marcar(ids: string[], marcado: boolean) {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      for (const id of ids) {
        if (marcado) novo.add(id)
        else novo.delete(id)
      }
      return novo
    })
  }

  function excluirSelecionadas() {
    excluirVarias.mutate(
      selecionadasLista.map((t) => t.id),
      {
        onSuccess: () => {
          setSelecionados(new Set())
          setExcluindoSelecionadas(false)
        },
      },
    )
  }

  // Solta no fim da coluna de destino.
  function mover(t: TarefaRow, status: string) {
    const destino = status as StatusTarefa
    const ordem = Math.max(0, ...(tarefas.data ?? []).filter((x) => x.status === destino).map((x) => x.ordem)) + 1
    acao.mutate({ tarefa: t, acao: { tipo: 'status', status: destino, ordem } })
  }

  const setFiltro = (m: Partial<Filtros>) => navigate({ search: (s) => ({ ...s, ...m }), replace: true })
  const temFiltro = !!(filtros.q || filtros.turma || filtros.tipo || filtros.periodo || filtros.coluna)
  const vinculo = (t: TarefaRow) => {
    const p = t.participante_id ? participantePorId.get(t.participante_id) : undefined
    const turmaId = t.turma_id ?? p?.turma_id
    return [p?.nome ?? t.para_quem, turmaId && turmaPorId.get(turmaId)?.nome].filter(Boolean).join(' · ')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tarefas</h1>
          <p className="text-sm text-muted-foreground">
            Registre aqui o que foi feito no CRM: copie a mensagem, envie lá e clique em "Enviei".
          </p>
        </div>
        <div className="flex gap-2">
          <Button variante="secundario" onClick={() => setImportAberto(true)}>
            <FileUp className="size-4" />
            Importar CSV
          </Button>
          <Button onClick={() => setNovaAberta(true)}>
            <Plus className="size-4" />
            Nova tarefa
          </Button>
        </div>
      </div>

      <div
        className={cn(
          'grid gap-2 sm:grid-cols-2',
          visao === 'tabela' ? 'lg:grid-cols-[auto_1fr_170px_170px_170px_170px_auto]' : 'lg:grid-cols-[auto_1fr_180px_180px_170px_auto]',
        )}
      >
        {/* O filtro de status só existe na lista: no kanban, cada status já é uma coluna. */}
        <VisaoToggle valor={visao} onChange={(v) => setFiltro(v === 'kanban' ? { visao: undefined, coluna: undefined } : { visao: v })} />
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            className="pl-9"
            placeholder="Buscar tarefa ou participante"
            defaultValue={filtros.q ?? ''}
            onChange={(e) => setFiltro({ q: e.target.value || undefined })}
          />
        </div>
        <Select value={filtros.turma ?? ''} onValueChange={(v) => setFiltro({ turma: v || undefined })}>
          <option value="">Todas as turmas</option>
          {turmas.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </Select>
        <Select value={filtros.tipo ?? ''} onValueChange={(v) => setFiltro({ tipo: (v || undefined) as TipoTarefa | undefined })}>
          <option value="">Todos os tipos</option>
          {TIPO_TAREFA_KEYS.map((k) => (
            <option key={k} value={k}>
              {TIPO_TAREFA[k].label}
            </option>
          ))}
        </Select>
        <Select value={filtros.periodo ?? ''} onValueChange={(v) => setFiltro({ periodo: (v || undefined) as Periodo | undefined })}>
          {Object.entries(PERIODOS).map(([k, label]) => (
            <option key={k} value={k === 'todas' ? '' : k}>
              {label}
            </option>
          ))}
        </Select>
        {visao === 'tabela' && (
          <Select value={filtros.coluna ?? ''} aria-label="Status" onValueChange={(v) => setFiltro({ coluna: v || undefined })}>
            <option value="">Todos os status</option>
            {montado.colunas.map((c) => (
              <option key={c.chave} value={c.chave}>
                {c.titulo}
              </option>
            ))}
          </Select>
        )}
        {temFiltro && (
          <Button variante="fantasma" onClick={() => navigate({ search: { visao: filtros.visao }, replace: true })}>
            Limpar
          </Button>
        )}
      </div>

      {tarefas.error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          Não foi possível carregar as tarefas. Tente novamente.
        </div>
      )}

      {visao === 'kanban' ? (
        <Kanban
          colunas={montado.colunas}
          itens={filtradas}
          colunaDe={montado.colunaDe}
          chaveDe={(t) => t.id}
          onMover={(t, destino) => quadro.soltar(t.id, destino, t.status, () => mover(t, destino))}
          edicaoColunas={quadro.edicao}
          carregando={tarefas.isLoading}
          vazio="Nenhuma tarefa"
          ajudaMover="Arraste um card para outra coluna para mudar o status. Clique no título para editar a tarefa."
          renderCard={(t) => (
            <TarefaCard
              tarefa={t}
              participante={t.participante_id ? participantePorId.get(t.participante_id) : undefined}
              turma={t.turma_id ? turmaPorId.get(t.turma_id) : undefined}
              filhas={filhasPorMae.get(t.id) ?? 0}
              hoje={hoje}
              handlers={handlers}
            />
          )}
        />
      ) : (
        <>
          {selecionadasLista.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
              <span className="font-medium">{selecionadasLista.length} selecionada(s)</span>
              {selecionadasLista.length < filtradas.length && (
                <button type="button" className="text-primary hover:underline" onClick={() => marcar(filtradas.map((t) => t.id), true)}>
                  Selecionar todas as {filtradas.length}
                  {temFiltro ? ' filtradas' : ''}
                </button>
              )}
              <div className="ml-auto">
                <MenuAcoes
                  rotulo={`Ações (${selecionadasLista.length})`}
                  icone={ListChecks}
                  acoes={[
                    {
                      label: 'Excluir…',
                      icone: Trash2,
                      descricao: `${selecionadasLista.length} tarefa(s)`,
                      onSelect: () => setExcluindoSelecionadas(true),
                    },
                    'separador',
                    { label: 'Limpar seleção', icone: X, onSelect: () => setSelecionados(new Set()) },
                  ]}
                />
              </div>
            </div>
          )}
          <div className={cn('overflow-hidden rounded-lg border bg-card', ENTRADA_VISAO)}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className={cn('border-b', CABECALHO_TABELA)}>
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <CaixaSelecao
                        aria-label="Selecionar todas desta página"
                        checked={paginaToda}
                        indeterminate={paginaParcial}
                        onChange={(marcado) => marcar(itensPagina.map((t) => t.id), marcado)}
                      />
                    </th>
                    <th className="px-4 py-3">Tarefa</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Para quem</th>
                    <th className="px-4 py-3">Data prevista</th>
                    <th className="w-10 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {itensPagina.map((t) => {
                    const Icone = TIPO_TAREFA[t.tipo].icone
                    const atrasada = tarefaAtrasada(t, hoje)
                    const coluna = montado.personalizadaDe(t)
                    return (
                      <tr key={t.id} className={selecionados.has(t.id) ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50'}>
                        <td className="px-4 py-3">
                          <CaixaSelecao
                            aria-label={`Selecionar ${t.titulo}`}
                            checked={selecionados.has(t.id)}
                            onChange={(marcado) => marcar([t.id], marcado)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handlers.onAbrir(t)}
                            className="text-left font-medium text-foreground hover:text-primary hover:underline"
                          >
                            {t.titulo}
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <Icone className="size-4" />
                            {TIPO_TAREFA[t.tipo].label}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`size-2 rounded-full ${coluna?.ponto ?? STATUS_TAREFA[t.status].ponto}`} />
                            {coluna?.titulo ?? STATUS_TAREFA[t.status].label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{vinculo(t) || <span className="text-muted-foreground/70">—</span>}</td>
                        <td className={cn('px-4 py-3 whitespace-nowrap', atrasada ? 'font-medium text-rose-600' : 'text-muted-foreground')}>
                          {t.data_prevista ? dataCurta(t.data_prevista) : '—'}
                          {atrasada && ' · atrasada'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handlers.onExcluir(t)}
                            className="rounded-sm p-0.5 text-muted-foreground/50 hover:text-rose-600"
                            aria-label={`Excluir ${t.titulo}`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {tarefas.data && filtradas.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                        {tarefas.data.length === 0 ? 'Nenhuma tarefa cadastrada.' : 'Nenhuma tarefa com esses filtros.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Paginacao {...controles} className={RODAPE_TABELA} />
          </div>
        </>
      )}

      <Dialog
        aberto={excluindoSelecionadas}
        onAbertoChange={setExcluindoSelecionadas}
        titulo={`Excluir ${selecionadasLista.length} tarefa(s)?`}
        descricao="As tarefas selecionadas serão excluídas. Os eventos já registrados na linha do tempo continuam."
      >
        <div className="flex justify-end gap-2">
          <Button variante="secundario" onClick={() => setExcluindoSelecionadas(false)}>
            Cancelar
          </Button>
          <Button variante="perigo" disabled={excluirVarias.isPending} onClick={excluirSelecionadas}>
            Excluir
          </Button>
        </div>
      </Dialog>

      <TarefaForm aberto={novaAberta} onAbertoChange={setNovaAberta} />
      <ImportTarefasDialog aberto={importAberto} onAbertoChange={setImportAberto} />
      {dialogos}
    </div>
  )
}
