import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Database, ParticipanteRow } from '@/lib/database.types'
import { mensagemErro } from '@/lib/utils'
import { chaves } from '@/lib/chaves'
import { STATUS_PARTICIPANTE, WEEVO_START } from './constantes'

type ParticipanteInsert = Database['public']['Tables']['weevo_participantes']['Insert']
type ParticipanteUpdate = Database['public']['Tables']['weevo_participantes']['Update']

export { chaves }

export function useTurmas() {
  return useQuery({
    queryKey: chaves.turmas,
    queryFn: async () => {
      const { data, error } = await supabase.from('weevo_turmas').select('*').order('nome')
      if (error) throw error
      return data
    },
  })
}

export function useParticipantes() {
  return useQuery({
    queryKey: chaves.participantes,
    queryFn: async () => {
      const { data, error } = await supabase.from('weevo_participantes').select('*').order('nome')
      if (error) throw error
      return data
    },
  })
}

export function useParticipante(id: string) {
  return useQuery({
    queryKey: chaves.participante(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('weevo_participantes').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useCriarParticipante() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dados: ParticipanteInsert) => {
      const { data, error } = await supabase.from('weevo_participantes').insert(dados).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Participante cadastrado.')
      qc.invalidateQueries({ queryKey: chaves.participantes })
    },
    onError: (e) => toast.error(mensagemErro(e)),
  })
}

export function useAtualizarParticipante() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ atual, mudancas }: { atual: ParticipanteRow; mudancas: ParticipanteUpdate }) => {
      const { data, error } = await supabase
        .from('weevo_participantes')
        .update(mudancas)
        .eq('id', atual.id)
        .select()
        .single()
      if (error) throw error

      // Mudança de status ou Weevo Start vira evento na linha do tempo.
      const notas: string[] = []
      if (mudancas.status && mudancas.status !== atual.status) {
        notas.push(`Status: ${STATUS_PARTICIPANTE[atual.status].label} → ${STATUS_PARTICIPANTE[mudancas.status].label}`)
      }
      if (mudancas.weevo_start && mudancas.weevo_start !== atual.weevo_start) {
        notas.push(`Weevo Start: ${WEEVO_START[atual.weevo_start].label} → ${WEEVO_START[mudancas.weevo_start].label}`)
      }
      if (notas.length) {
        const { error: erroEvento } = await supabase
          .from('weevo_eventos')
          .insert({ participante_id: atual.id, tipo: 'status_alterado', nota: notas.join(' · ') })
        if (erroEvento) throw erroEvento
      }
      return data
    },
    onMutate: async ({ atual, mudancas }) => {
      // Update otimista na ficha e na lista.
      await qc.cancelQueries({ queryKey: chaves.participantes })
      const anteriorFicha = qc.getQueryData<ParticipanteRow | null>(chaves.participante(atual.id))
      const anteriorLista = qc.getQueryData<ParticipanteRow[]>(chaves.participantes)
      qc.setQueryData(chaves.participante(atual.id), { ...atual, ...mudancas })
      qc.setQueryData<ParticipanteRow[]>(chaves.participantes, (lista) =>
        lista?.map((p) => (p.id === atual.id ? { ...p, ...mudancas } : p)),
      )
      return { anteriorFicha, anteriorLista }
    },
    onError: (e, { atual }, ctx) => {
      qc.setQueryData(chaves.participante(atual.id), ctx?.anteriorFicha)
      qc.setQueryData(chaves.participantes, ctx?.anteriorLista)
      toast.error(mensagemErro(e))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: chaves.participantes })
      qc.invalidateQueries({ queryKey: chaves.eventos })
    },
  })
}

/**
 * Mesma mudança para vários participantes de uma vez.
 * Status e Weevo Start continuam virando evento na linha do tempo de quem de fato mudou.
 */
export function useAtualizarEmMassa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ participantes, mudancas }: { participantes: ParticipanteRow[]; mudancas: ParticipanteUpdate }) => {
      const ids = participantes.map((p) => p.id)
      const { error } = await supabase.from('weevo_participantes').update(mudancas).in('id', ids)
      if (error) throw error

      const eventos = participantes.flatMap((p) => {
        const notas: string[] = []
        if (mudancas.status && mudancas.status !== p.status) {
          notas.push(`Status: ${STATUS_PARTICIPANTE[p.status].label} → ${STATUS_PARTICIPANTE[mudancas.status].label}`)
        }
        if (mudancas.weevo_start && mudancas.weevo_start !== p.weevo_start) {
          notas.push(`Weevo Start: ${WEEVO_START[p.weevo_start].label} → ${WEEVO_START[mudancas.weevo_start].label}`)
        }
        return notas.length ? [{ participante_id: p.id, tipo: 'status_alterado' as const, nota: notas.join(' · ') }] : []
      })
      if (eventos.length) {
        const { error: erroEventos } = await supabase.from('weevo_eventos').insert(eventos)
        if (erroEventos) throw erroEventos
      }
      return ids.length
    },
    onSuccess: (n) => toast.success(`${n} participante(s) atualizado(s).`),
    onError: (e) => toast.error(mensagemErro(e)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: chaves.participantes })
      qc.invalidateQueries({ queryKey: chaves.eventos })
    },
  })
}

export function useExcluirParticipante() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('weevo_participantes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Participante excluído.')
      qc.invalidateQueries({ queryKey: chaves.participantes })
    },
    onError: (e) => toast.error(mensagemErro(e)),
  })
}
