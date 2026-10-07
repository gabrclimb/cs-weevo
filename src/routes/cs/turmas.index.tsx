import { useMemo, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { CalendarCheck, Plus, Users } from 'lucide-react'
import { Badge, Button, Select } from '@/components/ui'
import { ENTRADA_VISAO, Kanban, VisaoToggle, lerVisao, type ColunaKanban, type Visao } from '@/components/kanban'
import type { TurmaRow } from '@/lib/database.types'
import { cn, dataCurta } from '@/lib/utils'
import { useParticipantes } from '@/features/participantes/queries'
import { useAtualizarTurma, usePlantoes, useTurmas } from '@/features/turmas/queries'
import { TurmaForm } from '@/features/turmas/turma-form'
import { CABECALHO_TABELA, Paginacao, RODAPE_TABELA, usePaginacao } from '@/components/paginacao'
import { useEngajamento } from '@/features/engajamento'
import { Dica, Th } from '@/components/dica'
import { DICA_COLUNA, DICA_SITUACAO_TURMA, DICA_TIPO_TURMA } from '@/lib/textos-dicas'

const AGRUPAMENTOS_TURMA = {
  situacao: 'Situação',
  tipo: 'Tipo',
  plantoes: 'Plantões realizados',
} as const
type AgrupamentoTurma = keyof typeof AGRUPAMENTOS_TURMA

type Busca = { visao?: Visao; agrupar?: AgrupamentoTurma }

export const Route = createFileRoute('/cs/turmas/')({
  validateSearch: (s: Record<string, unknown>): Busca => ({
    visao: lerVisao(s.visao),
    agrupar: typeof s.agrupar === 'string' && s.agrupar in AGRUPAMENTOS_TURMA ? (s.agrupar as AgrupamentoTurma) : undefined,
  }),
  component: TurmasPage,
})

type Resumo = { participantes: number; realizados: number; soma: number }

function TurmasPage() {
  const busca = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const turmas = useTurmas()
  const participantes = useParticipantes()
  const plantoes = usePlantoes()
  const atualizar = useAtualizarTurma()
  const { porParticipante } = useEngajamento()
  const [novaAberta, setNovaAberta] = useState(false)

  const visao = busca.visao ?? 'tabela'
  const agrupamento = busca.agrupar ?? 'situacao'
  const setBusca = (m: Busca) => navigate({ search: (s) => ({ ...s, ...m }), replace: true })

  const resumo = useMemo(() => {
    const m = new Map<string, Resumo>()
    for (const t of turmas.data ?? []) m.set(t.id, { participantes: 0, realizados: 0, soma: 0 })
    for (const p of participantes.data ?? []) {
      const r = p.turma_id ? m.get(p.turma_id) : undefined
      if (!r) continue
      r.participantes++
      r.soma += porParticipante.get(p.id)?.pontuacao.total ?? 0
    }
    for (const pl of plantoes.data ?? []) {
      const r = m.get(pl.turma_id)
      if (r && pl.realizado) r.realizados++
    }
    return m
  }, [turmas.data, participantes.data, plantoes.data, porParticipante])

  const ordenadas = [...(turmas.data ?? [])].sort(
    (a, b) => Number(b.ativa) - Number(a.ativa) || (b.data_imersao ?? '').localeCompare(a.data_imersao ?? ''),
  )

  const { itensPagina, controles } = usePaginacao(ordenadas)

  const media = (r?: Resumo) => (r?.participantes ? Math.round(r.soma / r.participantes) : null)

  const grupos: { colunas: ColunaKanban[]; colunaDe: (t: TurmaRow) => string; mover?: (t: TurmaRow, c: string) => void } =
    agrupamento === 'tipo'
      ? {
          colunas: [
            { chave: 'aberta', titulo: 'Aberta', dica: DICA_TIPO_TURMA.aberta },
            { chave: 'in_company', titulo: 'In company', dica: DICA_TIPO_TURMA.in_company },
          ],
          colunaDe: (t) => t.tipo,
          mover: (t, c) => atualizar.mutate({ id: t.id, mudancas: { tipo: c as TurmaRow['tipo'] } }),
        }
      : agrupamento === 'plantoes'
        ? {
            colunas: [0, 1, 2, 3, 4].map((n) => ({
              chave: String(n),
              titulo: n === 4 ? '4 de 4 (concluída)' : `${n} de 4`,
              ponto: n === 4 ? 'bg-emerald-500' : n === 0 ? 'bg-muted-foreground' : 'bg-amber-500',
              dica: n === 0 ? 'Turmas que ainda não realizaram nenhum plantão.' : `Turmas com ${n} dos 4 plantões já realizados.`,
            })),
            colunaDe: (t) => String(Math.min(resumo.get(t.id)?.realizados ?? 0, 4)),
          }
        : {
            colunas: [
              { chave: 'ativa', titulo: 'Em suporte', ponto: 'bg-emerald-500', dica: DICA_SITUACAO_TURMA.ativa },
              { chave: 'encerrada', titulo: 'Suporte encerrado', ponto: 'bg-muted-foreground', dica: DICA_SITUACAO_TURMA.encerrada },
            ],
            colunaDe: (t) => (t.ativa ? 'ativa' : 'encerrada'),
            mover: (t, c) => atualizar.mutate({ id: t.id, mudancas: { ativa: c === 'ativa' } }),
          }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Turmas</h1>
        <div className="flex flex-wrap gap-2">
          {visao === 'kanban' && (
            <Select
              className="w-60"
              value={agrupamento}
              aria-label="Agrupar por"
              onValueChange={(v) => setBusca({ agrupar: v === 'situacao' ? undefined : (v as AgrupamentoTurma) })}
            >
              {Object.entries(AGRUPAMENTOS_TURMA).map(([k, label]) => (
                <option key={k} value={k}>
                  Agrupar por: {label}
                </option>
              ))}
            </Select>
          )}
          <VisaoToggle valor={visao} onChange={(v) => setBusca({ visao: v === 'tabela' ? undefined : v })} />
          <Button onClick={() => setNovaAberta(true)}>
            <Plus className="size-4" />
            Nova turma
          </Button>
        </div>
      </div>

      {turmas.error && <p className="text-sm text-rose-700">Não foi possível carregar as turmas. Tente novamente.</p>}

      {visao === 'kanban' ? (
        <Kanban
          colunas={grupos.colunas}
          itens={ordenadas}
          colunaDe={grupos.colunaDe}
          chaveDe={(t) => t.id}
          onMover={grupos.mover}
          carregando={turmas.isLoading}
          vazio="Nenhuma turma"
          ajudaMover={agrupamento === 'tipo' ? 'Arraste uma turma para outra coluna para mudar o tipo.' : 'Arraste uma turma para outra coluna para abrir ou encerrar o suporte.'}
          renderCard={(t) => {
            const r = resumo.get(t.id)
            const m = media(r)
            return (
              <article className="space-y-2 rounded-lg border bg-card p-3 text-sm shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to="/cs/turmas/$id"
                    params={{ id: t.id }}
                    draggable={false}
                    className="font-medium hover:text-primary hover:underline"
                  >
                    {t.nome}
                  </Link>
                  {m !== null && (
                    <Dica texto={DICA_COLUNA.pontuacaoMedia}>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">{m}</span>
                    </Dica>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {t.data_imersao && <span>Imersão {dataCurta(t.data_imersao)}</span>}
                  <Dica texto={DICA_COLUNA.participantes}>
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3" />
                      {r?.participantes ?? 0}
                    </span>
                  </Dica>
                  <Dica texto={DICA_COLUNA.plantoesRealizados}>
                    <span className="inline-flex items-center gap-1">
                      <CalendarCheck className="size-3" />
                      {r?.realizados ?? 0}/4 plantões
                    </span>
                  </Dica>
                </div>
                <div className="flex gap-1">
                  {agrupamento !== 'tipo' && <TipoBadge tipo={t.tipo} />}
                  {agrupamento !== 'situacao' && !t.ativa && <EncerradaBadge />}
                </div>
              </article>
            )
          }}
        />
      ) : (
        <div className={cn('overflow-hidden rounded-lg border bg-card', ENTRADA_VISAO)}>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={cn('border-b', CABECALHO_TABELA)}>
              <tr>
                <Th dica="Clique no nome para abrir a turma, com plantões e participantes.">Turma</Th>
                <Th dica={DICA_COLUNA.imersao}>Imersão</Th>
                <Th dica={DICA_COLUNA.participantes} className="text-right">
                  Participantes
                </Th>
                <Th dica={DICA_COLUNA.plantoesRealizados} className="text-right">
                  Plantões
                </Th>
                <Th dica={DICA_COLUNA.pontuacaoMedia} className="text-right">
                  Pontuação média
                </Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {itensPagina.map((t) => {
                const r = resumo.get(t.id)
                return (
                  <tr key={t.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link to="/cs/turmas/$id" params={{ id: t.id }} className="font-medium hover:text-primary hover:underline">
                        {t.nome}
                      </Link>
                      <div className="mt-0.5 flex gap-1">
                        <TipoBadge tipo={t.tipo} />
                        {!t.ativa && <EncerradaBadge />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{dataCurta(t.data_imersao) || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r?.participantes ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r?.realizados ?? 0} de 4</td>
                    <td className="px-4 py-3 text-right tabular-nums">{media(r) ?? '—'}</td>
                  </tr>
                )
              })}
              {turmas.data?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhuma turma cadastrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
          <Paginacao {...controles} className={RODAPE_TABELA} />
        </div>
      )}

      <TurmaForm
        aberto={novaAberta}
        onAbertoChange={setNovaAberta}
        onSalva={(t) => navigate({ to: '/cs/turmas/$id', params: { id: t.id } })}
      />
    </div>
  )
}

function TipoBadge({ tipo }: { tipo: TurmaRow['tipo'] }) {
  return (
    <Dica texto={DICA_TIPO_TURMA[tipo]}>
      <Badge className="bg-muted text-muted-foreground">{tipo === 'aberta' ? 'Aberta' : 'In company'}</Badge>
    </Dica>
  )
}

function EncerradaBadge() {
  return (
    <Dica texto={DICA_SITUACAO_TURMA.encerrada}>
      <Badge className="bg-muted text-muted-foreground">Encerrada</Badge>
    </Dica>
  )
}
