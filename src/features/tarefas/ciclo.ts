import type { Database, EventoCategoria, TarefaRow } from '@/lib/tipos'

type TarefaUpdate = Database['public']['Tables']['weevo_tarefas']['Update']
type EventoInsert = Database['public']['Tables']['weevo_eventos']['Insert']

export type Efeitos = { update: TarefaUpdate; eventos: EventoInsert[] }

type TarefaCiclo = Pick<TarefaRow, 'id' | 'tipo' | 'status' | 'participante_id' | 'plantao_id' | 'enviado_em'>

/** Mensagem privada ligada a um participante: é a que gera eventos de envio. */
function geraEnvio(t: TarefaCiclo) {
  return t.tipo === 'mensagem_privada' && !!t.participante_id
}

function eventosDeEnvio(t: TarefaCiclo, agora: string): EventoInsert[] {
  if (!geraEnvio(t) || t.enviado_em) return []
  const eventos: EventoInsert[] = [
    { participante_id: t.participante_id!, tipo: 'mensagem_enviada', tarefa_id: t.id, ocorrido_em: agora },
  ]
  if (t.plantao_id) {
    eventos.push({
      participante_id: t.participante_id!,
      tipo: 'plantao_ausencia_contatada',
      tarefa_id: t.id,
      plantao_id: t.plantao_id,
      ocorrido_em: agora,
    })
  }
  return eventos
}

/**
 * Efeitos de mover uma tarefa para outro status (botão ou arrastar no kanban). Seção 6.1:
 * - mensagem privada que vai para "aguardando resposta" ou "feito" sem envio registrado → mensagem_enviada
 * - ligação concluída → evento ligacao
 */
export function efeitosMudancaStatus(t: TarefaCiclo, novo: TarefaRow['status'], agora: string): Efeitos {
  const update: TarefaUpdate = { status: novo }
  const eventos: EventoInsert[] = []
  if (novo === t.status) return { update, eventos }

  if (novo === 'aguardando_resposta' || novo === 'feito') {
    if (geraEnvio(t) && !t.enviado_em) {
      update.enviado_em = agora
      eventos.push(...eventosDeEnvio(t, agora))
    }
    if (novo === 'feito' && t.tipo === 'ligacao' && t.participante_id) {
      eventos.push({ participante_id: t.participante_id, tipo: 'ligacao', tarefa_id: t.id, ocorrido_em: agora })
    }
  }
  return { update, eventos }
}

/** "Respondeu": conclui a tarefa e registra a resposta com a categoria escolhida. */
export function efeitosResposta(
  t: TarefaCiclo,
  r: { categoria: EventoCategoria | null; nota: string | null; marcarImplementou: boolean },
  agora: string,
): Efeitos {
  if (!t.participante_id) throw new Error('Tarefa sem participante não recebe resposta.')
  const update: TarefaUpdate = { status: 'feito', respondido_em: agora }
  const eventos: EventoInsert[] = []
  if (!t.enviado_em && geraEnvio(t)) {
    // Respondeu sem ter marcado "Enviei": registra o envio no mesmo instante, para não perder o histórico.
    update.enviado_em = agora
    eventos.push(...eventosDeEnvio(t, agora))
  }
  eventos.push({
    participante_id: t.participante_id,
    tipo: 'resposta_recebida',
    tarefa_id: t.id,
    categoria: r.categoria,
    nota: r.nota,
    ocorrido_em: agora,
  })
  if (r.marcarImplementou) {
    eventos.push({
      participante_id: t.participante_id,
      tipo: 'implementou',
      tarefa_id: t.id,
      nota: r.nota ? `Evidência: ${r.nota}` : 'Evidência enviada em resposta',
      ocorrido_em: agora,
    })
  }
  return { update, eventos }
}

/** "Encerrar sem resposta": conclui sem evento de resposta. */
export function efeitosEncerrarSemResposta(): Efeitos {
  return { update: { status: 'feito', resultado: 'sem resposta' }, eventos: [] }
}
