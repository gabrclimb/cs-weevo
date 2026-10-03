import { ALERTAS } from './config'

const HORA = 3_600_000
const DIA = 24 * HORA

type EventoMin = { tipo: string; ocorrido_em: string }

export type AlertaParticipante = { tipo: 'sem_contato' | 'sem_resposta'; desde: string; dias: number }

/**
 * Alertas de um participante (seção 6.4). Participante inativo não gera alerta.
 * "Sem contato" sem nenhum envio conta a partir do cadastro.
 */
export function alertasParticipante(
  participante: { status: string; created_at: string },
  eventos: EventoMin[],
  agora: Date = new Date(),
): AlertaParticipante[] {
  if (participante.status === 'inativo') return []
  const alertas: AlertaParticipante[] = []
  const ms = (iso: string) => new Date(iso).getTime()
  const envios = eventos.filter((e) => e.tipo === 'mensagem_enviada').map((e) => e.ocorrido_em).sort()
  const respostas = eventos.filter((e) => e.tipo === 'resposta_recebida').map((e) => e.ocorrido_em).sort()

  const ultimoEnvio = envios.at(-1)
  const baseContato = ultimoEnvio ?? participante.created_at
  const diasSemContato = Math.floor((agora.getTime() - ms(baseContato)) / DIA)
  if (diasSemContato > ALERTAS.semContatoDias) {
    alertas.push({ tipo: 'sem_contato', desde: baseContato, dias: diasSemContato })
  }

  const ultimaResposta = respostas.at(-1)
  const enviosPendentes = envios.filter((e) => !ultimaResposta || ms(e) > ms(ultimaResposta))
  if (enviosPendentes.length) {
    const desde = ultimaResposta ?? enviosPendentes[0]
    const dias = Math.floor((agora.getTime() - ms(desde)) / DIA)
    if (dias > ALERTAS.semRespostaDias) alertas.push({ tipo: 'sem_resposta', desde, dias })
  }

  return alertas
}

/** Tarefa aguardando resposta há mais que o limite. */
export function aguardandoDemais(
  tarefa: { status: string; enviado_em: string | null },
  agora: Date = new Date(),
): boolean {
  if (tarefa.status !== 'aguardando_resposta' || !tarefa.enviado_em) return false
  return agora.getTime() - new Date(tarefa.enviado_em).getTime() > ALERTAS.aguardandoHoras * HORA
}

/** data_prevista anterior a hoje (data local, yyyy-MM-dd) e não concluída. */
export function tarefaAtrasada(tarefa: { status: string; data_prevista: string | null }, hoje: string): boolean {
  return !!tarefa.data_prevista && tarefa.data_prevista < hoje && tarefa.status !== 'feito'
}
