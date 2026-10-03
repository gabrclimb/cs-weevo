import { useMemo, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Papa from 'papaparse'
import { Check, Download, Handshake } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Select } from '@/components/ui'
import type { ParticipanteRow } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { formatarTelefone } from '@/lib/telefone'
import { dataCurta, haQuanto, hojeISO, mensagemErro } from '@/lib/utils'
import { useParticipantes, useTurmas } from '@/features/participantes/queries'
import { WEEVO_START } from '@/features/participantes/constantes'
import { WeevoStartBadge } from '@/features/participantes/badges'
import { Dica, Th } from '@/components/dica'
import { DICA_COLUNA } from '@/lib/textos-dicas'
import { invalidarEventos } from '@/features/eventos/queries'
import { PontuacaoBadge, useEngajamento } from '@/features/engajamento'

type Filtros = { turma?: string; todos?: boolean }

export const Route = createFileRoute('/_app/ranking')({
  validateSearch: (s: Record<string, unknown>): Filtros => ({
    turma: typeof s.turma === 'string' && s.turma ? s.turma : undefined,
    todos: s.todos === true || s.todos === 'true' ? true : undefined,
  }),
  component: RankingPage,
})

/** Repasse: weevo_start = repassado_comercial + evento repassado_comercial, em lote. */
function useRepassar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (participantes: ParticipanteRow[]) => {
      const ids = participantes.map((p) => p.id)
      const { error } = await supabase.from('weevo_participantes').update({ weevo_start: 'repassado_comercial' }).in('id', ids)
      if (error) throw error
      const agora = new Date().toISOString()
      const { error: erroEventos } = await supabase
        .from('weevo_eventos')
        .insert(ids.map((participante_id) => ({ participante_id, tipo: 'repassado_comercial' as const, ocorrido_em: agora })))
      if (erroEventos) throw erroEventos
      return ids.length
    },
    onSuccess: (n) => {
      toast.success(`${n} participante(s) repassado(s) ao comercial.`)
      invalidarEventos(qc)
    },
    onError: (e) => toast.error(mensagemErro(e)),
  })
}

