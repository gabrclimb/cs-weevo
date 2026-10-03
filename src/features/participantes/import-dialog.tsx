import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, FileUp } from 'lucide-react'
import { Button, Dialog, Input, Select } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { formatarTelefone } from '@/lib/telefone'
import { cn, mensagemErro } from '@/lib/utils'
import { normalize } from '@/lib/csv'
import { chaves } from '@/lib/chaves'
import {
  CAMPOS,
  CAMPOS_UNICOS,
  detectarCabecalho,
  lerTabela,
  previaImportParticipantes,
  sugerirMapeamento,
  sugerirTurma,
  validarMapeamento,
  chaveNomeTurma,
  type Campo,
  type LinhaParticipante,
  type Mapeamento,
} from './import'

const GRUPOS_CAMPOS: [string, Campo[]][] = [
  ['Participante', ['nome', 'apelido', 'telefone', 'empresa', 'turma']],
  ['Acompanhamento', ['responsavel', 'dia_escolhido', 'cadastro_plataforma', 'sistema', 'dificuldades', 'suporte_extra', 'nps', 'observacoes']],
  ['Plantões ("Veio" vira presença)', ['encontro_1', 'encontro_2', 'encontro_3', 'encontro_4']],
]

type Passo = 'arquivo' | 'mapear' | 'revisar'

type Arquivo = {
  nome: string
  tabela: string[][]
  telefones: string[]
  turmas: string[]
  nomesPorTurma: string[]
}

