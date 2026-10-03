// Textos das dicas (tooltips e ajudas de formulário). Usam os mesmos parâmetros do cálculo para nunca divergir da regra.
import type { ParticipanteStatus, WeevoStart } from '@/lib/database.types'
import type { StatusTarefa, TipoTarefa } from '@/features/tarefas/constantes'
import { ALERTAS, FAIXAS_PONTUACAO, PESOS } from './config'

export const DICA_STATUS_PARTICIPANTE: Record<ParticipanteStatus, string> = {
  ativo: 'Participando normalmente do acompanhamento.',
  aguardando: 'Acompanhamento em espera: o próximo passo depende de um retorno combinado com o participante.',
  sem_resposta:
    'Parou de responder. O sistema sugere este status quando surge o alerta "Sem resposta", mas a mudança é sempre manual.',
  inativo:
    'Saiu do acompanhamento. Não gera alertas, não recebe tarefas geradas para a turma e fica fora da página Engajamento por padrão.',
}

export const DICA_WEEVO_START: Record<WeevoStart, string> = {
  nao_avaliado: 'Ainda não foi avaliado como possível assinante da Weevo Start.',
  candidato: 'Tem perfil para a Weevo Start, mas ainda não foi repassado ao comercial.',
  repassado_comercial: 'Já foi enviado ao comercial. Use o botão "Repassar" na página Engajamento para registrar o repasse.',
  cadastrado: 'Fez o cadastro na Weevo Start, mas ainda não assinou. Continua na página Engajamento.',
  assinante: 'Assinou a Weevo Start. Fica fora da página Engajamento por padrão.',
  recusou: 'Recusou a Weevo Start. Fica fora da página Engajamento por padrão.',
}

export const DICA_STATUS_TAREFA: Record<StatusTarefa, string> = {
  a_fazer: 'Ainda não começou.',
  em_andamento: 'Já começou, mas a mensagem ainda não foi enviada.',
  aguardando_resposta: `Mensagem enviada, esperando resposta. Mover uma mensagem privada para cá registra o envio na linha do tempo. Depois de ${ALERTAS.aguardandoHoras}h aparece em Hoje.`,
  feito: 'Concluída. Tarefas feitas ficam visíveis no quadro por 14 dias.',
}

export const DICA_TIPO_TAREFA: Record<TipoTarefa, string> = {
  mensagem_privada:
    'Mensagem no privado. Ao clicar em "Enviei", conta como mensagem enviada na pontuação. Para uma turma inteira, depois gere uma tarefa para cada participante.',
  conteudo_grupo: 'Conteúdo postado no grupo da turma. Não soma pontos para ninguém.',
  plantao: 'Algo ligado a um plantão: preparar, lembrar, conduzir.',
  ligacao: 'Ligação para o participante. Ao concluir, a ligação é registrada na linha do tempo.',
  interna: 'Tarefa da equipe, sem contato com participante.',
}

export const DICA_ALERTA = {
  sem_contato: `Nenhuma mensagem enviada há mais de ${ALERTAS.semContatoDias} dias. Se nunca recebeu mensagem, conta a partir do cadastro.`,
  sem_resposta: `Recebeu mensagem depois da última resposta e está há mais de ${ALERTAS.semRespostaDias} dias sem responder.`,
} as const

export const DICA_TIPO_TURMA = {
  aberta: 'Turma com inscrições abertas ao público.',
  in_company: 'Turma fechada, feita para uma empresa.',
} as const

export const DICA_FORMATO_PLANTAO = {
  online: 'Acontece por videochamada. Informe o link para ele aparecer na turma.',
  presencial: 'Acontece no local combinado com a turma.',
} as const

/** Explicação dos cabeçalhos de tabela e dos títulos das colunas do kanban. */
export const DICA_COLUNA = {
  nome: 'Clique no nome para abrir a ficha do participante.',
  turma: 'Turma da imersão de que o participante fez parte.',
  responsavel: 'Pessoa da equipe que acompanha o participante.',
  status: 'Situação do acompanhamento. Passe o mouse no status para ver o que significa.',
  weevoStart: 'Em que ponto o participante está em relação à assinatura da Weevo Start.',
  ultimoContato: 'Última mensagem enviada ou ligação feita para o participante.',
  ultimaResposta: 'Última vez que o participante respondeu. Também define a parte "Recência" da pontuação.',
  alertas: 'Quem precisa de atenção: sem contato ou sem resposta há muitos dias. Não mexe na pontuação.',
  pontuacao: `Engajamento de 0 a 100, calculado sozinho pelos registros da linha do tempo. Verde a partir de ${FAIXAS_PONTUACAO.alta}, amarelo a partir de ${FAIXAS_PONTUACAO.media}.`,
  presencas: `Plantões em que o participante esteve presente. Cada presença vale ${PESOS.porPresenca} pontos (até ${PESOS.tetoPlantoes}).`,
  implementou: `Se já colocou algo em uso. Vale ${PESOS.implementou} pontos, o maior peso.`,
  posicao: 'Posição no ranking. Em empate, vem antes quem respondeu mais recentemente.',
  imersao: 'Data da imersão presencial que deu origem à turma.',
  participantes: 'Quantidade de participantes nesta turma.',
  plantoesRealizados: 'Plantões já realizados, dos 4 previstos para a turma.',
  pontuacaoMedia: 'Média da pontuação dos participantes da turma.',
  gradePlantoes: 'Situação em cada um dos 4 plantões: veio, faltou, ainda não aconteceu ou não cadastrado.',
  pontoImplementou: `${PESOS.implementou} pontos se implementou, 0 se não.`,
  pontoPlantoes: `${PESOS.porPresenca} pontos por presença, até ${PESOS.tetoPlantoes}.`,
  pontoResposta: `Parte das mensagens respondidas em até ${PESOS.janelaRespostaHoras}h, vezes ${PESOS.responsividadeMax}.`,
  pontoRecencia: `${PESOS.recencia7Dias} pontos se respondeu nos últimos 7 dias, ${PESOS.recencia14Dias} se entre 8 e 14 dias, 0 depois disso.`,
  pontoGrupo: `${PESOS.porInteracaoGrupo} pontos por interação no grupo da turma, até ${PESOS.tetoGrupo}.`,
} as const

/** Colunas do kanban da tela Hoje. */
export const DICA_COLUNA_HOJE = {
  atrasadas: 'Tarefas com data prevista anterior a hoje que ainda não foram concluídas.',
  hoje: 'Tarefas com data prevista para hoje.',
  aguardando: `Mensagens enviadas há mais de ${ALERTAS.aguardandoHoras}h sem resposta. Vale cobrar ou encerrar.`,
  alerta: 'Participantes com alerta de sem contato ou sem resposta. Crie uma tarefa de contato com um clique.',
  plantoes: 'Plantões marcados para hoje e amanhã. Clique para abrir a lista de presença.',
} as const

/** Colunas do kanban de turmas. */
export const DICA_SITUACAO_TURMA = {
  ativa: 'Turma no período de suporte: participantes recebem acompanhamento.',
  encerrada: 'O período de suporte terminou. A turma continua no histórico.',
} as const
