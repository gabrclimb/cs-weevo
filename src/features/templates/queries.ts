import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/tipos'
import { chaves } from '@/lib/chaves'
import { mensagemErro } from '@/lib/utils'

export { useTemplates } from '@/features/tarefas/queries'

type TemplateInsert = Database['public']['Tables']['message_templates']['Insert']

function useInvalidar() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: chaves.templates })
}

export function useSalvarTemplate() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async ({ id, dados }: { id?: string; dados: TemplateInsert }) => {
      const { error } = id
        ? await supabase.from('message_templates').update(dados).eq('id', id)
        : await supabase.from('message_templates').insert(dados)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Template salvo.')
      invalidar()
    },
    onError: (e) => toast.error(mensagemErro(e)),
  })
}

export function useExcluirTemplate() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('message_templates').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Template excluído.')
      invalidar()
    },
    onError: (e) => toast.error(mensagemErro(e)),
  })
}

export function useSalvarCategoria() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async ({ id, nome, ordem }: { id?: string; nome: string; ordem?: number }) => {
      const { error } = id
        ? await supabase.from('message_template_categories').update({ nome }).eq('id', id)
        : await supabase.from('message_template_categories').insert({ nome, ordem: ordem ?? 0 })
      if (error) throw error
    },
    onSuccess: invalidar,
    onError: (e) => toast.error(mensagemErro(e)),
  })
}

export function useExcluirCategoria() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('message_template_categories').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Categoria excluída. Os templates dela ficaram sem categoria.')
      invalidar()
    },
    onError: (e) => toast.error(mensagemErro(e)),
  })
}
