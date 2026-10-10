import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChevronDown, ChevronRight, FileUp, Handshake, ListChecks, Pencil, Plus, Search, X } from 'lucide-react'
import { Button, Input, MenuAcoes, Select } from '@/components/ui'
import { podeRepassar, useRepassar } from '@/features/pontuacao/repassar'
import { Th } from '@/components/dica'
import { BotaoFiltros, CampoFiltro } from '@/components/filtros'
import { useDicas } from '@/lib/dicas'
import { EdicaoMassaDialog } from '@/features/participantes/edicao-massa-dialog'
import { DICA_COLUNA } from '@/lib/textos-dicas'
import { StatusBadge, WeevoStartBadge } from '@/features/participantes/badges'
import type { ParticipanteStatus, WeevoStart } from '@/lib/tipos'
import { normalize } from '@/lib/csv'
import { formatarTelefone } from '@/lib/telefone'
import { cn, haQuanto } from '@/lib/utils'
import {
  STATUS_KEYS,
  STATUS_PARTICIPANTE,
  WEEVO_START,
  WEEVO_START_KEYS,
  apelidoDistinto,
} from '@/features/participantes/constantes'
import { ImportParticipantesDialog } from '@/features/participantes/import-dialog'
import { ParticipanteForm } from '@/features/participantes/participante-form'
import { useParticipantes, useTurmas } from '@/features/participantes/queries'
import { AlertasBadges, PontuacaoBadge, useEngajamento } from '@/features/engajamento'
import { ENTRADA_VISAO, VisaoToggle, lerVisao, type Visao } from '@/components/kanban'
import { AGRUPAMENTOS, agrupar, lerAgrupamento, type Agrupamento } from '@/features/participantes/agrupamentos'
import { SeletorAgrupar } from '@/components/agrupar-por'
import { AgruparPor, ParticipantesKanban } from '@/features/participantes/participantes-kanban'
import { CABECALHO_TABELA, Paginacao, RODAPE_TABELA, usePaginacao } from '@/components/paginacao'

type FiltroAlerta = 'qualquer' | 'sem_contato' | 'sem_resposta'

type Filtros = {
  q?: string
  turma?: string
  status?: ParticipanteStatus
  ws?: WeevoStart
  alerta?: FiltroAlerta
  resp?: string
  visao?: Visao
  agrupar?: Agrupamento
}

export const Route = createFileRoute('/cs/participantes/')({
  validateSearch: (s: Record<string, unknown>): Filtros => ({
    q: typeof s.q === 'string' && s.q ? s.q : undefined,
    turma: typeof s.turma === 'string' && s.turma ? s.turma : undefined,
    status: STATUS_KEYS.includes(s.status as ParticipanteStatus) ? (s.status as ParticipanteStatus) : undefined,
    ws: WEEVO_START_KEYS.includes(s.ws as WeevoStart) ? (s.ws as WeevoStart) : undefined,
    // `true` vem de links antigos, quando o filtro era só "com alerta".
    alerta:
      s.alerta === true || s.alerta === 'true' || s.alerta === 'qualquer'
        ? 'qualquer'
        : s.alerta === 'sem_contato' || s.alerta === 'sem_resposta'
          ? s.alerta
          : undefined,
    resp: typeof s.resp === 'string' && s.resp ? s.resp : undefined,
    visao: lerVisao(s.visao),
    agrupar: lerAgrupamento(s.agrupar),
  }),
  component: ParticipantesPage,
})

