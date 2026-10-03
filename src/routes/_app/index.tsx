import { useMemo, useState, type ReactNode } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { CalendarDays, Plus } from 'lucide-react'
import { Button } from '@/components/ui'
import type { ParticipanteRow, PlantaoRow, TarefaRow } from '@/lib/database.types'
import type { AlertaParticipante } from '@/lib/alertas'
import { ENTRADA_VISAO, Kanban, VisaoToggle, lerVisao, type ColunaKanban, type Visao } from '@/components/kanban'
import { aguardandoDemais, tarefaAtrasada } from '@/lib/alertas'
import { ALERTAS } from '@/lib/config'
import { cn, dataCurta, hojeISO } from '@/lib/utils'
import { useParticipantes, useTurmas } from '@/features/participantes/queries'
import { usePlantoes } from '@/features/turmas/queries'
import { useTarefas } from '@/features/tarefas/queries'
import { TarefaCard } from '@/features/tarefas/tarefa-card'
import { TarefaForm } from '@/features/tarefas/tarefa-form'
import { useTarefaAcoes } from '@/features/tarefas/use-tarefa-acoes'
import { AlertasBadges, useEngajamento } from '@/features/engajamento'
import { InfoDica } from '@/components/dica'
import { DICA_COLUNA_HOJE } from '@/lib/textos-dicas'

export const Route = createFileRoute('/_app/')({
  validateSearch: (s: Record<string, unknown>): { visao?: Visao } => ({ visao: lerVisao(s.visao) }),
  component: HojePage,
})

type ItemHoje =
  | { coluna: 'atrasadas' | 'hoje' | 'aguardando'; tipo: 'tarefa'; t: TarefaRow }
  | { coluna: 'alerta'; tipo: 'alerta'; p: ParticipanteRow; alertas: AlertaParticipante[] }
  | { coluna: 'plantoes'; tipo: 'plantao'; pl: PlantaoRow }

const COLUNAS_HOJE: ColunaKanban[] = [
  { chave: 'atrasadas', titulo: 'Atrasadas', ponto: 'bg-rose-500', dica: DICA_COLUNA_HOJE.atrasadas },
  { chave: 'hoje', titulo: 'Para hoje', ponto: 'bg-sky-500', dica: DICA_COLUNA_HOJE.hoje },
  { chave: 'aguardando', titulo: `Aguardando há +${ALERTAS.aguardandoHoras}h`, ponto: 'bg-amber-500', dica: DICA_COLUNA_HOJE.aguardando },
  { chave: 'alerta', titulo: 'Sem contato ou sem resposta', ponto: 'bg-amber-500', dica: DICA_COLUNA_HOJE.alerta },
  { chave: 'plantoes', titulo: 'Plantões hoje e amanhã', ponto: 'bg-emerald-500', dica: DICA_COLUNA_HOJE.plantoes },
]