export function ImportParticipantesDialog({
  aberto,
  onAbertoChange,
}: {
  aberto: boolean
  onAbertoChange: (aberto: boolean) => void
}) {
  const qc = useQueryClient()
  const [passo, setPasso] = useState<Passo>('arquivo')
  const [arquivo, setArquivo] = useState<Arquivo | null>(null)
  const [linhaCabecalho, setLinhaCabecalho] = useState(0)
  const [mapeamento, setMapeamento] = useState<Mapeamento>([])
  const [turmaFixa, setTurmaFixa] = useState('')
  const [confirmaTurmas, setConfirmaTurmas] = useState(false)
  const [processando, setProcessando] = useState(false)

  function fechar(a: boolean) {
    if (!a) {
      setPasso('arquivo')
      setArquivo(null)
      setMapeamento([])
      setTurmaFixa('')
      setConfirmaTurmas(false)
    }
    onAbertoChange(a)
  }

  async function lerArquivo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setProcessando(true)
    try {
      const [conteudo, participantes, turmas] = await Promise.all([
        file.text(),
        supabase.from('weevo_participantes').select('nome, telefone, turma_id'),
        supabase.from('weevo_turmas').select('id, nome'),
      ])
      if (participantes.error) throw participantes.error
      if (turmas.error) throw turmas.error
      const tabela = lerTabela(conteudo)
      if (!tabela.length) {
        toast.error('O arquivo está vazio.')
        return
      }
      const cab = detectarCabecalho(tabela)
      const nomeTurma = new Map(turmas.data.map((t) => [t.id, t.nome]))
      setArquivo({
        nome: file.name,
        tabela,
        telefones: participantes.data.flatMap((p) => (p.telefone ? [p.telefone] : [])),
        turmas: turmas.data.map((t) => t.nome),
        nomesPorTurma: participantes.data.map((p) => chaveNomeTurma(p.nome, p.turma_id ? (nomeTurma.get(p.turma_id) ?? null) : null)),
      })
      setLinhaCabecalho(cab)
      setMapeamento(sugerirMapeamento(tabela[cab]))
      setTurmaFixa(sugerirTurma(tabela, cab) ?? '')
      setPasso('mapear')
    } catch (erro) {
      toast.error(mensagemErro(erro as { message?: string }))
    } finally {
      setProcessando(false)
      e.target.value = ''
    }
  }

  function trocarCabecalho(i: number) {
    if (!arquivo) return
    setLinhaCabecalho(i)
    setMapeamento(sugerirMapeamento(arquivo.tabela[i]))
    setTurmaFixa(sugerirTurma(arquivo.tabela, i) ?? '')
  }

  function mapear(coluna: number, campo: Campo | null) {
    setMapeamento((m) => {
      // Campo único escolhido em outra coluna sai de lá (evita duas colunas para "Nome", por exemplo).
      const novo = m.map((c) => (campo && CAMPOS_UNICOS.includes(campo) && c === campo ? null : c))
      novo[coluna] = campo
      return novo
    })
  }

  const cabecalho = arquivo?.tabela[linhaCabecalho] ?? []
  const amostras = useMemo(() => {
    if (!arquivo) return []
    const dados = arquivo.tabela.slice(linhaCabecalho + 1).filter((l) => l.some(Boolean))
    return cabecalho.map((_, ci) => [...new Set(dados.map((l) => l[ci]).filter(Boolean))].slice(0, 3))
  }, [arquivo, linhaCabecalho, cabecalho])

  const errosMapeamento = validarMapeamento(mapeamento)
  const temColunaTurma = mapeamento.includes('turma')

  const previa = useMemo(
    () =>
      arquivo && passo === 'revisar'
        ? previaImportParticipantes(
            arquivo.tabela,
            linhaCabecalho,
            mapeamento,
            { telefones: arquivo.telefones, turmas: arquivo.turmas, nomesPorTurma: arquivo.nomesPorTurma },
            turmaFixa.trim() || null,
          )
        : null,
    [arquivo, passo, linhaCabecalho, mapeamento, turmaFixa],
  )

  async function importar() {
    if (!previa) return
    setProcessando(true)
    try {
      if (previa.turmasNovas.length) {
        const { error } = await supabase.from('weevo_turmas').insert(previa.turmasNovas.map((nome) => ({ nome })))
        if (error) throw error
      }
      const { data: turmas, error: erroTurmas } = await supabase.from('weevo_turmas').select('id, nome')
      if (erroTurmas) throw erroTurmas
      const idPorTurma = new Map(turmas.map((t) => [normalize(t.nome), t.id]))

      const turmaIdDe = (turma: string | null) => (turma ? (idPorTurma.get(normalize(turma)) ?? null) : null)

      const { data: inseridos, error } = await supabase
        .from('weevo_participantes')
        .insert(previa.novos.map((n) => ({ nome: n.nome, telefone: n.telefone, turma_id: turmaIdDe(n.turma), ...n.dados })))
        .select('id, nome')
      if (error) throw error

      const presencas = await registrarPresencas(previa.novos, inseridos, turmaIdDe)

      toast.success(
        `${previa.novos.length} participante(s) importado(s)` + (presencas ? ` e ${presencas} presença(s) registrada(s).` : '.'),
      )
      qc.invalidateQueries({ queryKey: chaves.participantes })
      qc.invalidateQueries({ queryKey: chaves.turmas })
      qc.invalidateQueries({ queryKey: chaves.plantoes })
      qc.invalidateQueries({ queryKey: chaves.eventos })
      fechar(false)
    } catch (erro) {
      toast.error(mensagemErro(erro as { message?: string }))
    } finally {
      setProcessando(false)
    }
  }

  const podeImportar =
    !!previa && previa.novos.length > 0 && (previa.turmasNovas.length === 0 || confirmaTurmas) && !processando

  return (
    <Dialog
      aberto={aberto}
      onAbertoChange={fechar}
      titulo="Importar participantes"
      descricao={
        passo === 'arquivo'
          ? 'Escolha um arquivo CSV. No próximo passo você diz para onde vai cada coluna.'
          : passo === 'mapear'
            ? 'Para cada coluna do arquivo, escolha o campo do sistema ou "Não importar".'
            : 'Confira antes de importar.'
      }
      largura="max-w-3xl"
    >
      <Passos atual={passo} />

      {passo === 'arquivo' && (
        <label className="mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-input px-4 py-10 text-sm text-muted-foreground hover:border-primary">
          <FileUp className="size-6 text-primary" />
          <span>{processando ? 'Lendo…' : 'Escolher arquivo .csv'}</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={lerArquivo} disabled={processando} />
        </label>
      )}

      {passo === 'mapear' && arquivo && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{arquivo.nome}</span>
            <span className="text-muted-foreground/70">·</span>
            <label className="flex items-center gap-2 text-muted-foreground">
              Cabeçalho na linha
              <Select
                className="w-auto py-1"
                value={linhaCabecalho}
                onValueChange={(v) => trocarCabecalho(Number(v))}
              >
                {arquivo.tabela.slice(0, 10).map((l, i) => (
                  <option key={i} value={i}>
                    {i + 1}: {l.filter(Boolean).slice(0, 3).join(', ').slice(0, 50) || '(vazia)'}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2 font-medium">Coluna do arquivo</th>
                  <th className="px-3 py-2 font-medium">Exemplos</th>
                  <th className="w-60 px-3 py-2 font-medium">Vai para</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {cabecalho.map((titulo, ci) => (
                  <tr key={ci} className={cn(!mapeamento[ci] && 'bg-muted/30 text-muted-foreground')}>
                    <td className="px-3 py-2 font-medium">{titulo || <span className="text-muted-foreground/70">Coluna {ci + 1}</span>}</td>
                    <td className="max-w-64 px-3 py-2 text-xs text-muted-foreground">
                      <span className="line-clamp-2">{amostras[ci]?.join(' · ') || '(vazia)'}</span>
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        className="py-1"
                        value={mapeamento[ci] ?? ''}
                        onValueChange={(v) => mapear(ci, (v || null) as Campo | null)}
                      >
                        <option value="">Não importar</option>
                        {GRUPOS_CAMPOS.map(([grupo, campos]) => (
                          <optgroup key={grupo} label={grupo}>
                            {campos.map((c) => (
                              <option key={c} value={c}>
                                {CAMPOS[c]}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {temColunaTurma ? 'Turma para quem estiver sem turma no arquivo:' : 'Turma de todos os participantes do arquivo:'}
            <Input
              className="w-48 py-1"
              list="turmas-existentes"
              value={turmaFixa}
              onChange={(e) => setTurmaFixa(e.target.value)}
              placeholder="Ex.: Setembro"
            />
            <datalist id="turmas-existentes">
              {arquivo.turmas.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>
          <p className="text-xs text-muted-foreground">
            Várias colunas podem ir para "Observações": o conteúdo entra como "Coluna: valor".
          </p>

          {errosMapeamento.length > 0 && (
            <ul className="space-y-0.5 text-sm text-rose-700">
              {errosMapeamento.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}

          <div className="flex justify-between gap-2">
            <Button variante="secundario" onClick={() => setPasso('arquivo')}>
              <ArrowLeft className="size-4" />
              Trocar arquivo
            </Button>
            <Button onClick={() => setPasso('revisar')} disabled={errosMapeamento.length > 0}>
              Revisar
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {passo === 'revisar' && previa && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Contador label="Linhas" valor={previa.total} />
            <Contador label="Novos" valor={previa.novos.length} classe="text-emerald-700" />
            <Contador label="Duplicados" valor={previa.duplicados.length} classe="text-amber-700" />
            <Contador label="Inválidas" valor={previa.invalidas.length} classe="text-rose-700" />
          </div>

          {previa.turmasNovas.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="font-medium text-amber-900">
                {previa.turmasNovas.length === 1 ? 'Uma turma nova será criada:' : 'Turmas novas serão criadas:'}
              </p>
              <p className="mt-1 text-amber-900">{previa.turmasNovas.join(', ')}</p>
              <label className="mt-2 flex items-center gap-2 text-amber-900">
                <input type="checkbox" checked={confirmaTurmas} onChange={(e) => setConfirmaTurmas(e.target.checked)} />
                Confirmo a criação
              </label>
            </div>
          )}

          {previa.plantoesMapeados.length > 0 && (
            <p className="text-sm text-muted-foreground">
              "Veio" nas colunas de plantão vira presença. Plantões que ainda não existem na turma são criados e marcados
              como realizados; a data pode ser preenchida depois na página da turma.
            </p>
          )}
          {previa.presencasSemTurma > 0 && (
            <p className="text-sm text-amber-700">
              {previa.presencasSemTurma} presença(s) não serão registradas porque o participante ficou sem turma.
            </p>
          )}

          {previa.novos.length > 0 && (
            <div className="max-h-64 overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 border-b bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Nome</th>
                    <th className="px-3 py-2 font-medium">Telefone</th>
                    <th className="px-3 py-2 font-medium">Turma</th>
                    <th className="px-3 py-2 font-medium">Responsável</th>
                    <th className="px-3 py-2 font-medium">Presenças</th>
                    <th className="px-3 py-2 font-medium">Sistema</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {previa.novos.map((n) => (
                    <tr key={n.linha}>
                      <td className="px-3 py-1.5 font-medium">{n.nome}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{formatarTelefone(n.telefone) || '—'}</td>
                      <td className="px-3 py-1.5">{n.turma ?? '—'}</td>
                      <td className="px-3 py-1.5">{n.dados.responsavel}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        {n.presencas.length ? n.presencas.map((x) => `P${x}`).join(', ') : '—'}
                      </td>
                      <td className="max-w-48 truncate px-3 py-1.5" title={n.dados.sistema ?? ''}>
                        {n.dados.sistema}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {previa.invalidas.length > 0 && (
            <Lista titulo={`Linhas inválidas (${previa.invalidas.length}, serão ignoradas)`}>
              {previa.invalidas.map((i) => (
                <li key={i.linha}>
                  Linha {i.linha}: {i.motivo}
                </li>
              ))}
            </Lista>
          )}

          {previa.duplicados.length > 0 && (
            <Lista titulo={`Duplicados (${previa.duplicados.length}, serão ignorados)`}>
              {previa.duplicados.map((d) => (
                <li key={d.linha}>
                  Linha {d.linha}: {d.nome} ({d.motivo})
                </li>
              ))}
            </Lista>
          )}

          <div className="flex justify-between gap-2">
            <Button variante="secundario" onClick={() => setPasso('mapear')}>
              <ArrowLeft className="size-4" />
              Ajustar colunas
            </Button>
            <Button onClick={importar} disabled={!podeImportar}>
              {processando ? 'Importando…' : `Importar ${previa.novos.length}`}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}

function Passos({ atual }: { atual: Passo }) {
  const passos: [Passo, string][] = [
    ['arquivo', 'Arquivo'],
    ['mapear', 'Colunas'],
    ['revisar', 'Revisão'],
  ]
  const idx = passos.findIndex(([p]) => p === atual)
  return (
    <ol className="flex gap-2 text-xs">
      {passos.map(([p, label], i) => (
        <li
          key={p}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-2.5 py-1',
            i === idx ? 'bg-primary text-primary-foreground' : i < idx ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
          )}
        >
          <span className="font-semibold">{i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  )
}

function Contador({ label, valor, classe }: { label: string; valor: number; classe?: string }) {
  return (
    <div className="rounded-lg border bg-muted/50 px-3 py-2">
      <div className={cn('text-xl font-semibold', classe)}>{valor}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function Lista({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <details className="rounded-lg border text-sm">
      <summary className="cursor-pointer px-3 py-2 font-medium">{titulo}</summary>
      <ul className="max-h-48 space-y-0.5 overflow-y-auto px-3 pb-3 text-muted-foreground">{children}</ul>
    </details>
  )
}

/**
 * Cria as presenças do import. Garante que os plantões existam (marcados como realizados)
 * e registra um evento plantao_presenca por participante e plantão.
 */
async function registrarPresencas(
  novos: LinhaParticipante[],
  inseridos: { id: string; nome: string }[],
  turmaIdDe: (turma: string | null) => string | null,
): Promise<number> {
  // O insert em lote devolve as linhas na mesma ordem; confere pelo nome por segurança.
  const pares = novos.flatMap((n, i) => {
    const turmaId = turmaIdDe(n.turma)
    const inserido = inseridos[i]
    if (!n.presencas.length || !turmaId || !inserido || inserido.nome !== n.nome) return []
    return n.presencas.map((numero) => ({ participanteId: inserido.id, turmaId, numero }))
  })
  if (!pares.length) return 0

  const necessarios = [...new Set(pares.map((p) => `${p.turmaId}|${p.numero}`))].map((k) => {
    const [turma_id, numero] = k.split('|')
    return { turma_id, numero: Number(numero), realizado: true }
  })
  const { data: plantoes, error } = await supabase
    .from('weevo_plantoes')
    .upsert(necessarios, { onConflict: 'turma_id,numero' })
    .select('id, turma_id, numero, data, horario')
  if (error) throw error

  const plantaoDe = new Map(plantoes.map((p) => [`${p.turma_id}|${p.numero}`, p]))
  const eventos = pares.flatMap(({ participanteId, turmaId, numero }) => {
    const pl = plantaoDe.get(`${turmaId}|${numero}`)
    if (!pl) return []
    return [
      {
        participante_id: participanteId,
        plantao_id: pl.id,
        tipo: 'plantao_presenca' as const,
        origem: 'import' as const,
        ocorrido_em: pl.data ? new Date(`${pl.data}T${pl.horario ?? '12:00'}`).toISOString() : new Date().toISOString(),
      },
    ]
  })
  const { error: erroEventos } = await supabase.from('weevo_eventos').insert(eventos)
  if (erroEventos) throw erroEventos
  return eventos.length
}