function ParticipantesPage() {
  const filtros = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const participantes = useParticipantes()
  const turmas = useTurmas()
  const { porParticipante } = useEngajamento()
  const [novoAberto, setNovoAberto] = useState(false)
  const [importAberto, setImportAberto] = useState(false)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [massaAberta, setMassaAberta] = useState(false)
  const repassar = useRepassar()
  const { ativas: dicasAtivas } = useDicas()

  const nomeTurma = useMemo(() => new Map(turmas.data?.map((t) => [t.id, t.nome])), [turmas.data])

  const filtrados = useMemo(() => {
    const busca = normalize(filtros.q)
    const buscaDigitos = (filtros.q ?? '').replace(/\D/g, '')
    return (participantes.data ?? []).filter((p) => {
      if (filtros.turma === 'sem' ? p.turma_id : filtros.turma && p.turma_id !== filtros.turma) return false
      if (filtros.status && p.status !== filtros.status) return false
      if (filtros.ws && p.weevo_start !== filtros.ws) return false
      if (filtros.alerta) {
        const alertas = porParticipante.get(p.id)?.alertas ?? []
        if (filtros.alerta === 'qualquer' ? !alertas.length : !alertas.some((a) => a.tipo === filtros.alerta)) return false
      }
      if (filtros.resp && (filtros.resp === 'sem' ? p.responsavel : p.responsavel !== filtros.resp)) return false
      if (busca) {
        const texto = normalize(`${p.nome} ${p.apelido ?? ''} ${p.empresa ?? ''}`)
        const casaTelefone = buscaDigitos.length >= 4 && (p.telefone ?? '').includes(buscaDigitos)
        if (!texto.includes(busca) && !casaTelefone) return false
      }
      return true
    })
  }, [participantes.data, filtros, porParticipante])

  // Na tabela o agrupamento é opcional: sem `agrupar` na URL, a lista segue sem grupos.
  const agrupamentoTabela = filtros.visao === 'tabela' ? filtros.agrupar : undefined
  const grupos = useMemo(
    () =>
      agrupamentoTabela
        ? agrupar(agrupamentoTabela, participantes.data ?? [], turmas.data ?? [], (p) => porParticipante.get(p.id)?.pontuacao.total ?? 0)
        : undefined,
    [agrupamentoTabela, participantes.data, turmas.data, porParticipante],
  )
  // Com grupos, quem é do mesmo grupo fica junto (inclusive entre páginas); dentro do grupo a ordem é mantida.
  const ordenados = useMemo(() => {
    if (!grupos) return filtrados
    const posicao = new Map(grupos.colunas.map((c, i) => [c.chave, i]))
    return [...filtrados].sort((a, b) => (posicao.get(grupos.colunaDe(a)) ?? 0) - (posicao.get(grupos.colunaDe(b)) ?? 0))
  }, [filtrados, grupos])
  const totalPorGrupo = useMemo(() => {
    const total = new Map<string, number>()
    if (grupos) for (const p of filtrados) total.set(grupos.colunaDe(p), (total.get(grupos.colunaDe(p)) ?? 0) + 1)
    return total
  }, [filtrados, grupos])
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set())

  const { itensPagina, controles } = usePaginacao(ordenados, { ...filtros, visao: undefined, agrupar: undefined })

  // Só conta quem está selecionado e continua visível com os filtros atuais.
  const selecionadosLista = filtrados.filter((p) => selecionados.has(p.id))
  const repassaveis = selecionadosLista.filter(podeRepassar)
  const paginaToda = itensPagina.length > 0 && itensPagina.every((p) => selecionados.has(p.id))
  const paginaParcial = !paginaToda && itensPagina.some((p) => selecionados.has(p.id))

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

  const setFiltro = (mudanca: Partial<Filtros>) =>
    navigate({ search: (atual) => ({ ...atual, ...mudanca }), replace: true })

  const temFiltro = !!(filtros.q || filtros.turma || filtros.status || filtros.ws || filtros.alerta || filtros.resp)
  const filtrosAtivos = [filtros.turma, filtros.resp, filtros.status, filtros.ws, filtros.alerta].filter(Boolean).length
  // Participantes abre em kanban; a tabela fica guardada na URL como visao=tabela.
  const visao = filtros.visao ?? 'kanban'
  const agrupamento = filtros.agrupar ?? 'status'
  const responsaveis = [...new Set((participantes.data ?? []).flatMap((p) => (p.responsavel ? [p.responsavel] : [])))].sort()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Participantes</h1>
        <p className="text-sm text-muted-foreground">
          {participantes.data ? `${filtrados.length} de ${participantes.data.length} participante(s)` : 'Carregando…'}
        </p>
      </div>

      {/* Tudo numa linha: visão, busca, filtros e ações. A busca é o campo que encolhe; se faltar espaço, a linha quebra. */}
      <div className="flex flex-wrap items-center gap-2">
        <VisaoToggle valor={visao} onChange={(v) => setFiltro({ visao: v === 'kanban' ? undefined : v })} />
        {visao === 'kanban' ? (
          <AgruparPor valor={agrupamento} onChange={(a) => setFiltro({ agrupar: a === 'status' ? undefined : a })} />
        ) : (
          <SeletorAgrupar
            valor={agrupamentoTabela}
            onChange={(a) => setFiltro({ agrupar: a })}
            opcoes={AGRUPAMENTOS}
            ocultar={['faixa']}
            semAgrupar
          />
        )}
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            className="pl-9"
            placeholder="Buscar participante"
            title="Busca por nome, apelido, empresa ou telefone"
            defaultValue={filtros.q ?? ''}
            onChange={(e) => setFiltro({ q: e.target.value || undefined })}
          />
        </div>
        <BotaoFiltros
          ativos={filtrosAtivos}
          onLimpar={() =>
            setFiltro({ turma: undefined, resp: undefined, status: undefined, ws: undefined, alerta: undefined })
          }
        >
          <CampoFiltro label="Turma">
            <Select value={filtros.turma ?? ''} onValueChange={(v) => setFiltro({ turma: v || undefined })}>
              <option value="">Todas as turmas</option>
              <option value="sem">Sem turma</option>
              {turmas.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </Select>
          </CampoFiltro>
          <CampoFiltro label="Responsável">
            <Select value={filtros.resp ?? ''} onValueChange={(v) => setFiltro({ resp: v || undefined })}>
              <option value="">Todos os responsáveis</option>
              <option value="sem">Sem responsável</option>
              {responsaveis.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </CampoFiltro>
          <CampoFiltro label="Status">
            <Select
              value={filtros.status ?? ''}
              onValueChange={(v) => setFiltro({ status: (v || undefined) as ParticipanteStatus | undefined })}
            >
              <option value="">Todos os status</option>
              {STATUS_KEYS.map((k) => (
                <option key={k} value={k}>
                  {STATUS_PARTICIPANTE[k].label}
                </option>
              ))}
            </Select>
          </CampoFiltro>
          <CampoFiltro label="Weevo Start">
            <Select
              value={filtros.ws ?? ''}
              onValueChange={(v) => setFiltro({ ws: (v || undefined) as WeevoStart | undefined })}
            >
              <option value="">Todas as etapas</option>
              {WEEVO_START_KEYS.map((k) => (
                <option key={k} value={k}>
                  {WEEVO_START[k].label}
                </option>
              ))}
            </Select>
          </CampoFiltro>
          <CampoFiltro label="Alertas">
            <Select
              value={filtros.alerta ?? ''}
              onValueChange={(v) => setFiltro({ alerta: (v || undefined) as FiltroAlerta | undefined })}
            >
              <option value="">Com ou sem alerta</option>
              <option value="qualquer">Com qualquer alerta</option>
              <option value="sem_contato">Sem contato</option>
              <option value="sem_resposta">Sem resposta</option>
            </Select>
          </CampoFiltro>
        </BotaoFiltros>
        <Button variante="secundario" onClick={() => setImportAberto(true)}>
          <FileUp className="size-4" />
          Importar CSV
        </Button>
        <Button onClick={() => setNovoAberto(true)}>
          <Plus className="size-4" />
          Novo participante
        </Button>
      </div>

      {participantes.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          Não foi possível carregar os participantes. Tente novamente.
        </div>
      ) : visao === 'kanban' ? (
        <ParticipantesKanban
          participantes={filtrados}
          turmas={turmas.data ?? []}
          agrupamento={agrupamento}
          porParticipante={porParticipante}
          carregando={participantes.isLoading}
        />
      ) : (
        <>
          {selecionadosLista.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
              <span className="font-medium">{selecionadosLista.length} selecionado(s)</span>
              {selecionadosLista.length < filtrados.length && (
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => marcar(filtrados.map((p) => p.id), true)}
                >
                  Selecionar todos os {filtrados.length}
                  {temFiltro ? ' filtrados' : ''}
                </button>
              )}
              <div className="ml-auto">
                <MenuAcoes
                  rotulo={`Ações (${selecionadosLista.length})`}
                  icone={ListChecks}
                  acoes={[
                    {
                      label: 'Alterar informações…',
                      icone: Pencil,
                      descricao: 'Status, Weevo Start, turma ou responsável',
                      onSelect: () => setMassaAberta(true),
                    },
                    {
                      label: 'Repassar ao comercial',
                      icone: Handshake,
                      descricao: repassaveis.length
                        ? repassaveis.length === selecionadosLista.length
                          ? `${repassaveis.length} participante(s)`
                          : `${repassaveis.length} de ${selecionadosLista.length}: só quem está “Não avaliado” ou “Candidato”`
                        : 'Nenhum selecionado pode ser repassado (só “Não avaliado” ou “Candidato”)',
                      disabled: !repassaveis.length || repassar.isPending,
                      onSelect: () => repassar.mutate(repassaveis, { onSuccess: () => setSelecionados(new Set()) }),
                    },
                    'separador',
                    { label: 'Limpar seleção', icone: X, onSelect: () => setSelecionados(new Set()) },
                  ]}
                />
              </div>
            </div>
          ) : (
            dicasAtivas &&
            filtrados.length > 1 && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ListChecks className="size-3.5 shrink-0" aria-hidden="true" />
                Marque vários participantes na primeira coluna para alterar informações ou repassar ao comercial de uma
                vez, pelo botão Ações. Dica: filtre antes e use “Selecionar todos”.
              </p>
            )
          )}
          <div className={cn('overflow-hidden rounded-lg border bg-card', ENTRADA_VISAO)}>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={cn('border-b', CABECALHO_TABELA)}>
                <tr>
                  <th className="w-10 px-4 py-3">
                    <CaixaSelecao
                      aria-label="Selecionar todos desta página"
                      checked={paginaToda}
                      indeterminate={paginaParcial}
                      onChange={(marcado) => marcar(itensPagina.map((p) => p.id), marcado)}
                    />
                  </th>
                  <Th dica={DICA_COLUNA.nome}>Nome</Th>
                  <Th dica={DICA_COLUNA.turma}>Turma</Th>
                  <Th dica={DICA_COLUNA.responsavel}>Responsável</Th>
                  <Th dica={DICA_COLUNA.status}>Status</Th>
                  <Th dica={DICA_COLUNA.weevoStart}>Weevo Start</Th>
                  <Th dica={DICA_COLUNA.ultimoContato}>Último contato</Th>
                  <Th dica={DICA_COLUNA.ultimaResposta}>Última resposta</Th>
                  <Th dica={DICA_COLUNA.alertas}>Alertas</Th>
                  <Th dica={DICA_COLUNA.pontuacao} className="text-right">
                    Pontuação
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {itensPagina.map((p, i) => {
                  const chaveGrupo = grupos?.colunaDe(p)
                  const abreGrupo = !!grupos && (i === 0 || grupos.colunaDe(itensPagina[i - 1]) !== chaveGrupo)
                  const coluna = abreGrupo ? grupos.colunas.find((c) => c.chave === chaveGrupo) : undefined
                  const recolhido = chaveGrupo !== undefined && recolhidos.has(chaveGrupo)
                  return (
                  <Fragment key={p.id}>
                  {coluna && chaveGrupo !== undefined && (
                    <tr className="bg-muted/40">
                      <td className="px-4 py-2">
                        <CaixaSelecao
                          aria-label={`Selecionar todos de ${coluna.titulo}`}
                          checked={filtrados.filter((x) => grupos!.colunaDe(x) === chaveGrupo).every((x) => selecionados.has(x.id))}
                          onChange={(marcado) =>
                            marcar(filtrados.filter((x) => grupos!.colunaDe(x) === chaveGrupo).map((x) => x.id), marcado)
                          }
                        />
                      </td>
                      <td colSpan={9} className="px-4 py-2">
                        <button
                          type="button"
                          aria-expanded={!recolhido}
                          className="flex items-center gap-2 text-sm font-semibold"
                          onClick={() =>
                            setRecolhidos((atual) => {
                              const novo = new Set(atual)
                              if (novo.has(chaveGrupo)) novo.delete(chaveGrupo)
                              else novo.add(chaveGrupo)
                              return novo
                            })
                          }
                        >
                          {recolhido ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                          <span className={`size-2 rounded-full ${coluna.ponto ?? 'bg-muted-foreground'}`} />
                          {coluna.titulo}
                          <span className="font-normal text-muted-foreground">{totalPorGrupo.get(chaveGrupo) ?? 0}</span>
                        </button>
                      </td>
                    </tr>
                  )}
                  {!recolhido && (
                  <tr className={selecionados.has(p.id) ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50'}>
                    <td className="px-4 py-3">
                      <CaixaSelecao
                        aria-label={`Selecionar ${p.nome}`}
                        checked={selecionados.has(p.id)}
                        onChange={(marcado) => marcar([p.id], marcado)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to="/cs/participantes/$id"
                        params={{ id: p.id }}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {p.nome}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {[apelidoDistinto(p) && `"${apelidoDistinto(p)}"`, formatarTelefone(p.telefone), p.empresa]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {p.turma_id ? nomeTurma.get(p.turma_id) : <span className="text-muted-foreground/70">—</span>}
                    </td>
                    <td className="px-4 py-3 text-foreground">{p.responsavel ?? <span className="text-muted-foreground/70">—</span>}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3">
                      <WeevoStartBadge valor={p.weevo_start} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{haQuanto(p.ultimo_contato_em)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{haQuanto(p.ultima_resposta_em)}</td>
                    <td className="px-4 py-3">
                      <AlertasBadges alertas={porParticipante.get(p.id)?.alertas ?? []} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PontuacaoBadge pontuacao={porParticipante.get(p.id)?.pontuacao} />
                    </td>
                  </tr>
                  )}
                  </Fragment>
                  )
                })}
                {participantes.data && filtrados.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                      {participantes.data.length === 0
                        ? 'Nenhum participante cadastrado. Cadastre manualmente ou importe um CSV.'
                        : 'Nenhum participante com esses filtros.'}
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

      <ParticipanteForm
        aberto={novoAberto}
        onAbertoChange={setNovoAberto}
        onSalvo={(p) => navigate({ to: '/cs/participantes/$id', params: { id: p.id } })}
      />
      <ImportParticipantesDialog aberto={importAberto} onAbertoChange={setImportAberto} />
      <EdicaoMassaDialog
        aberto={massaAberta}
        onAbertoChange={setMassaAberta}
        participantes={selecionadosLista}
        turmas={turmas.data ?? []}
        responsaveis={responsaveis}
        onConcluido={() => setSelecionados(new Set())}
      />
    </div>
  )
}

/** Checkbox com estado "parcial" (alguns da página marcados). */
function CaixaSelecao({
  checked,
  indeterminate = false,
  onChange,
  'aria-label': ariaLabel,
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: (marcado: boolean) => void
  'aria-label': string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={ariaLabel}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="size-4 cursor-pointer accent-primary"
    />
  )
}
