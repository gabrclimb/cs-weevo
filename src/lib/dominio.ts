// Valores aceitos pelas colunas com CHECK no banco. Fonte única das uniões do front;
// tests/db/dominio.test.ts garante que batem com as migrations.

export const TIPOS_TURMA = ['aberta', 'in_company'] as const
export type TipoTurma = (typeof TIPOS_TURMA)[number]

export const FORMATOS_PLANTAO = ['presencial', 'online'] as const
export type FormatoPlantao = (typeof FORMATOS_PLANTAO)[number]

export const STATUS_PARTICIPANTE_KEYS = ['ativo', 'aguardando', 'sem_resposta', 'inativo'] as const
export type ParticipanteStatus = (typeof STATUS_PARTICIPANTE_KEYS)[number]

export const WEEVO_START_ETAPAS = ['nao_avaliado', 'candidato', 'repassado_comercial', 'cadastrado', 'assinante', 'recusou'] as const
export type WeevoStart = (typeof WEEVO_START_ETAPAS)[number]

export const TIPOS_TAREFA = ['mensagem_privada', 'conteudo_grupo', 'plantao', 'ligacao', 'interna'] as const
export type TipoTarefa = (typeof TIPOS_TAREFA)[number]

export const STATUS_TAREFA_VALORES = ['a_fazer', 'em_andamento', 'aguardando_resposta', 'feito'] as const
export type StatusTarefa = (typeof STATUS_TAREFA_VALORES)[number]

export const TIPOS_EVENTO = [
  'mensagem_enviada',
  'resposta_recebida',
  'ligacao',
  'plantao_presenca',
  'plantao_ausencia_contatada',
  'interacao_grupo',
  'implementou',
  'status_alterado',
  'repassado_comercial',
  'nota',
] as const
export type EventoTipo = (typeof TIPOS_EVENTO)[number]

export const CATEGORIAS_EVENTO = [
  'confirmou',
  'duvida_tecnica',
  'evidencia_implementacao',
  'interesse_continuar',
  'sinal_desistencia',
  'so_conversa',
] as const
export type EventoCategoria = (typeof CATEGORIAS_EVENTO)[number]

export const ORIGENS_EVENTO = ['manual', 'import', 'webhook'] as const
export type OrigemEvento = (typeof ORIGENS_EVENTO)[number]
