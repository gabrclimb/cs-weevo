// Escrito à mão espelhando supabase/migrations/20261002120000_base.sql.
// Substituir pela saída de `pnpm db:types` assim que houver SUPABASE_ACCESS_TOKEN.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Tabela<Row, Obrigatorios extends keyof Row> = {
  Row: Row
  Insert: Partial<Row> & Pick<Row, Obrigatorios>
  Update: Partial<Row>
  Relationships: []
}

export type TurmaRow = {
  id: string
  nome: string
  tipo: 'aberta' | 'in_company'
  data_imersao: string | null
  link_grupo: string | null
  ativa: boolean
  created_at: string
  updated_at: string
}

export type PlantaoRow = {
  id: string
  turma_id: string
  numero: number
  data: string | null
  horario: string | null
  formato: 'presencial' | 'online'
  link: string | null
  realizado: boolean
  observacoes: string | null
  created_at: string
  updated_at: string
}

export type ParticipanteStatus = 'ativo' | 'aguardando' | 'sem_resposta' | 'inativo'
export type WeevoStart = 'nao_avaliado' | 'candidato' | 'repassado_comercial' | 'cadastrado' | 'assinante' | 'recusou'

export type ParticipanteRow = {
  id: string
  nome: string
  apelido: string | null
  telefone: string | null
  empresa: string | null
  turma_id: string | null
  status: ParticipanteStatus
  weevo_start: WeevoStart
  implementou: boolean
  ultimo_contato_em: string | null
  ultima_resposta_em: string | null
  observacoes: string | null
  responsavel: string | null
  dia_escolhido: string | null
  cadastro_plataforma: string | null
  sistema: string | null
  dificuldades: string | null
  suporte_extra: string | null
  nps: string | null
  created_at: string
  updated_at: string
}

export type TarefaRow = {
  id: string
  titulo: string
  tipo: 'mensagem_privada' | 'conteudo_grupo' | 'plantao' | 'ligacao' | 'interna'
  status: 'a_fazer' | 'em_andamento' | 'aguardando_resposta' | 'feito'
  participante_id: string | null
  turma_id: string | null
  parent_id: string | null
  plantao_id: string | null
  para_quem: string | null
  data: string | null
  data_prevista: string | null
  horario: string | null
  canal: string | null
  objetivo: string | null
  mensagem: string | null
  enviado_em: string | null
  respondido_em: string | null
  resultado: string | null
  ordem: number
  import_key: string | null
  created_at: string
  updated_at: string
}

export type EventoTipo =
  | 'mensagem_enviada'
  | 'resposta_recebida'
  | 'ligacao'
  | 'plantao_presenca'
  | 'plantao_ausencia_contatada'
  | 'interacao_grupo'
  | 'implementou'
  | 'status_alterado'
  | 'repassado_comercial'
  | 'nota'

export type EventoCategoria =
  | 'confirmou'
  | 'duvida_tecnica'
  | 'evidencia_implementacao'
  | 'interesse_continuar'
  | 'sinal_desistencia'
  | 'so_conversa'

export type EventoRow = {
  id: string
  participante_id: string
  tipo: EventoTipo
  ocorrido_em: string
  tarefa_id: string | null
  plantao_id: string | null
  categoria: EventoCategoria | null
  nota: string | null
  origem: 'manual' | 'import' | 'webhook'
  created_at: string
}

export type TemplateCategoriaRow = { id: string; nome: string; ordem: number; created_at: string }

export type TemplateRow = {
  id: string
  category_id: string | null
  titulo: string
  conteudo: string
  ordem: number
  created_at: string
  updated_at: string
}

export type Database = {
  public: {
    Tables: {
      weevo_admins: Tabela<{ user_id: string; created_at: string }, 'user_id'>
      weevo_turmas: Tabela<TurmaRow, 'nome'>
      weevo_plantoes: Tabela<PlantaoRow, 'turma_id' | 'numero'>
      weevo_participantes: Tabela<ParticipanteRow, 'nome'>
      weevo_tarefas: Tabela<TarefaRow, 'titulo'>
      weevo_eventos: Tabela<EventoRow, 'participante_id' | 'tipo'>
      message_template_categories: Tabela<TemplateCategoriaRow, 'nome'>
      message_templates: Tabela<TemplateRow, 'titulo' | 'conteudo'>
    }
    Views: { [_ in never]: never }
    Functions: { is_admin: { Args: Record<string, never>; Returns: boolean } }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
