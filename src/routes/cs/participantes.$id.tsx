import { useMemo, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Copy, MessageCircleReply, MessagesSquare, Pencil, Plus, Rocket, StickyNote, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, Dialog, Select } from '@/components/ui'
import type { EventoRow, EventoTipo, ParticipanteStatus, WeevoStart } from '@/lib/tipos'
import { formatarTelefone } from '@/lib/telefone'
import { cn, dataHora, haQuanto, hojeISO } from '@/lib/utils'
import {
  STATUS_KEYS,
  STATUS_PARTICIPANTE,
  WEEVO_START,
  WEEVO_START_KEYS,
  apelidoDistinto,
} from '@/features/participantes/constantes'
import { CAMPOS_ACOMPANHAMENTO, ParticipanteForm } from '@/features/participantes/participante-form'
import {
  useAtualizarParticipante,
  useExcluirParticipante,
  useParticipante,
  useTurmas,
} from '@/features/participantes/queries'
import { CATEGORIA, EVENTO } from '@/features/eventos/constantes'
import { EventoRapidoDialog } from '@/features/eventos/evento-rapido-dialog'
import { useEventosParticipante, useExcluirEvento, useRegistrarEventos } from '@/features/eventos/queries'
import { AlertasBadges, PontuacaoBadge, useEngajamento } from '@/features/engajamento'
import { useAcaoTarefa, useTarefas } from '@/features/tarefas/queries'
import { RespostaDialog, type DadosResposta } from '@/features/tarefas/resposta-dialog'
import { TarefaCard } from '@/features/tarefas/tarefa-card'
import { TarefaForm } from '@/features/tarefas/tarefa-form'
import { useTarefaAcoes } from '@/features/tarefas/use-tarefa-acoes'
import { usePlantoes } from '@/features/turmas/queries'
import { explicarPontuacao } from '@/lib/explicacao'
import { GradePlantoes, LegendaPlantoes, estadosPlantoes } from '@/features/pontuacao/grade-plantoes'
import { ExplicacaoPontuacao } from '@/features/pontuacao/explicacao-pontuacao'
import { Dica, InfoDica } from '@/components/dica'
import { DICA_COLUNA, DICA_STATUS_PARTICIPANTE, DICA_WEEVO_START } from '@/lib/textos-dicas'
import { PESOS } from '@/lib/config'

export const Route = createFileRoute('/cs/participantes/$id')({
  component: FichaParticipante,
})

