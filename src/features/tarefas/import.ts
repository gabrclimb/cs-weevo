import { normalize, parseCsv } from '@/lib/csv'
import { parseWeevoDatas } from '@/lib/datas'
import type { TarefaRow } from '@/lib/tipos'
import { STATUS_TAREFA, STATUS_TAREFA_KEYS, TIPO_TAREFA, TIPO_TAREFA_KEYS } from './constantes'

export type TarefaImportada = {
  linha: number
  titulo: string
  tipo: TarefaRow['tipo']
  status: TarefaRow['status']
  para_quem: string | null
  participante_id: string | null
  turma_id: string | null
  data: string | null
  data_prevista: string | null
  horario: string | null
  canal: string | null
  objetivo: string | null
  mensagem: string | null
  import_key: string
}

export type PreviaImportTarefas = {
  total: number
  novas: TarefaImportada[]
  duplicadas: number
  invalidas: { linha: number; motivo: string }[]
  vinculadasParticipante: number
  vinculadasTurma: number
  semVinculo: number
}

const COLUNAS = {
  titulo: ['titulo', 'tarefa', 'o que', 'acao', 'atividade'],
  para_quem: ['para quem', 'para', 'quem', 'destinatario'],
  data: ['data', 'quando', 'dia'],
  horario: ['horario', 'hora'],
  canal: ['canal'],
  objetivo: ['objetivo'],
  mensagem: ['mensagem', 'texto', 'copy'],
  status: ['status', 'situacao'],
  tipo: ['tipo'],
} as const

type Coluna = keyof typeof COLUNAS

/** Chave de deduplicação: mesma tarefa, mesmo destinatário, mesma data em texto. */
export function chaveImport(titulo: string, paraQuem: string | null, data: string | null): string {
  return [titulo, paraQuem ?? '', data ?? ''].map(normalize).join('|')
}

function lerEnum<K extends string>(valor: string, mapa: Record<K, { label: string }>, chaves: K[]): K | null {
  const v = normalize(valor).replace(/\s+/g, '_')
  return chaves.find((k) => k === v || normalize(mapa[k].label).replace(/\s+/g, '_') === v) ?? null
}

function lerHorario(valor: string): string | null {
  const m = valor.match(/(\d{1,2})\s*[:hH]\s*(\d{2})?/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2] ?? 0)
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/**
 * Lê o CSV de tarefas, deduplica e tenta vincular `para_quem`:
 * 1) nome ou apelido de participante (só se houver um único), 2) nome de turma, 3) texto livre.
 */
export function previaImportTarefas(
  conteudo: string,
  contexto: {
    chavesExistentes: Iterable<string>
    participantes: { id: string; nome: string; apelido: string | null }[]
    turmas: { id: string; nome: string }[]
    referencia?: Date
  },
): PreviaImportTarefas {
  const { cabecalho, linhas } = parseCsv(conteudo)
  const col = {} as Record<Coluna, string | undefined>
  for (const k of Object.keys(COLUNAS) as Coluna[]) {
    col[k] = cabecalho.find((c) => (COLUNAS[k] as readonly string[]).includes(normalize(c)))
  }
  const ler = (row: Record<string, string>, k: Coluna) => (col[k] ? row[col[k]!]?.trim() || null : null)

  const porNome = new Map<string, string[]>()
  for (const p of contexto.participantes) {
    for (const n of [p.nome, p.apelido]) {
      if (!n) continue
      const chave = normalize(n)
      porNome.set(chave, [...new Set([...(porNome.get(chave) ?? []), p.id])])
    }
  }
  const turmaPorNome = new Map(contexto.turmas.map((t) => [normalize(t.nome), t.id]))

  const vistas = new Set(contexto.chavesExistentes)
  const previa: PreviaImportTarefas = {
    total: linhas.length,
    novas: [],
    duplicadas: 0,
    invalidas: [],
    vinculadasParticipante: 0,
    vinculadasTurma: 0,
    semVinculo: 0,
  }

  if (!col.titulo) {
    previa.invalidas = linhas.map((_, i) => ({ linha: i + 2, motivo: 'CSV sem coluna "Tarefa" ou "Título"' }))
    return previa
  }

  linhas.forEach((row, i) => {
    const linha = i + 2
    const titulo = ler(row, 'titulo')
    if (!titulo) {
      previa.invalidas.push({ linha, motivo: 'Tarefa sem título' })
      return
    }
    const paraQuem = ler(row, 'para_quem')
    const data = ler(row, 'data')
    const import_key = chaveImport(titulo, paraQuem, data)
    if (vistas.has(import_key)) {
      previa.duplicadas++
      return
    }
    vistas.add(import_key)

    let participante_id: string | null = null
    let turma_id: string | null = null
    if (paraQuem) {
      const candidatos = porNome.get(normalize(paraQuem)) ?? []
      if (candidatos.length === 1) participante_id = candidatos[0]
      else turma_id = turmaPorNome.get(normalize(paraQuem)) ?? turmaPorNome.get(normalize(paraQuem.replace(/^turma\s+/i, ''))) ?? null
    }
    if (participante_id) previa.vinculadasParticipante++
    else if (turma_id) previa.vinculadasTurma++
    else previa.semVinculo++

    const tipoLido = ler(row, 'tipo')
    const statusLido = ler(row, 'status')
    const horarioLido = ler(row, 'horario')

    previa.novas.push({
      linha,
      titulo,
      tipo: (tipoLido && lerEnum(tipoLido, TIPO_TAREFA, TIPO_TAREFA_KEYS)) || (participante_id ? 'mensagem_privada' : 'interna'),
      status: (statusLido && lerEnum(statusLido, STATUS_TAREFA, STATUS_TAREFA_KEYS)) || 'a_fazer',
      para_quem: participante_id || turma_id ? null : paraQuem,
      participante_id,
      turma_id,
      data,
      data_prevista: parseWeevoDatas(data, contexto.referencia)[0] ?? null,
      horario: horarioLido ? lerHorario(horarioLido) : null,
      canal: ler(row, 'canal'),
      objetivo: ler(row, 'objetivo'),
      mensagem: ler(row, 'mensagem'),
      import_key,
    })
  })

  return previa
}
