import { Link } from '@tanstack/react-router'
import { CalendarDays, Clock, Copy, GitBranch, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui'
import { Dica, InfoDica } from '@/components/dica'
import { DICA_TIPO_TAREFA } from '@/lib/textos-dicas'
import type { ParticipanteRow, TarefaRow, TurmaRow } from '@/lib/database.types'
import { aguardandoDemais, tarefaAtrasada } from '@/lib/alertas'
import { cn, dataCurta, haQuanto } from '@/lib/utils'
import { TIPO_TAREFA } from './constantes'
import type { AcaoTarefa } from './queries'

export type CardHandlers = {
  onAbrir: (t: TarefaRow) => void
  onAcao: (t: TarefaRow, acao: AcaoTarefa) => void
  onRespondeu: (t: TarefaRow) => void
  onGerarFilhas: (t: TarefaRow) => void
  onExcluir: (t: TarefaRow) => void
}

export function TarefaCard({
  tarefa: t,
  participante,
  turma,
  filhas,
  hoje,
  handlers,
}: {
  tarefa: TarefaRow
  participante?: ParticipanteRow
  turma?: TurmaRow
  filhas: number
  hoje: string
  handlers: CardHandlers
}) {
  const Icone = TIPO_TAREFA[t.tipo].icone
  const atrasada = tarefaAtrasada(t, hoje)
  const demorando = aguardandoDemais(t)
  const privadaComParticipante = t.tipo === 'mensagem_privada' && !!t.participante_id
  const aberta = t.status === 'a_fazer' || t.status === 'em_andamento'

  function copiar() {
    if (!t.mensagem) return
    navigator.clipboard.writeText(t.mensagem)
    toast.success('Mensagem copiada. Cole no CRM.')
  }

  return (
    <article className="group space-y-2 rounded-lg border bg-card p-3 text-sm shadow-xs">
      <div className="flex items-start gap-2">
        <Dica texto={<><strong>{TIPO_TAREFA[t.tipo].label}.</strong> {DICA_TIPO_TAREFA[t.tipo]}</>} className="mt-0.5 shrink-0">
          <Icone className="size-4 text-muted-foreground/70" aria-label={TIPO_TAREFA[t.tipo].label} />
        </Dica>
        <button onClick={() => handlers.onAbrir(t)} className="flex-1 text-left font-medium text-foreground hover:text-primary">
          {t.titulo}
        </button>
        <button
          onClick={() => handlers.onExcluir(t)}
          className="rounded-sm p-0.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-rose-600"
          aria-label="Excluir tarefa"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {participante ? (
          <Link to="/cs/participantes/$id" params={{ id: participante.id }} className="font-medium text-primary hover:underline">
            {participante.nome}
          </Link>
        ) : turma ? (
          <Link to="/cs/turmas/$id" params={{ id: turma.id }} className="font-medium text-primary hover:underline">
            Turma {turma.nome}
          </Link>
        ) : t.para_quem ? (
          <span>{t.para_quem}</span>
        ) : null}
        {(t.data_prevista || t.data) && (
          <span className={cn('inline-flex items-center gap-1', atrasada && 'font-medium text-rose-600')}>
            <CalendarDays className="size-3" />
            {t.data_prevista ? dataCurta(t.data_prevista) : t.data}
            {t.horario && ` ${t.horario.slice(0, 5)}`}
          </span>
        )}
        {t.status === 'aguardando_resposta' && t.enviado_em && (
          <span className={cn('inline-flex items-center gap-1', demorando && 'font-medium text-amber-700')}>
            <Clock className="size-3" />
            enviado {haQuanto(t.enviado_em)}
          </span>
        )}
        {t.resultado && <span className="italic">{t.resultado}</span>}
      </div>

      {privadaComParticipante && aberta && (
        <div className="flex flex-wrap gap-1.5">
          {t.mensagem && (
            <Button variante="secundario" className="h-7 px-2 text-xs" onClick={copiar}>
              <Copy className="size-3" />
              Copiar
            </Button>
          )}
          <Button className="h-7 px-2 text-xs" onClick={() => handlers.onAcao(t, { tipo: 'status', status: 'aguardando_resposta' })}>
            Enviei
          </Button>
          <Button variante="secundario" className="h-7 px-2 text-xs" onClick={() => handlers.onAcao(t, { tipo: 'status', status: 'feito' })}>
            Enviei e concluí
          </Button>
          <InfoDica
            className="self-center"
            texto="“Enviei” registra a mensagem e deixa a tarefa aguardando resposta. “Enviei e concluí” registra e já fecha a tarefa, para quando não se espera resposta."
          />
        </div>
      )}

      {privadaComParticipante && t.status === 'aguardando_resposta' && (
        <div className="flex flex-wrap gap-1.5">
          <Button className="h-7 px-2 text-xs" onClick={() => handlers.onRespondeu(t)}>
            Respondeu
          </Button>
          <Button variante="secundario" className="h-7 px-2 text-xs" onClick={() => handlers.onAcao(t, { tipo: 'encerrar_sem_resposta' })}>
            Encerrar sem resposta
          </Button>
          <InfoDica
            className="self-center"
            texto="“Respondeu” registra a resposta (conta na pontuação) e conclui a tarefa. “Encerrar sem resposta” fecha a tarefa sem registrar resposta."
          />
        </div>
      )}

      {t.turma_id && t.tipo === 'mensagem_privada' && t.status !== 'feito' && (
        <Button variante="secundario" className="h-7 px-2 text-xs" onClick={() => handlers.onGerarFilhas(t)}>
          <GitBranch className="size-3" />
          {filhas ? `Gerar para quem falta (${filhas} já geradas)` : 'Gerar para cada participante'}
        </Button>
      )}

      {!privadaComParticipante && !(t.turma_id && t.tipo === 'mensagem_privada') && t.status !== 'feito' && (
        <div className="flex gap-1.5">
          {t.tipo === 'conteudo_grupo' && t.mensagem && (
            <Button variante="secundario" className="h-7 px-2 text-xs" onClick={copiar}>
              <Copy className="size-3" />
              Copiar
            </Button>
          )}
          <Button variante="secundario" className="h-7 px-2 text-xs" onClick={() => handlers.onAcao(t, { tipo: 'status', status: 'feito' })}>
            Concluir
          </Button>
        </div>
      )}
    </article>
  )
}