function HojePage() {
  const busca = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const visao = busca.visao ?? 'tabela'
  const tarefas = useTarefas()
  const participantes = useParticipantes()
  const turmas = useTurmas()
  const plantoes = usePlantoes()
  const { porParticipante } = useEngajamento()
  const { handlers, dialogos } = useTarefaAcoes()
  const [contatoPara, setContatoPara] = useState<ParticipanteRow | null>(null)

  const hoje = hojeISO()
  const amanha = hojeISO(1)
  const participantePorId = useMemo(() => new Map(participantes.data?.map((p) => [p.id, p])), [participantes.data])
  const turmaPorId = useMemo(() => new Map(turmas.data?.map((t) => [t.id, t])), [turmas.data])

  const lista = tarefas.data ?? []
  const atrasadas = lista.filter((t) => tarefaAtrasada(t, hoje))
  const deHoje = lista.filter((t) => t.data_prevista === hoje && t.status !== 'feito')
  const aguardando = lista
    .filter((t) => aguardandoDemais(t))
    .sort((a, b) => (a.enviado_em ?? '').localeCompare(b.enviado_em ?? ''))

  // Quem já tem tarefa aberta não precisa de nova sugestão de contato.
  const comTarefaAberta = new Set(lista.filter((t) => t.status !== 'feito' && t.participante_id).map((t) => t.participante_id))
  const comAlerta = (participantes.data ?? [])
    .map((p) => ({ p, alertas: porParticipante.get(p.id)?.alertas ?? [] }))
    .filter(({ alertas }) => alertas.length)
    .sort((a, b) => Math.max(...b.alertas.map((x) => x.dias)) - Math.max(...a.alertas.map((x) => x.dias)))

  const proximosPlantoes = (plantoes.data ?? [])
    .filter((p) => p.data === hoje || p.data === amanha)
    .sort((a, b) => `${a.data}${a.horario}`.localeCompare(`${b.data}${b.horario}`))

  const cardTarefa = (t: TarefaRow) => (
    <TarefaCard
      key={t.id}
      tarefa={t}
      participante={t.participante_id ? participantePorId.get(t.participante_id) : undefined}
      turma={t.turma_id ? turmaPorId.get(t.turma_id) : undefined}
      filhas={lista.filter((x) => x.parent_id === t.id).length}
      hoje={hoje}
      handlers={handlers}
    />
  )
  const cards = (ts: TarefaRow[]) => <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{ts.map(cardTarefa)}</div>

  const acaoContato = (p: ParticipanteRow) =>
    comTarefaAberta.has(p.id) ? (
      <span className="text-xs text-muted-foreground/70">já tem tarefa aberta</span>
    ) : (
      <Button variante="secundario" className="h-7 px-2 text-xs" onClick={() => setContatoPara(p)}>
        <Plus className="size-3" />
        Tarefa de contato
      </Button>
    )

  const cardPlantao = (pl: PlantaoRow) => (
    <Link
      key={pl.id}
      to="/turmas/$id/plantao/$numero"
      params={{ id: pl.turma_id, numero: String(pl.numero) }}
      className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm hover:border-primary"
    >
      <CalendarDays className="size-5 text-primary" />
      <div>
        <div className="font-medium">
          Plantão {pl.numero} · Turma {turmaPorId.get(pl.turma_id)?.nome}
        </div>
        <div className="text-xs text-muted-foreground">
          {pl.data === hoje ? 'Hoje' : 'Amanhã'}
          {pl.horario && ` às ${pl.horario.slice(0, 5)}`} · {pl.formato === 'online' ? 'Online' : 'Presencial'}
        </div>
      </div>
    </Link>
  )

  const itensKanban: ItemHoje[] = [
    ...atrasadas.map((t) => ({ coluna: 'atrasadas' as const, tipo: 'tarefa' as const, t })),
    ...deHoje.map((t) => ({ coluna: 'hoje' as const, tipo: 'tarefa' as const, t })),
    ...aguardando.map((t) => ({ coluna: 'aguardando' as const, tipo: 'tarefa' as const, t })),
    ...comAlerta.map(({ p, alertas }) => ({ coluna: 'alerta' as const, tipo: 'alerta' as const, p, alertas })),
    ...proximosPlantoes.map((pl) => ({ coluna: 'plantoes' as const, tipo: 'plantao' as const, pl })),
  ]

  const tudoEmDia =
    !tarefas.isLoading &&
    !atrasadas.length &&
    !deHoje.length &&
    !aguardando.length &&
    !comAlerta.length &&
    !proximosPlantoes.length

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hoje</h1>
          <p className="text-sm text-muted-foreground">{dataCurta(hoje)}</p>
        </div>
        <VisaoToggle
          valor={visao}
          onChange={(v) => navigate({ search: { visao: v === 'tabela' ? undefined : v }, replace: true })}
        />
      </div>

      {visao === 'kanban' ? (
        <Kanban
          colunas={COLUNAS_HOJE}
          itens={itensKanban}
          colunaDe={(i) => i.coluna}
          chaveDe={(i) => `${i.coluna}:${i.tipo === 'tarefa' ? i.t.id : i.tipo === 'alerta' ? i.p.id : i.pl.id}`}
          carregando={tarefas.isLoading}
          vazio="Nada pendente"
          renderCard={(i) =>
            i.tipo === 'tarefa' ? (
              cardTarefa(i.t)
            ) : i.tipo === 'plantao' ? (
              cardPlantao(i.pl)
            ) : (
              <article className="space-y-2 rounded-lg border bg-card p-3 text-sm shadow-xs">
                <Link to="/participantes/$id" params={{ id: i.p.id }} className="font-medium hover:text-primary hover:underline">
                  {i.p.nome}
                </Link>
                {i.p.turma_id && <div className="text-xs text-muted-foreground">{turmaPorId.get(i.p.turma_id)?.nome}</div>}
                <AlertasBadges alertas={i.alertas} />
                <div>{acaoContato(i.p)}</div>
              </article>
            )
          }
        />
      ) : (
        <div className={cn('space-y-8', ENTRADA_VISAO)}>

        {tudoEmDia && (
          <p className="rounded-xl border border-dashed px-4 py-12 text-center text-muted-foreground">
            Nada pendente para hoje.
          </p>
        )}

        <Secao titulo="Tarefas atrasadas" total={atrasadas.length} tom="rose" dica={DICA_COLUNA_HOJE.atrasadas}>
          {cards(atrasadas)}
        </Secao>

        <Secao titulo="Para hoje" total={deHoje.length} dica={DICA_COLUNA_HOJE.hoje}>
          {cards(deHoje)}
        </Secao>

        <Secao
          titulo={`Aguardando resposta há mais de ${ALERTAS.aguardandoHoras}h`}
          total={aguardando.length}
          tom="amber"
          dica={DICA_COLUNA_HOJE.aguardando}
        >
          {cards(aguardando)}
        </Secao>

        <Secao
          titulo="Participantes sem contato ou sem resposta"
          total={comAlerta.length}
          tom="amber"
          dica={DICA_COLUNA_HOJE.alerta}
        >
          <ul className="divide-y rounded-lg border bg-card">
            {comAlerta.map(({ p, alertas }) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <Link to="/participantes/$id" params={{ id: p.id }} className="font-medium hover:text-primary hover:underline">
                  {p.nome}
                </Link>
                <span className="text-xs text-muted-foreground">{p.turma_id && turmaPorId.get(p.turma_id)?.nome}</span>
                <AlertasBadges alertas={alertas} />
                <span className="ml-auto">{acaoContato(p)}</span>
              </li>
            ))}
          </ul>
        </Secao>

        <Secao titulo="Plantões de hoje e amanhã" total={proximosPlantoes.length} dica={DICA_COLUNA_HOJE.plantoes}>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{proximosPlantoes.map(cardPlantao)}</div>
        </Secao>
        </div>
      )}

      <TarefaForm
        aberto={!!contatoPara}
        onAbertoChange={(a) => !a && setContatoPara(null)}
        inicial={
          contatoPara
            ? {
                titulo: 'Contato de acompanhamento',
                participante_id: contatoPara.id,
                tipo: 'mensagem_privada',
                canal: 'WhatsApp privado',
                data_prevista: hoje,
              }
            : undefined
        }
      />
      {dialogos}
    </div>
  )
}

function Secao({
  titulo,
  total,
  tom,
  dica,
  children,
}: {
  titulo: string
  total: number
  tom?: 'rose' | 'amber'
  dica?: string
  children: ReactNode
}) {
  if (!total) return null
  const cor = tom === 'rose' ? 'bg-rose-100 text-rose-700' : tom === 'amber' ? 'bg-amber-100 text-amber-800' : 'bg-muted text-muted-foreground'
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        {titulo}
        {dica && <InfoDica texto={dica} />}
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cor}`}>{total}</span>
      </h2>
      {children}
    </section>
  )
}
