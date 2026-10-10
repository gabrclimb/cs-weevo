import { toast } from 'sonner'
import type { ParticipanteRow, PlantaoRow, TarefaRow, TurmaRow } from '@/lib/tipos'
import { preencherPlaceholders } from '@/lib/placeholders'
import { contextoPlaceholders } from './contexto'
import { useCriarTarefas, type TarefaInsert } from './queries'

/**
 * Decisão 1: tarefa de turma com mensagem privada vira uma tarefa filha por participante
 * (parent_id), com a mensagem já personalizada. Ignora inativos e quem já tem filha.
 */
export function montarFilhas(
  mae: TarefaRow,
  dados: { participantes: ParticipanteRow[]; turmas: TurmaRow[]; plantoes: PlantaoRow[]; tarefas: TarefaRow[] },
): TarefaInsert[] {
  const jaTem = new Set(dados.tarefas.filter((t) => t.parent_id === mae.id).map((t) => t.participante_id))
  return dados.participantes
    .filter((p) => p.turma_id === mae.turma_id && p.status !== 'inativo' && !jaTem.has(p.id))
    .map((p) => ({
      titulo: mae.titulo,
      tipo: 'mensagem_privada',
      status: 'a_fazer',
      participante_id: p.id,
      parent_id: mae.id,
      plantao_id: mae.plantao_id,
      data_prevista: mae.data_prevista,
      horario: mae.horario,
      canal: mae.canal,
      objetivo: mae.objetivo,
      mensagem: mae.mensagem
        ? preencherPlaceholders(mae.mensagem, contextoPlaceholders({ participante_id: p.id, turma_id: null }, dados))
        : null,
      ordem: mae.ordem,
    }))
}

export function useGerarFilhas() {
  const criar = useCriarTarefas()
  return {
    pendente: criar.isPending,
    gerar: async (mae: TarefaRow, dados: Parameters<typeof montarFilhas>[1]) => {
      const filhas = montarFilhas(mae, dados)
      if (!filhas.length) {
        toast.info('Todos os participantes ativos da turma já têm tarefa gerada.')
        return
      }
      await criar.mutateAsync(filhas)
      toast.success(`${filhas.length} tarefa(s) criada(s), uma por participante.`)
    },
  }
}
