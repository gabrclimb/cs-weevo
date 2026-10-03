import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ParticipanteRow } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { mensagemErro } from '@/lib/utils'
import { invalidarEventos } from '@/features/eventos/queries'

/** Repasse: weevo_start = repassado_comercial + evento repassado_comercial, em lote. */
export function useRepassar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (participantes: ParticipanteRow[]) => {
      const ids = participantes.map((p) => p.id)
      const { error } = await supabase.from('weevo_participantes').update({ weevo_start: 'repassado_comercial' }).in('id', ids)
      if (error) throw error
      const agora = new Date().toISOString()
      const { error: erroEventos } = await supabase
        .from('weevo_eventos')
        .insert(ids.map((participante_id) => ({ participante_id, tipo: 'repassado_comercial' as const, ocorrido_em: agora })))
      if (erroEventos) throw erroEventos
      return ids.length
    },
    onSuccess: (n) => {
      toast.success(`${n} participante(s) repassado(s) ao comercial.`)
      invalidarEventos(qc)
    },
    onError: (e) => toast.error(mensagemErro(e)),
  })
}

/** Só quem ainda não foi repassado (nem assinou ou recusou) pode ser repassado. */
export function podeRepassar(p: Pick<ParticipanteRow, 'weevo_start'>) {
  return p.weevo_start === 'nao_avaliado' || p.weevo_start === 'candidato'
}
