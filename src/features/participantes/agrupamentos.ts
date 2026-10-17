import type { Database, ParticipanteRow, TurmaRow } from '@/lib/tipos'
import type { ColunaKanban } from '@/components/kanban'
import { FAIXAS_PONTUACAO } from '@/lib/config'
import {
  SEM_PERSONALIZADAS,
  aplicarPersonalizadas,
  colunasDoQuadro,
  paraColunasKanban,
  type Personalizadas,
  type Quadro,
} from '@/features/kanban/colunas'
import { STATUS_KEYS, STATUS_PARTICIPANTE, WEEVO_START, WEEVO_START_KEYS } from './constantes'

type ParticipanteUpdate = Database['public']['Tables']['weevo_participantes']['Update']

export const AGRUPAMENTOS = {
  faixa: 'Faixa de engajamento',
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

/** Quadro de colunas personalizadas de cada agrupamento. Faixa e turma não ganham colunas novas. */
export const QUADRO_DO_AGRUPAMENTO: Partial<Record<Agrupamento, Quadro>> = {
  status: 'participantes.status',
  weevo_start: 'participantes.weevo_start',
  responsavel: 'participantes.responsavel',
  dia_escolhido: 'participantes.dia_escolhido',
  cadastro_plataforma: 'participantes.cadastro_plataforma',
}

type CampoTexto = 'responsavel' | 'dia_escolhido' | 'cadastro_plataforma'

/** Valor do campo agrupado, como chave da coluna fixa. */
export function valorAgrupado(agrupamento: 'status' | 'weevo_start' | CampoTexto, p: ParticipanteRow): string {
  if (agrupamento === 'status' || agrupamento === 'weevo_start') return p[agrupamento]
  return p[agrupamento]?.trim() || VAZIO
}

/** Coluna criada pela equipe em que o participante está no quadro de status ou de Weevo Start. */
export function colunaPersonalizada(personalizadas: Personalizadas, campo: 'status' | 'weevo_start', p: ParticipanteRow) {
  return aplicarPersonalizadas(QUADRO_DO_AGRUPAMENTO[campo]!, [], personalizadas, {
    id: (x: ParticipanteRow) => x.id,
    valor: (x) => x[campo],
  }).personalizadaDe(p)
}

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
  /** Mudança no participante ao soltar o card na coluna. Ausente = agrupamento calculado, sem arrastar. */
  mudancaPara?: (coluna: string) => ParticipanteUpdate
}

/**
 * Colunas e regra de agrupamento. Campos de texto livre (responsável, dia, cadastro) geram
 * uma coluna por valor encontrado, mais "Sem …" no início.
 * Colunas criadas pela equipe entram no fim: em status e Weevo Start são colunas à parte (o card guarda
 * a posição); nos campos de texto, a coluna criada é um valor novo que o card recebe ao ser solto nela.
 */
export function agrupar(
  agrupamento: Agrupamento,
  participantes: ParticipanteRow[],
  turmas: TurmaRow[],
  /** Pontuação total de cada participante (usada na faixa de engajamento). */
  totalDe: (p: ParticipanteRow) => number = () => 0,
  personalizadas: Personalizadas = SEM_PERSONALIZADAS,
): Grupos {
  switch (agrupamento) {
    case 'faixa':
      return {
        colunas: [
          { chave: 'alta', titulo: `Alto (${FAIXAS_PONTUACAO.alta}+)`, ponto: 'bg-emerald-500' },
          { chave: 'media', titulo: `Médio (${FAIXAS_PONTUACAO.media} a ${FAIXAS_PONTUACAO.alta - 1})`, ponto: 'bg-amber-500' },
          { chave: 'baixa', titulo: `Baixo (abaixo de ${FAIXAS_PONTUACAO.media})`, ponto: 'bg-muted-foreground' },
        ],
        colunaDe: (p) => {
          const t = totalDe(p)
          return t >= FAIXAS_PONTUACAO.alta ? 'alta' : t >= FAIXAS_PONTUACAO.media ? 'media' : 'baixa'
        },
      }
    case 'status':
    case 'weevo_start': {
      const campo = agrupamento
      const nativas =
        campo === 'status'
          ? STATUS_KEYS.map((k) => ({ chave: k, titulo: STATUS_PARTICIPANTE[k].label, ponto: ponto(STATUS_PARTICIPANTE[k].classe) }))
          : WEEVO_START_KEYS.map((k) => ({ chave: k, titulo: WEEVO_START[k].label, ponto: ponto(WEEVO_START[k].classe) }))
      const { colunas, colunaDe } = aplicarPersonalizadas(QUADRO_DO_AGRUPAMENTO[campo]!, nativas, personalizadas, {
        id: (p: ParticipanteRow) => p.id,
        valor: (p) => p[campo],
      })
      return {
        colunas,
        colunaDe,
        mudancaPara: (c) => (campo === 'status' ? { status: c as ParticipanteRow['status'] } : { weevo_start: c as ParticipanteRow['weevo_start'] }),
      }
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
      // Coluna criada que ainda não tem ninguém aparece no fim e pode ser excluída. Depois que alguém
      // recebe o valor, ela vira uma coluna como as outras (o valor é do participante, não da coluna).
      const usados = new Set(valores.map((v) => v.toLowerCase()))
      const criadas = paraColunasKanban(
        colunasDoQuadro(personalizadas, QUADRO_DO_AGRUPAMENTO[campo]!).filter((c) => !usados.has(c.titulo.trim().toLowerCase())),
        { renomeavel: false, chaveDe: (c) => c.titulo.trim() },
      )
      return {
        colunas: [
          { chave: VAZIO, titulo: `Sem ${AGRUPAMENTOS[campo].toLowerCase()}` },
          ...valores.map((v) => ({ chave: v, titulo: v })),
          ...criadas,
        ],
        colunaDe: (p) => p[campo]?.trim() || VAZIO,
        mudancaPara: (c) => ({ [campo]: c === VAZIO ? null : c }),
      }
    }
  }
}
