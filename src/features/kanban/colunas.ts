import type { ColunaKanban } from '@/components/kanban'
import type { Database } from '@/lib/tipos'

type Tabelas = Database['public']['Tables']
export type ColunaPersonalizadaRow = Tabelas['weevo_kanban_colunas']['Row']
export type CardKanbanRow = Tabelas['weevo_kanban_cards']['Row']

/** Quadros que aceitam colunas criadas pela equipe (o CHECK da tabela tem a mesma lista). */
export type Quadro =
  | 'tarefas'
  | 'participantes.status'
  | 'participantes.weevo_start'
  | 'participantes.responsavel'
  | 'participantes.dia_escolhido'
  | 'participantes.cadastro_plataforma'
  | 'turmas.situacao'
  | 'turmas.tipo'

/** Colunas criadas e cards colocados nelas, de todos os quadros. */
export type Personalizadas = { colunas: ColunaPersonalizadaRow[]; cards: CardKanbanRow[] }

export const SEM_PERSONALIZADAS: Personalizadas = { colunas: [], cards: [] }

// Classes por extenso para o Tailwind gerá-las. A cor vem da posição da coluna no quadro.
const PONTOS = ['bg-sky-500', 'bg-indigo-500', 'bg-teal-500', 'bg-pink-500', 'bg-orange-500', 'bg-lime-500']

export function colunasDoQuadro(p: Personalizadas, quadro: Quadro): ColunaPersonalizadaRow[] {
  return p.colunas
    .filter((c) => c.quadro === quadro)
    .sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at))
}

/** Colunas personalizadas no formato do kanban. `chave` é o id da coluna, salvo quando `chaveDe` diz outra coisa. */
export function paraColunasKanban(
  colunas: ColunaPersonalizadaRow[],
  opcoes: { renomeavel?: boolean; chaveDe?: (c: ColunaPersonalizadaRow) => string } = {},
): ColunaKanban[] {
  return colunas.map((c, i) => ({
    chave: opcoes.chaveDe?.(c) ?? c.id,
    titulo: c.titulo,
    ponto: PONTOS[i % PONTOS.length],
    dica: 'Coluna criada pela equipe.',
    editavel: { id: c.id, renomeavel: opcoes.renomeavel ?? true },
  }))
}

/**
 * Junta as colunas fixas de um quadro com as criadas pela equipe. Um item fica na coluna personalizada
 * enquanto o campo do quadro (ex.: o status) tiver o mesmo valor de quando ele foi colocado lá;
 * se o campo mudar por outro caminho (botão, formulário), o item volta para a coluna fixa.
 */
export function aplicarPersonalizadas<T>(
  quadro: Quadro,
  nativas: ColunaKanban[],
  p: Personalizadas,
  item: { id: (i: T) => string; valor: (i: T) => string },
) {
  const extras = paraColunasKanban(colunasDoQuadro(p, quadro))
  const porChave = new Map(extras.map((c) => [c.chave, c]))
  const cards = new Map(p.cards.filter((c) => c.quadro === quadro).map((c) => [c.item_id, c]))

  /** Coluna personalizada em que o item está, se estiver em alguma. */
  function personalizadaDe(i: T): ColunaKanban | undefined {
    const card = cards.get(item.id(i))
    return card && card.valor_base === item.valor(i) ? porChave.get(card.coluna_id) : undefined
  }

  return {
    colunas: [...nativas, ...extras],
    colunaDe: (i: T) => personalizadaDe(i)?.chave ?? item.valor(i),
    personalizadaDe,
  }
}
