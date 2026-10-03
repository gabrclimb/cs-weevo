import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Database, EventoCategoria, TarefaRow } from '@/lib/database.types'
import { chaves } from '@/lib/chaves'
import { mensagemErro } from '@/lib/utils'
import { invalidarEventos } from '@/features/eventos/queries'
import { efeitosEncerrarSemResposta, efeitosMudancaStatus, efeitosResposta, type Efeitos } from './ciclo'

export type TarefaInsert = Database['public']['Tables']['weevo_tarefas']['Insert']
type TarefaUpdate = Database['public']['Tables']['weevo_tarefas']['Update']

export function useTarefas() {
  return useQuery({
    queryKey: chaves.tarefas,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weevo_tarefas')
        .select('*')
        .order('ordem')
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useSalvarTarefa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id?: string; dados: TarefaInsert }) => {
      const consulta = id
        ? supabase.from('weevo_tarefas').update(dados).eq('id', id)
        : supabase.from('weevo_tarefas').insert(dados)
      const { data, error } = await consulta.select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, { id }) => {
      toast.success(id ? 'Tarefa atualizada.' : 'Tarefa criada.')
      qc.invalidateQueries({ queryKey: chaves.tarefas })
    },
    onError: (e) => toast.error(mensagemErro(e)),
  })
}

export function useCriarTarefas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (tarefas: TarefaInsert[]) => {
      if (!tarefas.length) return 0
      const { error } = await supabase.from('weevo_tarefas').insert(tarefas)
      if (error) throw error
      return tarefas.length
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.tarefas }),
    onError: (e) => toast.error(mensagemErro(e)),
  })
}

export function useExcluirTarefa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('weevo_tarefas').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Tarefa excluída.')
      qc.invalidateQueries({ queryKey: chaves.tarefas })
    },
    onError: (e) => toast.error(mensagemErro(e)),
  })
}

export type AcaoTarefa =
  | { tipo: 'status'; status: TarefaRow['status']; ordem?: number }
  | { tipo: 'respondeu'; categoria: EventoCategoria | null; nota: string | null; marcarImplementou: boolean }
  | { tipo: 'encerrar_sem_resposta' }

/**
 * Aplica uma ação do ciclo da tarefa: atualiza a tarefa (otimista) e grava os eventos derivados.
 * Os campos do participante (último contato, última resposta, implementou) são recalculados por trigger.
 */
export function useAcaoTarefa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ tarefa, acao }: { tarefa: TarefaRow; acao: AcaoTarefa }) => {
      const agora = new Date().toISOString()
      let efeitos: Efeitos
      if (acao.tipo === 'status') efeitos = efeitosMudancaStatus(tarefa, acao.status, agora)
      else if (acao.tipo === 'respondeu') efeitos = efeitosResposta(tarefa, acao, agora)
      else efeitos = efeitosEncerrarSemResposta()

      const update: TarefaUpdate = { ...efeitos.update }
      if (acao.tipo === 'status' && acao.ordem !== undefined) update.ordem = acao.ordem

      const { error } = await supabase.from('weevo_tarefas').update(update).eq('id', tarefa.id)
      if (error) throw error
      if (efeitos.eventos.length) {
        const { error: erroEventos } = await supabase.from('weevo_eventos').insert(efeitos.eventos)
        if (erroEventos) throw erroEventos
      }
      return efeitos
    },
    onMutate: async ({ tarefa, acao }) => {
      await qc.cancelQueries({ queryKey: chaves.tarefas })
      const anterior = qc.getQueryData<TarefaRow[]>(chaves.tarefas)
      const status =
        acao.tipo === 'status' ? acao.status : 'feito'
      qc.setQueryData<TarefaRow[]>(chaves.tarefas, (lista) =>
        lista?.map((t) =>
          t.id === tarefa.id
            ? { ...t, status, ...(acao.tipo === 'status' && acao.ordem !== undefined ? { ordem: acao.ordem } : {}) }
            : t,
        ),
      )
      return { anterior }
    },
    onError: (e, _v, ctx) => {
      qc.setQueryData(chaves.tarefas, ctx?.anterior)
      toast.error(mensagemErro(e))
    },
    onSettled: (efeitos) => {
      qc.invalidateQueries({ queryKey: chaves.tarefas })
      if (efeitos?.eventos.length) invalidarEventos(qc)
    },
  })
}

export function useTemplates() {
  return useQuery({
    queryKey: chaves.templates,
    queryFn: async () => {
      const [categorias, templates] = await Promise.all([
        supabase.from('message_template_categories').select('*').order('ordem').order('nome'),
        supabase.from('message_templates').select('*').order('ordem').order('titulo'),
      ])
      if (categorias.error) throw categorias.error
      if (templates.error) throw templates.error
      return { categorias: categorias.data, templates: templates.data }
    },
  })
}
