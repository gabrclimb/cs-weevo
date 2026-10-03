import type { Database, ParticipanteRow, TurmaRow } from '@/lib/database.types'
import type { ColunaKanban } from '@/components/kanban'
import { STATUS_KEYS, STATUS_PARTICIPANTE, WEEVO_START, WEEVO_START_KEYS } from './constantes'

type ParticipanteUpdate = Database['public']['Tables']['weevo_participantes']['Update']

export const AGRUPAMENTOS = {
  status: 'Status',
  weevo_start: 'Weevo Start',
  responsavel: 'Responsável',
  turma: 'Turma',
  dia_escolhido: 'Dia escolhido',
  cadastro_plataforma: 'Cadastro na plataforma',
} as const
export type Agrupamento = keyof typeof AGRUPAMENTOS
export const AGRUPAMENTO_KEYS = Object.keys(AGRUPAMENTOS) as Agrupamento[]

export function lerAgrupamento(v: unknown): Agrupamento | undefined {
  return typeof v === 'string' && v in AGRUPAMENTOS ? (v as Agrupamento) : undefined
}

const VAZIO = '__sem__'

// Classes por extenso para o Tailwind gerá-las.
const PONTOS: Record<string, string> = {
  emerald: 'bg-emerald-500',
  violet: 'bg-violet-500',
  amber: 'bg-amber-500',
  sky: 'bg-sky-500',
  rose: 'bg-rose-500',
}

/** Cor da bolinha a partir da classe do badge (ex.: "bg-emerald-100 text-emerald-800" → "bg-emerald-500"). */
function ponto(classe: string) {
  const cor = classe.match(/bg-(\w+)-\d+/)?.[1]
  return (cor && PONTOS[cor]) || 'bg-muted-foreground'
}

export type Grupos = {
  colunas: ColunaKanban[]
  colunaDe: (p: ParticipanteRow) => string
  /** Mudança no participante ao soltar o card na coluna. */
  mudancaPara: (coluna: string) => ParticipanteUpdate
}

/**
 * Colunas e regra de agrupamento. Campos de texto livre (responsável, dia, cadastro) geram
 * uma coluna por valor encontrado, mais "Sem …" no início.
 */
export function agrupar(agrupamento: Agrupamento, participantes: ParticipanteRow[], turmas: TurmaRow[]): Grupos {
  switch (agrupamento) {
    case 'status':
      return {
        colunas: STATUS_KEYS.map((k) => ({ chave: k, titulo: STATUS_PARTICIPANTE[k].label, ponto: ponto(STATUS_PARTICIPANTE[k].classe) })),
        colunaDe: (p) => p.status,
        mudancaPara: (c) => ({ status: c as ParticipanteRow['status'] }),
      }
    case 'weevo_start':
      return {
        colunas: WEEVO_START_KEYS.map((k) => ({ chave: k, titulo: WEEVO_START[k].label, ponto: ponto(WEEVO_START[k].classe) })),
        colunaDe: (p) => p.weevo_start,
        mudancaPara: (c) => ({ weevo_start: c as ParticipanteRow['weevo_start'] }),
      }
    case 'turma': {
      const usadas = new Set(participantes.map((p) => p.turma_id))
      const colunas = [...turmas]
        .filter((t) => t.ativa || usadas.has(t.id))
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map((t) => ({ chave: t.id, titulo: t.nome }))
      return {
        colunas: [{ chave: VAZIO, titulo: 'Sem turma' }, ...colunas],
        colunaDe: (p) => p.turma_id ?? VAZIO,
        mudancaPara: (c) => ({ turma_id: c === VAZIO ? null : c }),
      }
    }
    default: {
      const campo = agrupamento
      const valores = [...new Set(participantes.flatMap((p) => (p[campo]?.trim() ? [p[campo]!.trim()] : [])))].sort((a, b) =>
        a.localeCompare(b),
      )
      return {
        colunas: [
          { chave: VAZIO, titulo: `Sem ${AGRUPAMENTOS[campo].toLowerCase()}` },
          ...valores.map((v) => ({ chave: v, titulo: v })),
        ],
        colunaDe: (p) => p[campo]?.trim() || VAZIO,
        mudancaPara: (c) => ({ [campo]: c === VAZIO ? null : c }),
      }
    }
  }
}
