import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/tipos'
import { mensagemErro } from '@/lib/utils'
import { chaves } from '@/lib/chaves'

export type EventoInsert = Database['public']['Tables']['weevo_eventos']['Insert']

/** Todos os eventos (base para pontuação e alertas). Volume pequeno: algumas turmas por vez. */
export function useTodosEventos() {
  return useQuery({
    queryKey: chaves.eventos,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weevo_eventos')
        .select('id, participante_id, tipo, ocorrido_em, plantao_id, categoria, nota')
        .order('ocorrido_em')
      if (error) throw error
      return data
    },
  })
}

export function useEventosParticipante(participanteId: string) {
  return useQuery({
    queryKey: chaves.eventosDe(participanteId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weevo_eventos')
        .select('*')
        .eq('participante_id', participanteId)
        .order('ocorrido_em', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function invalidarEventos(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: chaves.eventos })
  qc.invalidateQueries({ queryKey: chaves.participantes })
}

export function useRegistrarEventos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (eventos: EventoInsert[]) => {
      const { error } = await supabase.from('weevo_eventos').insert(eventos)
      if (error) throw error
    },
    onSuccess: () => invalidarEventos(qc),
    onError: (e) => toast.error(mensagemErro(e)),
  })
}

export function useExcluirEvento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('weevo_eventos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Evento excluído.')
      invalidarEventos(qc)
    },
    onError: (e) => toast.error(mensagemErro(e)),
  })
}
