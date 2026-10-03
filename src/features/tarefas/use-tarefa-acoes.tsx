import { useState } from 'react'
import { Button, Dialog } from '@/components/ui'
import type { TarefaRow } from '@/lib/database.types'
import { useParticipantes, useTurmas } from '@/features/participantes/queries'
import { usePlantoes } from '@/features/turmas/queries'
import { useGerarFilhas } from './gerar-filhas'
import { useAcaoTarefa, useExcluirTarefa, useTarefas } from './queries'
import { RespostaDialog } from './resposta-dialog'
import { TarefaForm } from './tarefa-form'
import type { CardHandlers } from './tarefa-card'

/**
 * Handlers e diálogos compartilhados pelo kanban, ficha e Hoje.
 * Renderize `dialogos` uma vez na página.
 */
export function useTarefaAcoes() {
  const acao = useAcaoTarefa()
  const excluir = useExcluirTarefa()
  const gerar = useGerarFilhas()
  const participantes = useParticipantes()
  const turmas = useTurmas()
  const plantoes = usePlantoes()
  const tarefas = useTarefas()

  const [editando, setEditando] = useState<TarefaRow | null>(null)
  const [respondendo, setRespondendo] = useState<TarefaRow | null>(null)
  const [excluindo, setExcluindo] = useState<TarefaRow | null>(null)

  const participanteDe = (t: TarefaRow | null) => participantes.data?.find((p) => p.id === t?.participante_id)

  const handlers: CardHandlers = {
    onAbrir: setEditando,
    onAcao: (t, a) => acao.mutate({ tarefa: t, acao: a }),
    onRespondeu: setRespondendo,
    onExcluir: setExcluindo,
    onGerarFilhas: (t) =>
      gerar.gerar(t, {
        participantes: participantes.data ?? [],
        turmas: turmas.data ?? [],
        plantoes: plantoes.data ?? [],
        tarefas: tarefas.data ?? [],
      }),
  }

  const respondente = participanteDe(respondendo)

  const dialogos = (
    <>
      <TarefaForm aberto={!!editando} onAbertoChange={(a) => !a && setEditando(null)} tarefa={editando ?? undefined} />
      <RespostaDialog
        aberto={!!respondendo}
        onAbertoChange={(a) => !a && setRespondendo(null)}
        nome={respondente?.nome ?? 'Participante'}
        jaImplementou={!!respondente?.implementou}
        onConfirmar={(r) => respondendo && acao.mutate({ tarefa: respondendo, acao: { tipo: 'respondeu', ...r } })}
      />
      <Dialog
        aberto={!!excluindo}
        onAbertoChange={(a) => !a && setExcluindo(null)}
        titulo="Excluir tarefa?"
        descricao={`"${excluindo?.titulo}" será excluída. Os eventos já registrados na linha do tempo continuam.`}
      >
        <div className="flex justify-end gap-2">
          <Button variante="secundario" onClick={() => setExcluindo(null)}>
            Cancelar
          </Button>
          <Button
            variante="perigo"
            onClick={() => excluindo && excluir.mutate(excluindo.id, { onSuccess: () => setExcluindo(null) })}
          >
            Excluir
          </Button>
        </div>
      </Dialog>
    </>
  )

  return { handlers, dialogos, setEditando }
}