function FichaParticipante() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const participante = useParticipante(id)
  const eventos = useEventosParticipante(id)
  const plantoes = usePlantoes()
  const turmas = useTurmas()
  const tarefas = useTarefas()
  const atualizar = useAtualizarParticipante()
  const excluir = useExcluirParticipante()
  const registrar = useRegistrarEventos()
  const excluirEvento = useExcluirEvento()
  const acaoTarefa = useAcaoTarefa()
  const { porParticipante } = useEngajamento()
  const { handlers, dialogos } = useTarefaAcoes()

  const [editando, setEditando] = useState(false)
  const [confirmaExclusao, setConfirmaExclusao] = useState(false)
  const [novaTarefa, setNovaTarefa] = useState(false)
  const [respondendo, setRespondendo] = useState(false)
  const [eventoRapido, setEventoRapido] = useState<EventoTipo | null>(null)
  const [eventoExcluindo, setEventoExcluindo] = useState<EventoRow | null>(null)

  const tarefasAbertas = useMemo(
    () => (tarefas.data ?? []).filter((t) => t.participante_id === id && t.status !== 'feito'),
    [tarefas.data, id],
  )
  const tarefaPorId = useMemo(() => new Map(tarefas.data?.map((t) => [t.id, t])), [tarefas.data])

  if (participante.isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>
  if (participante.error) return <p className="text-sm text-rose-700">Não foi possível carregar o participante. Tente novamente.</p>
  const p = participante.data
  if (!p)
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Participante não encontrado.</p>
        <Link to="/cs/participantes" className="text-sm text-primary underline">
          Voltar para a lista
        </Link>
      </div>
    )

  const turma = turmas.data?.find((t) => t.id === p.turma_id)
  const eng = porParticipante.get(p.id)

  function copiarTelefone() {
    if (!p?.telefone) return
    navigator.clipboard.writeText(p.telefone.replace(/^\+/, ''))
    toast.success('Telefone copiado.')
  }

  /** "Respondeu" pela ficha: fecha a tarefa aguardando mais recente, se houver; senão registra só o evento. */
  function registrarResposta(r: DadosResposta) {
    const aguardando = tarefasAbertas
      .filter((t) => t.status === 'aguardando_resposta')
      .sort((a, b) => (b.enviado_em ?? '').localeCompare(a.enviado_em ?? ''))[0]
    if (aguardando) {
      acaoTarefa.mutate({ tarefa: aguardando, acao: { tipo: 'respondeu', ...r } })
      toast.success(`Resposta registrada e tarefa "${aguardando.titulo}" concluída.`)
      return
    }
    const agora = new Date().toISOString()
    registrar.mutate(
      [
        { participante_id: id, tipo: 'resposta_recebida', categoria: r.categoria, nota: r.nota, ocorrido_em: agora },
        ...(r.marcarImplementou
          ? [{ participante_id: id, tipo: 'implementou' as const, nota: r.nota ? `Evidência: ${r.nota}` : null, ocorrido_em: agora }]
          : []),
      ],
      { onSuccess: () => toast.success('Resposta registrada.') },
    )
  }

  return (
    <div className="space-y-6">
      <Link to="/cs/participantes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4" />
        Participantes
      </Link>

      <section className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold">
              {p.nome}
              {apelidoDistinto(p) && <span className="text-base font-normal text-muted-foreground">"{apelidoDistinto(p)}"</span>}
              <PontuacaoBadge pontuacao={eng?.pontuacao} className="text-base" />
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {turma ? (
                <Link to="/cs/turmas/$id" params={{ id: turma.id }} className="hover:text-primary hover:underline">
                  Turma {turma.nome}
                </Link>
              ) : (
                <span>Sem turma</span>
              )}
              {p.empresa && <span>{p.empresa}</span>}
              {p.telefone ? (
                <button onClick={copiarTelefone} className="inline-flex items-center gap-1 hover:text-primary" title="Copiar telefone">
                  {formatarTelefone(p.telefone)}
                  <Copy className="size-3.5" />
                </button>
              ) : (
                <span className="text-muted-foreground/70">Sem telefone</span>
              )}
              {p.implementou && (
                <Dica texto={DICA_COLUNA.implementou}>
                  <Badge className="bg-emerald-100 text-emerald-800">Implementou</Badge>
                </Dica>
              )}
            </div>
            <AlertasBadges alertas={eng?.alertas ?? []} />
          </div>
          <div className="flex gap-2">
            <Button variante="secundario" onClick={() => setEditando(true)}>
              <Pencil className="size-4" />
              Editar
            </Button>
            <Button variante="fantasma" onClick={() => setConfirmaExclusao(true)} aria-label="Excluir participante">
              <Trash2 className="size-4 text-rose-600" />
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase">
              Status
              <InfoDica texto={<><strong>{STATUS_PARTICIPANTE[p.status].label}:</strong> {DICA_STATUS_PARTICIPANTE[p.status]} Mudar o status fica registrado na linha do tempo e não altera a pontuação.</>} />
            </span>
            <Select
              value={p.status}
              onValueChange={(v) => atualizar.mutate({ atual: p, mudancas: { status: v as ParticipanteStatus } })}
            >
              {STATUS_KEYS.map((k) => (
                <option key={k} value={k}>
                  {STATUS_PARTICIPANTE[k].label}
                </option>
              ))}
            </Select>
            {eng?.alertas.some((a) => a.tipo === 'sem_resposta') && p.status !== 'sem_resposta' && (
              <button
                className="text-xs text-amber-700 hover:underline"
                onClick={() => atualizar.mutate({ atual: p, mudancas: { status: 'sem_resposta' } })}
              >
                Sugestão: marcar "Sem resposta"
              </button>
            )}
          </label>
          <label className="space-y-1">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase">
              Weevo Start
              <InfoDica texto={<><strong>{WEEVO_START[p.weevo_start].label}:</strong> {DICA_WEEVO_START[p.weevo_start]}</>} />
            </span>
            <Select
              value={p.weevo_start}
              onValueChange={(v) => atualizar.mutate({ atual: p, mudancas: { weevo_start: v as WeevoStart } })}
            >
              {WEEVO_START_KEYS.map((k) => (
                <option key={k} value={k}>
                  {WEEVO_START[k].label}
                </option>
              ))}
            </Select>
          </label>
          <Info label="Último contato" valor={haQuanto(p.ultimo_contato_em)} titulo={dataHora(p.ultimo_contato_em)} ajuda={DICA_COLUNA.ultimoContato} />
          <Info label="Última resposta" valor={haQuanto(p.ultima_resposta_em)} titulo={dataHora(p.ultima_resposta_em)} ajuda={DICA_COLUNA.ultimaResposta} />
        </div>

        {CAMPOS_ACOMPANHAMENTO.some(([k]) => p[k]) && (
          <dl className="mt-5 grid gap-x-6 gap-y-3 border-t pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {CAMPOS_ACOMPANHAMENTO.filter(([k]) => p[k]).map(([k, label, longo]) => (
              <div key={k} className={cn(longo && 'sm:col-span-2')}>
                <dt className="text-xs font-medium text-muted-foreground uppercase">{label}</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-foreground">{p[k]}</dd>
              </div>
            ))}
          </dl>
        )}

        {p.observacoes && (
          <p className="mt-4 rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap text-foreground">{p.observacoes}</p>
        )}

        <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
          <Dica texto="Cria uma tarefa (mensagem, ligação etc.) já vinculada a este participante.">
            <Button onClick={() => setNovaTarefa(true)}>
              <Plus className="size-4" />
              Nova tarefa
            </Button>
          </Dica>
          <Dica texto="O participante respondeu fora de uma tarefa? Registre aqui. Conta para Responsividade e Recência na pontuação.">
            <Button variante="secundario" onClick={() => setRespondendo(true)}>
              <MessageCircleReply className="size-4" />
              Registrar resposta
            </Button>
          </Dica>
          <Dica texto={`Tirou dúvida, compartilhou algo ou comentou no grupo da turma. Soma ${PESOS.porInteracaoGrupo} pontos (até ${PESOS.tetoGrupo}).`}>
            <Button variante="secundario" onClick={() => setEventoRapido('interacao_grupo')}>
              <MessagesSquare className="size-4" />
              Interação no grupo
            </Button>
          </Dica>
          {!p.implementou && (
            <Dica texto={`Colocou algo em uso. Descreva a evidência. Soma ${PESOS.implementou} pontos, o maior peso.`}>
              <Button variante="secundario" onClick={() => setEventoRapido('implementou')}>
                <Rocket className="size-4" />
                Implementou
              </Button>
            </Dica>
          )}
          <Dica texto="Observação livre na linha do tempo. Não altera a pontuação.">
            <Button variante="secundario" onClick={() => setEventoRapido('nota')}>
              <StickyNote className="size-4" />
              Nota
            </Button>
          </Dica>
        </div>
      </section>

      {eng && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Plantões e pontuação</h2>
            <GradePlantoes
              estados={estadosPlantoes(
                (plantoes.data ?? []).filter((pl) => pl.turma_id === p.turma_id),
                new Set((eventos.data ?? []).flatMap((e) => (e.tipo === 'plantao_presenca' && e.plantao_id ? [e.plantao_id] : []))),
              )}
            />
          </div>
          <LegendaPlantoes />
          <ExplicacaoPontuacao
            pontuacao={eng.pontuacao}
            explicacao={explicarPontuacao(eventos.data ?? [])}
            plantoes={plantoes.data ?? []}
          />
        </section>
      )}

      {tarefasAbertas.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Tarefas abertas</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {tarefasAbertas.map((t) => (
              <TarefaCard key={t.id} tarefa={t} participante={p} filhas={0} hoje={hojeISO()} handlers={handlers} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Linha do tempo</h2>
          <p className="text-xs text-muted-foreground">Registra ações feitas com o participante. A conversa em si fica no CRM.</p>
        </div>
        {eventos.data?.length ? (
          <ol className="relative space-y-3 border-l border-border pl-6">
            {eventos.data.map((e) => {
              const { icone: Icone, label, cor } = EVENTO[e.tipo]
              const tarefa = e.tarefa_id ? tarefaPorId.get(e.tarefa_id) : undefined
              return (
                <li key={e.id} className="group relative">
                  <span className={cn('absolute top-2 -left-9.5 flex size-7 items-center justify-center rounded-full ring-4 ring-background', cor)}>
                    <Icone className="size-3.5" />
                  </span>
                  <div className="rounded-lg border bg-card px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="font-medium">{label}</span>
                      {e.categoria && <Badge className="bg-muted text-foreground">{CATEGORIA[e.categoria]}</Badge>}
                      {e.origem !== 'manual' && <Badge className="bg-sky-50 text-sky-700">{e.origem}</Badge>}
                      <span className="ml-auto text-xs text-muted-foreground">{dataHora(e.ocorrido_em)}</span>
                      <button
                        onClick={() => setEventoExcluindo(e)}
                        className="rounded-sm p-0.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-rose-600"
                        aria-label="Excluir evento"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    {e.nota && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{e.nota}</p>}
                    {tarefa && (
                      <Link to="/cs/tarefas" search={{ tarefa: tarefa.id }} className="mt-1 inline-block text-xs text-primary hover:underline">
                        Tarefa: {tarefa.titulo}
                      </Link>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            {eventos.isLoading ? 'Carregando…' : 'Nenhum evento registrado ainda.'}
          </p>
        )}
      </section>

      <ParticipanteForm aberto={editando} onAbertoChange={setEditando} participante={p} />
      <TarefaForm
        aberto={novaTarefa}
        onAbertoChange={setNovaTarefa}
        inicial={{ participante_id: p.id, tipo: 'mensagem_privada', canal: 'WhatsApp privado' }}
      />
      <RespostaDialog
        aberto={respondendo}
        onAbertoChange={setRespondendo}
        nome={p.nome}
        jaImplementou={p.implementou}
        onConfirmar={registrarResposta}
      />
      <EventoRapidoDialog
        tipo={eventoRapido}
        onFechar={() => setEventoRapido(null)}
        onConfirmar={(d) =>
          eventoRapido &&
          registrar.mutate([{ participante_id: id, tipo: eventoRapido, ...d }], {
            onSuccess: () => toast.success('Registrado na linha do tempo.'),
          })
        }
      />
      {dialogos}

      <Dialog
        aberto={!!eventoExcluindo}
        onAbertoChange={(a) => !a && setEventoExcluindo(null)}
        titulo="Excluir evento?"
        descricao="A linha do tempo não é editável: para corrigir, exclua e registre de novo. Datas e pontuação são recalculadas."
      >
        <div className="flex justify-end gap-2">
          <Button variante="secundario" onClick={() => setEventoExcluindo(null)}>
            Cancelar
          </Button>
          <Button
            variante="perigo"
            onClick={() =>
              eventoExcluindo && excluirEvento.mutate(eventoExcluindo.id, { onSuccess: () => setEventoExcluindo(null) })
            }
          >
            Excluir
          </Button>
        </div>
      </Dialog>

      <Dialog
        aberto={confirmaExclusao}
        onAbertoChange={setConfirmaExclusao}
        titulo="Excluir participante?"
        descricao={`${p.nome} e toda a linha do tempo dele serão excluídos. Essa ação não pode ser desfeita.`}
      >
        <div className="flex justify-end gap-2">
          <Button variante="secundario" onClick={() => setConfirmaExclusao(false)}>
            Cancelar
          </Button>
          <Button
            variante="perigo"
            disabled={excluir.isPending}
            onClick={() => excluir.mutate(p.id, { onSuccess: () => navigate({ to: '/cs/participantes' }) })}
          >
            Excluir
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

function Info({ label, valor, titulo, ajuda }: { label: string; valor: string; titulo?: string; ajuda?: string }) {
  return (
    <div className="space-y-1" title={titulo}>
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase">
        {label}
        {ajuda && <InfoDica texto={ajuda} />}
      </span>
      <p className="py-2 text-sm text-foreground">{valor}</p>
    </div>
  )
}
