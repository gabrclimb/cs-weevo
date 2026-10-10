import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Database, TurmaRow } from '@/lib/tipos'
import { chaves } from '@/lib/chaves'
import { mensagemErro } from '@/lib/utils'
import { invalidarEventos } from '@/features/eventos/queries'

type TurmaInsert = Database['public']['Tables']['weevo_turmas']['Insert']
type TurmaUpdate = Database['public']['Tables']['weevo_turmas']['Update']
type PlantaoInsert = Database['public']['Tables']['weevo_plantoes']['Insert']

export { useTurmas } from '@/features/participantes/queries'

export function usePlantoes() {
  return useQuery({
    queryKey: chaves.plantoes,
    queryFn: async () => {
      const { data, error } = await supabase.from('weevo_plantoes').select('*').order('numero')
      if (error) throw error
      return data
    },
  })
}

export function useSalvarTurma() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id?: string; dados: TurmaInsert & TurmaUpdate }) => {
      const consulta = id
        ? supabase.from('weevo_turmas').update(dados).eq('id', id)
        : supabase.from('weevo_turmas').insert(dados)
      const { data, error } = await consulta.select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Turma salva.')
      qc.invalidateQueries({ queryKey: chaves.turmas })
    },
    onError: (e) => toast.error(mensagemErro(e)),
  })
}

/** Atualização parcial com update otimista (usada ao arrastar no kanban). */
export function useAtualizarTurma() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, mudancas }: { id: string; mudancas: TurmaUpdate }) => {
      const { error } = await supabase.from('weevo_turmas').update(mudancas).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, mudancas }) => {
      await qc.cancelQueries({ queryKey: chaves.turmas })
      const anterior = qc.getQueryData<TurmaRow[]>(chaves.turmas)
      qc.setQueryData<TurmaRow[]>(chaves.turmas, (lista) => lista?.map((t) => (t.id === id ? { ...t, ...mudancas } : t)))
      return { anterior }
    },
    onError: (e, _v, ctx) => {
      qc.setQueryData(chaves.turmas, ctx?.anterior)
      toast.error(mensagemErro(e))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: chaves.turmas }),
  })
}

export function useExcluirTurma() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('weevo_turmas').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Turma excluída.')
      qc.invalidateQueries({ queryKey: chaves.turmas })
      qc.invalidateQueries({ queryKey: chaves.participantes })
    },
    onError: (e) => toast.error(mensagemErro(e)),
  })
}

export function useSalvarPlantao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dados: PlantaoInsert) => {
      const { data, error } = await supabase
        .from('weevo_plantoes')
        .upsert(dados, { onConflict: 'turma_id,numero' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.plantoes }),
    onError: (e) => toast.error(mensagemErro(e)),
  })
}

export function useExcluirPlantao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('weevo_plantoes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Plantão excluído.')
      qc.invalidateQueries({ queryKey: chaves.plantoes })
      invalidarEventos(qc)
    },
    onError: (e) => toast.error(mensagemErro(e)),
  })
}

/** Marca ou desmarca presença: cria ou exclui o evento plantao_presenca. */
export function useAlternarPresenca() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      participanteId,
      plantaoId,
      presente,
      ocorridoEm,
    }: {
      participanteId: string
      plantaoId: string
      presente: boolean
      ocorridoEm: string
    }) => {
      if (presente) {
        const { error } = await supabase.from('weevo_eventos').insert({
          participante_id: participanteId,
          plantao_id: plantaoId,
          tipo: 'plantao_presenca',
          ocorrido_em: ocorridoEm,
        })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('weevo_eventos')
          .delete()
          .eq('participante_id', participanteId)
          .eq('plantao_id', plantaoId)
          .eq('tipo', 'plantao_presenca')
        if (error) throw error
      }
    },
    onSettled: () => invalidarEventos(qc),
    onError: (e) => toast.error(mensagemErro(e)),
  })
}