function RankingPage() {
  const filtros = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const participantes = useParticipantes()
  const turmas = useTurmas()
  const { porParticipante, carregando } = useEngajamento()
  const repassar = useRepassar()
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())

  const turmaPorId = useMemo(() => new Map(turmas.data?.map((t) => [t.id, t.nome])), [turmas.data])

  const linhas = useMemo(
    () =>
      (participantes.data ?? [])
        .filter((p) => !filtros.turma || p.turma_id === filtros.turma)
        .filter(
          (p) =>
            filtros.todos ||
            (p.status !== 'inativo' && p.weevo_start !== 'assinante' && p.weevo_start !== 'recusou'),
        )
        .map((p) => ({ p, eng: porParticipante.get(p.id) }))
        .sort(
          (a, b) =>
            (b.eng?.pontuacao.total ?? 0) - (a.eng?.pontuacao.total ?? 0) ||
            (b.p.ultima_resposta_em ?? '').localeCompare(a.p.ultima_resposta_em ?? ''),
        ),
    [participantes.data, porParticipante, filtros],
  )

  const elegiveis = linhas.filter(({ p }) => p.weevo_start === 'nao_avaliado' || p.weevo_start === 'candidato')
  const selecionadosLista = linhas.filter(({ p }) => selecionados.has(p.id)).map(({ p }) => p)

  function alternar(id: string, marcado: boolean) {
    setSelecionados((s) => {
      const n = new Set(s)
      if (marcado) n.add(id)
      else n.delete(id)
      return n
    })
  }

  function exportar() {
    const csv = Papa.unparse(
      linhas.map(({ p, eng }, i) => ({
        Posição: i + 1,
        Nome: p.nome,
        Telefone: formatarTelefone(p.telefone),
        Empresa: p.empresa ?? '',
        Turma: p.turma_id ? (turmaPorId.get(p.turma_id) ?? '') : '',
        Pontuação: eng?.pontuacao.total ?? 0,
        Implementou: p.implementou ? 'Sim' : 'Não',
        Presenças: eng?.pontuacao.detalhe.presencas ?? 0,
        'Última resposta': dataCurta(p.ultima_resposta_em),
        'Weevo Start': WEEVO_START[p.weevo_start].label,
      })),
      { delimiter: ';' },
    )
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ranking-weevo-${hojeISO()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ranking de engajamento</h1>
          <p className="text-sm text-muted-foreground">
            Pesos iniciais, sem validação: passe o mouse na pontuação para ver a composição.{' '}
            <Link to="/ajuda" className="text-primary hover:underline">
              Como funciona a pontuação
            </Link>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variante="secundario" onClick={exportar} disabled={!linhas.length}>
            <Download className="size-4" />
            Exportar CSV
          </Button>
          <Button
            disabled={!selecionadosLista.length || repassar.isPending}
            onClick={() => repassar.mutate(selecionadosLista, { onSuccess: () => setSelecionados(new Set()) })}
          >
            <Handshake className="size-4" />
            Repassar {selecionadosLista.length || ''} ao comercial
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          className="w-56"
          value={filtros.turma ?? ''}
          onValueChange={(v) => navigate({ search: (s) => ({ ...s, turma: v || undefined }), replace: true })}
        >
          <option value="">Todas as turmas</option>
          {turmas.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={!!filtros.todos}
            onChange={(e) => navigate({ search: (s) => ({ ...s, todos: e.target.checked || undefined }), replace: true })}
          />
          Incluir inativos, assinantes e quem recusou
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos"
                  checked={!!elegiveis.length && elegiveis.every(({ p }) => selecionados.has(p.id))}
                  onChange={(e) => setSelecionados(e.target.checked ? new Set(elegiveis.map(({ p }) => p.id)) : new Set())}
                />
              </th>
              <Th dica={DICA_COLUNA.posicao} className="px-3">
                #
              </Th>
              <Th dica={DICA_COLUNA.nome} className="px-3">
                Nome
              </Th>
              <Th dica={DICA_COLUNA.turma} className="px-3">
                Turma
              </Th>
              <Th dica={DICA_COLUNA.pontuacao} className="px-3 text-right">
                Pontuação
              </Th>
              <Th dica={DICA_COLUNA.implementou} className="px-3">
                Implementou
              </Th>
              <Th dica={DICA_COLUNA.presencas} className="px-3 text-right">
                Presenças
              </Th>
              <Th dica={DICA_COLUNA.ultimaResposta} className="px-3">
                Última resposta
              </Th>
              <Th dica={DICA_COLUNA.weevoStart} className="px-3">
                Weevo Start
              </Th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {linhas.map(({ p, eng }, i) => {
              const elegivel = p.weevo_start === 'nao_avaliado' || p.weevo_start === 'candidato'
              return (
                <tr key={p.id} className="hover:bg-muted/50">
                  <td className="px-3 py-2.5">
                    {elegivel && (
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${p.nome}`}
                        checked={selecionados.has(p.id)}
                        onChange={(e) => alternar(p.id, e.target.checked)}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <Link to="/participantes/$id" params={{ id: p.id }} className="font-medium hover:text-primary hover:underline">
                      {p.nome}
                    </Link>
                    {p.empresa && <div className="text-xs text-muted-foreground">{p.empresa}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{p.turma_id ? turmaPorId.get(p.turma_id) : '—'}</td>
                  <td className="px-3 py-2.5 text-right">
                    <PontuacaoBadge pontuacao={eng?.pontuacao} />
                  </td>
                  <td className="px-3 py-2.5">{p.implementou ? <Check className="size-4 text-emerald-600" aria-label="Sim" /> : <span className="text-muted-foreground/50">—</span>}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{eng?.pontuacao.detalhe.presencas ?? 0}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{haQuanto(p.ultima_resposta_em)}</td>
                  <td className="px-3 py-2.5">
                    <WeevoStartBadge valor={p.weevo_start} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {elegivel && (
                      <Dica texto="Marca a Weevo Start como “Repassado ao comercial” e registra o repasse na linha do tempo. Não altera a pontuação." lado="left">
                        <Button
                          variante="secundario"
                          className="px-2 py-1 text-xs whitespace-nowrap"
                          disabled={repassar.isPending}
                          onClick={() => repassar.mutate([p])}
                        >
                          Repassar
                        </Button>
                      </Dica>
                    )}
                  </td>
                </tr>
              )
            })}
            {!carregando && linhas.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  Ninguém no ranking com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
