import type { ParticipanteRow, PlantaoRow, TurmaRow } from '@/lib/tipos'
import { proximoPlantao, type ContextoPlaceholder } from '@/lib/placeholders'
import { nomeTratamento } from '@/features/participantes/constantes'

/** Valores dos placeholders para uma tarefa ligada a participante ou turma. */
export function contextoPlaceholders(
  vinculo: { participante_id: string | null; turma_id: string | null },
  dados: { participantes: ParticipanteRow[]; turmas: TurmaRow[]; plantoes: PlantaoRow[] },
): ContextoPlaceholder {
  const participante = vinculo.participante_id
    ? dados.participantes.find((p) => p.id === vinculo.participante_id)
    : undefined
  const turmaId = participante?.turma_id ?? vinculo.turma_id
  const turma = turmaId ? dados.turmas.find((t) => t.id === turmaId) : undefined
  return {
    nome: participante ? nomeTratamento(participante) : null,
    turma: turma?.nome ?? null,
    ...proximoPlantao(dados.plantoes.filter((p) => p.turma_id === turmaId)),
  }
}
