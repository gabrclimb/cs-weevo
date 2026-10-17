import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { chaves } from '@/lib/chaves'
import { mensagemErro } from '@/lib/utils'
import type { EdicaoColunas } from '@/components/kanban'
import { SEM_PERSONALIZADAS, colunasDoQuadro, type CardKanbanRow, type Personalizadas, type Quadro } from './colunas'

/** Colunas criadas e posições dos cards, de todos os quadros (poucas linhas: carrega tudo de uma vez). */
export function usePersonalizadas(): Personalizadas {
  const { data } = useQuery({
    queryKey: chaves.kanban,
    queryFn: async (): Promise<Personalizadas> => {
      const [colunas, cards] = await Promise.all([
        supabase.from('weevo_kanban_colunas').select('*'),
        supabase.from('weevo_kanban_cards').select('*'),
      ])
      if (colunas.error) throw colunas.error
      if (cards.error) throw cards.error
      return { colunas: colunas.data, cards: cards.data }
    },
  })
  return data ?? SEM_PERSONALIZADAS
}

function erroColuna(e: { code?: string; message?: string }) {
  return e.code === '23505' ? 'Já existe uma coluna com esse nome neste quadro.' : mensagemErro(e)
}

/** Criar, renomear e excluir colunas de um quadro, e mover cards entre colunas fixas e personalizadas. */
export function useQuadroKanban(quadro: Quadro) {
  const qc = useQueryClient()
  const personalizadas = usePersonalizadas()
  const colunas = colunasDoQuadro(personalizadas, quadro)

  const otimista = async (mudar: (p: Personalizadas) => Personalizadas) => {
    await qc.cancelQueries({ queryKey: chaves.kanban })
    const anterior = qc.getQueryData<Personalizadas>(chaves.kanban)
    qc.setQueryData<Personalizadas>(chaves.kanban, (p) => mudar(p ?? SEM_PERSONALIZADAS))
    return { anterior }
  }
  const comum = {
    onError: (e: Error, _v: unknown, ctx?: { anterior?: Personalizadas }) => {
      if (ctx) qc.setQueryData(chaves.kanban, ctx.anterior)
      toast.error(erroColuna(e))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: chaves.kanban }),
  }

  const criar = useMutation({
    mutationFn: async (titulo: string) => {
      const ordem = Math.max(-1, ...colunas.map((c) => c.ordem)) + 1
      const { error } = await supabase.from('weevo_kanban_colunas').insert({ quadro, titulo, ordem })
      if (error) throw error
    },
    onSuccess: () => toast.success('Coluna criada.'),
    ...comum,
  })

  const renomear = useMutation({
    mutationFn: async ({ id, titulo }: { id: string; titulo: string }) => {
      const { error } = await supabase.from('weevo_kanban_colunas').update({ titulo }).eq('id', id)
      if (error) throw error
    },
    onMutate: ({ id, titulo }) => otimista((p) => ({ ...p, colunas: p.colunas.map((c) => (c.id === id ? { ...c, titulo } : c)) })),
    ...comum,
  })

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('weevo_kanban_colunas').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: (id) =>
      otimista((p) => ({ colunas: p.colunas.filter((c) => c.id !== id), cards: p.cards.filter((c) => c.coluna_id !== id) })),
    onSuccess: () => toast.success('Coluna excluída.'),
    ...comum,
  })

  const salvarCard = useMutation({
    mutationFn: async (card: Omit<CardKanbanRow, 'created_at'>) => {
      const { error } = await supabase.from('weevo_kanban_cards').upsert(card, { onConflict: 'quadro,item_id' })
      if (error) throw error
    },
    onMutate: (card) =>
      otimista((p) => ({
        ...p,
        cards: [
          ...p.cards.filter((c) => !(c.quadro === card.quadro && c.item_id === card.item_id)),
          { ...card, created_at: new Date().toISOString() },
        ],
      })),
    ...comum,
  })

  const removerCard = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('weevo_kanban_cards').delete().eq('quadro', quadro).eq('item_id', itemId)
      if (error) throw error
    },
    onMutate: (itemId) => otimista((p) => ({ ...p, cards: p.cards.filter((c) => !(c.quadro === quadro && c.item_id === itemId)) })),
    ...comum,
  })

  const edicao: EdicaoColunas = {
    onCriar: (titulo) => criar.mutate(titulo),
    onRenomear: (id, titulo) => renomear.mutate({ id, titulo }),
    onExcluir: (id) => excluir.mutate(id),
  }

  /**
   * Solta o item na coluna `destino`. Em coluna personalizada, guarda a posição com o valor atual do campo;
   * em coluna fixa, tira a posição e, se o valor mudou, aplica `nativo` (a mudança de status, tipo etc.).
   */
  function soltar(itemId: string, destino: string, valorAtual: string, nativo: () => void) {
    if (colunas.some((c) => c.id === destino)) {
      salvarCard.mutate({ quadro, item_id: itemId, coluna_id: destino, valor_base: valorAtual })
      return
    }
    if (personalizadas.cards.some((c) => c.quadro === quadro && c.item_id === itemId)) removerCard.mutate(itemId)
    if (destino !== valorAtual) nativo()
  }

  return { personalizadas, edicao, soltar }
}
