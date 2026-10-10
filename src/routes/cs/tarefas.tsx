import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FileUp, Plus, Search } from 'lucide-react'
import { Button, Input, Select } from '@/components/ui'
import type { TarefaRow } from '@/lib/tipos'
import { normalize } from '@/lib/csv'
import { hojeISO } from '@/lib/utils'
import { tarefaAtrasada } from '@/lib/alertas'
import { useParticipantes, useTurmas } from '@/features/participantes/queries'
import { STATUS_TAREFA, STATUS_TAREFA_KEYS, TIPO_TAREFA, TIPO_TAREFA_KEYS, type StatusTarefa, type TipoTarefa } from '@/features/tarefas/constantes'
import { ImportTarefasDialog } from '@/features/tarefas/import-dialog'
import { useAcaoTarefa, useTarefas } from '@/features/tarefas/queries'
import { TarefaCard } from '@/features/tarefas/tarefa-card'
import { TarefaForm } from '@/features/tarefas/tarefa-form'
import { useTarefaAcoes } from '@/features/tarefas/use-tarefa-acoes'
import { Kanban, type ColunaKanban } from '@/components/kanban'
import { DICA_STATUS_TAREFA } from '@/lib/textos-dicas'

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
}

export const Route = createFileRoute('/cs/tarefas')({
  validateSearch: (s: Record<string, unknown>): Filtros => ({
    tarefa: typeof s.tarefa === 'string' ? s.tarefa : undefined,
    q: typeof s.q === 'string' && s.q ? s.q : undefined,
    turma: typeof s.turma === 'string' && s.turma ? s.turma : undefined,
    tipo: TIPO_TAREFA_KEYS.includes(s.tipo as TipoTarefa) ? (s.tipo as TipoTarefa) : undefined,
    periodo: typeof s.periodo === 'string' && s.periodo in PERIODOS ? (s.periodo as Periodo) : undefined,
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
      if (busca && !normalize(`${t.titulo} ${p?.nome ?? ''} ${p?.apelido ?? ''} ${t.para_quem ?? ''}`).includes(busca)) continue
      lista.push(t)
    }
    return lista
  }, [tarefas.data, participantePorId, filtros, hoje])

  // Solta no fim da coluna de destino.
  function mover(t: TarefaRow, status: string) {
    const destino = status as StatusTarefa
    const ordem = Math.max(0, ...(tarefas.data ?? []).filter((x) => x.status === destino).map((x) => x.ordem)) + 1
    acao.mutate({ tarefa: t, acao: { tipo: 'status', status: destino, ordem } })
  }

  const setFiltro = (m: Partial<Filtros>) => navigate({ search: (s) => ({ ...s, ...m }), replace: true })
  const temFiltro = !!(filtros.q || filtros.turma || filtros.tipo || filtros.periodo)

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

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px_170px_auto]">
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
        {temFiltro && (
          <Button variante="fantasma" onClick={() => navigate({ search: {}, replace: true })}>
            Limpar
          </Button>
        )}
      </div>

      {tarefas.error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          Não foi possível carregar as tarefas. Tente novamente.
        </div>
      )}

      <Kanban
        colunas={COLUNAS}
        itens={filtradas}
        colunaDe={(t) => t.status}
        chaveDe={(t) => t.id}
        onMover={mover}
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

      <TarefaForm aberto={novaAberta} onAbertoChange={setNovaAberta} />
      <ImportTarefasDialog aberto={importAberto} onAbertoChange={setImportAberto} />
      {dialogos}
    </div>
  )
}
