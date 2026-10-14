import type { TipoTurma } from '@/lib/tipos'

/** Rótulo do tipo da turma. "Pública" e não "Aberta", para não confundir com o suporte em andamento. */
export const ROTULO_TIPO_TURMA: Record<TipoTurma, string> = {
  aberta: 'Pública',
  in_company: 'In company',
}
