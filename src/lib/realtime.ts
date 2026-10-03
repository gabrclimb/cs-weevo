import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { chaves } from './chaves'

/** Uma assinatura só, no layout: mudanças de outros usuários invalidam o cache. */
export function useRealtime() {
  const qc = useQueryClient()
  useEffect(() => {
    const canal = supabase
      .channel('weevo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weevo_tarefas' }, () =>
        qc.invalidateQueries({ queryKey: chaves.tarefas }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weevo_participantes' }, () =>
        qc.invalidateQueries({ queryKey: chaves.participantes }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weevo_eventos' }, () =>
        qc.invalidateQueries({ queryKey: chaves.eventos }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [qc])
}
