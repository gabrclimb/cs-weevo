import { useMemo, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, CalendarPlus, CheckCircle2, ExternalLink, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge, Button, Dialog } from '@/components/ui'
import type { PlantaoRow } from '@/lib/database.types'
import { dataCurta, haQuanto } from '@/lib/utils'
import { useParticipantes } from '@/features/participantes/queries'
import { StatusBadge } from '@/features/participantes/badges'
import { Dica, InfoDica, Th } from '@/components/dica'
import { DICA_COLUNA, DICA_SITUACAO_TURMA, DICA_TIPO_TURMA } from '@/lib/textos-dicas'
import { useExcluirTurma, usePlantoes, useTurmas } from '@/features/turmas/queries'
import { TurmaForm } from '@/features/turmas/turma-form'
import { Paginacao, usePaginacao } from '@/components/paginacao'
import { PlantaoForm } from '@/features/turmas/plantao-form'
import { TarefaForm } from '@/features/tarefas/tarefa-form'
import { AlertasBadges, PontuacaoBadge, useEngajamento } from '@/features/engajamento'
import { VisaoToggle, lerVisao, type Visao } from '@/components/kanban'
import { lerAgrupamento, type Agrupamento } from '@/features/participantes/agrupamentos'
import { AgruparPor, ParticipantesKanban } from '@/features/participantes/participantes-kanban'

export const Route = createFileRoute('/_app/turmas/$id/')({
  validateSearch: (s: Record<string, unknown>): { visao?: Visao; agrupar?: Agrupamento } => {
    const agrupar = lerAgrupamento(s.agrupar)
    return { visao: lerVisao(s.visao), agrupar: agrupar === 'turma' ? undefined : agrupar }
  },
  component: TurmaPage,
})

function TurmaPage() {
  const { id } = Route.useParams()
  const busca = Route.useSearch()
  const navigate = useNavigate()
  const visao = busca.visao ?? 'tabela'
  const agrupamento = busca.agrupar ?? 'status'
  const navegarBusca = useNavigate({ from: Route.fullPath })
  const setBusca = (m: { visao?: Visao; agrupar?: Agrupamento }) =>
    navegarBusca({ search: (s) => ({ ...s, ...m }), replace: true })
  const turmas = useTurmas()
  const plantoes = usePlantoes()
  const participantes = useParticipantes()
  const excluir = useExcluirTurma()
  const { porParticipante } = useEngajamento()
  const [editando, setEditando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [plantaoAberto, setPlantaoAberto] = useState<number | null>(null)
  const [novaTarefa, setNovaTarefa] = useState(false)

  const turma = turmas.data?.find((t) => t.id === id)
  const plantoesDaTurma = useMemo(() => {
    const m = new Map<number, PlantaoRow>()
    for (const p of plantoes.data ?? []) if (p.turma_id === id) m.set(p.numero, p)
    return m
  }, [plantoes.data, id])
  const membros = useMemo(
    () =>
      (participantes.data ?? [])
        .filter((p) => p.turma_id === id)
        .sort((a, b) => (porParticipante.get(b.id)?.pontuacao.total ?? 0) - (porParticipante.get(a.id)?.pontuacao.total ?? 0)),
    [participantes.data, id, porParticipante],
  )

  const { itensPagina, controles } = usePaginacao(membros, id)

  if (turmas.isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>
  if (!turma)
    return (
      <p className="text-sm text-muted-foreground">
        Turma não encontrada.{' '}
        <Link to="/turmas" className="text-primary underline">
          Voltar
        </Link>
      </p>
    )

  return (
    <div className="space-y-6">
      <Link to="/turmas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4" />
        Turmas
      </Link>

      <section className="flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-card p-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Turma {turma.nome}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <Dica texto={DICA_TIPO_TURMA[turma.tipo]} sublinhado>
              {turma.tipo === 'aberta' ? 'Aberta' : 'In company'}
            </Dica>
            {turma.data_imersao && <span>Imersão em {dataCurta(turma.data_imersao)}</span>}
            <span>{membros.length} participante(s)</span>
            {turma.link_grupo && (
              <a href={turma.link_grupo} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                Grupo do WhatsApp <ExternalLink className="size-3.5" />
              </a>
            )}
            {!turma.ativa && (
              <Dica texto={DICA_SITUACAO_TURMA.encerrada}>
                <Badge className="bg-muted text-muted-foreground">Suporte encerrado</Badge>
              </Dica>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variante="secundario" onClick={() => setNovaTarefa(true)}>
            <Plus className="size-4" />
            Tarefa para a turma
          </Button>
          <Button variante="secundario" onClick={() => setEditando(true)}>
            <Pencil className="size-4" />
            Editar
          </Button>
          <Button variante="fantasma" onClick={() => setExcluindo(true)} aria-label="Excluir turma">
            <Trash2 className="size-4 text-rose-600" />
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-lg font-semibold">
          Plantões
          <InfoDica texto="Cada turma tem até 4 plantões. Agende a data de cada um e, depois que acontecer, marque em Presença quem veio: cada presença soma pontos." />
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((n) => {
            const p = plantoesDaTurma.get(n)
            return (
              <div key={n} className="space-y-2 rounded-xl border bg-card p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Plantão {n}</span>
                  {p?.realizado && (
                    <Badge className="bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="mr-1 size-3" />
                      Realizado
                    </Badge>
                  )}
                </div>
                {p ? (
                  <>
                    <p className="text-muted-foreground">
                      {p.data ? dataCurta(p.data) : 'Sem data'}
                      {p.horario && ` às ${p.horario.slice(0, 5)}`} · {p.formato === 'online' ? 'Online' : 'Presencial'}
                    </p>
                    {p.link && (
                      <a href={p.link} target="_blank" rel="noreferrer" className="block truncate text-xs text-primary hover:underline">
                        {p.link}
                      </a>
                    )}
                    <div className="flex gap-1.5 pt-1">
                      <Link
                        to="/turmas/$id/plantao/$numero"
                        params={{ id, numero: String(n) }}
                        className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        <ListChecks className="size-3.5" />
                        Presença
                      </Link>
                      <Button variante="secundario" className="h-7 px-2 text-xs" onClick={() => setPlantaoAberto(n)}>
                        Editar
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button variante="secundario" className="w-full text-xs" onClick={() => setPlantaoAberto(n)}>
                    <CalendarPlus className="size-3.5" />
                    Agendar
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Participantes</h2>
          <div className="flex flex-wrap gap-2">
            {visao === 'kanban' && (
              <AgruparPor
                valor={agrupamento}
                ocultar={['turma']}
                onChange={(a) => setBusca({ agrupar: a === 'status' ? undefined : a })}
              />
            )}
            <VisaoToggle valor={visao} onChange={(v) => setBusca({ visao: v === 'tabela' ? undefined : v })} />
          </div>
        </div>
        {visao === 'kanban' ? (
          <ParticipantesKanban
            participantes={membros}
            turmas={turmas.data ?? []}
            agrupamento={agrupamento}
            porParticipante={porParticipante}
            mostrarTurma={false}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                <tr>
                  <Th dica={DICA_COLUNA.nome}>Nome</Th>
                  <Th dica={DICA_COLUNA.status}>Status</Th>
                  <Th dica={DICA_COLUNA.presencas}>Presenças</Th>
                  <Th dica={DICA_COLUNA.ultimaResposta}>Última resposta</Th>
                  <Th dica={DICA_COLUNA.alertas}>Alertas</Th>
                  <Th dica={DICA_COLUNA.pontuacao} className="text-right">
                    Pontuação
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {itensPagina.map((p) => {
                  const eng = porParticipante.get(p.id)
                  return (
                    <tr key={p.id} className="hover:bg-muted/50">
                      <td className="px-4 py-2.5">
                        <Link to="/participantes/$id" params={{ id: p.id }} className="font-medium hover:text-primary hover:underline">
                          {p.nome}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">{eng?.pontuacao.detalhe.presencas ?? 0}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{haQuanto(p.ultima_resposta_em)}</td>
                      <td className="px-4 py-2.5">
                        <AlertasBadges alertas={eng?.alertas ?? []} />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <PontuacaoBadge pontuacao={eng?.pontuacao} />
                      </td>
                    </tr>
                  )
                })}
                {membros.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum participante nesta turma.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {visao === 'tabela' && <Paginacao {...controles} />}
      </section>

      <TurmaForm aberto={editando} onAbertoChange={setEditando} turma={turma} />
      {plantaoAberto !== null && (
        <PlantaoForm
          aberto
          onAbertoChange={(a) => !a && setPlantaoAberto(null)}
          turmaId={id}
          numero={plantaoAberto}
          plantao={plantoesDaTurma.get(plantaoAberto)}
        />
      )}
      <TarefaForm
        aberto={novaTarefa}
        onAbertoChange={setNovaTarefa}
        inicial={{ turma_id: id, tipo: 'conteudo_grupo', canal: 'Grupo da turma' }}
      />
      <Dialog
        aberto={excluindo}
        onAbertoChange={setExcluindo}
        titulo="Excluir turma?"
        descricao={`A turma ${turma.nome}, seus plantões e tarefas serão excluídos. Os participantes ficam sem turma.`}
      >
        <div className="flex justify-end gap-2">
          <Button variante="secundario" onClick={() => setExcluindo(false)}>
            Cancelar
          </Button>
          <Button variante="perigo" onClick={() => excluir.mutate(id, { onSuccess: () => navigate({ to: '/turmas' }) })}>
            Excluir
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
