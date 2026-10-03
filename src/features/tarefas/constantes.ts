import { ClipboardList, MessageSquare, MessagesSquare, Phone, CalendarDays, type LucideIcon } from 'lucide-react'
import type { TarefaRow } from '@/lib/database.types'

export type StatusTarefa = TarefaRow['status']
export type TipoTarefa = TarefaRow['tipo']

export const STATUS_TAREFA: Record<StatusTarefa, { label: string; coluna: string; ponto: string }> = {
  a_fazer: { label: 'A fazer', coluna: 'bg-muted', ponto: 'bg-muted-foreground' },
  em_andamento: { label: 'Em andamento', coluna: 'bg-amber-50', ponto: 'bg-amber-500' },
  aguardando_resposta: { label: 'Aguardando resposta', coluna: 'bg-violet-50', ponto: 'bg-violet-500' },
  feito: { label: 'Feito', coluna: 'bg-emerald-50', ponto: 'bg-emerald-500' },
}
export const STATUS_TAREFA_KEYS = Object.keys(STATUS_TAREFA) as StatusTarefa[]

export const TIPO_TAREFA: Record<TipoTarefa, { label: string; icone: LucideIcon }> = {
  mensagem_privada: { label: 'Mensagem privada', icone: MessageSquare },
  conteudo_grupo: { label: 'Conteúdo no grupo', icone: MessagesSquare },
  plantao: { label: 'Plantão', icone: CalendarDays },
  ligacao: { label: 'Ligação', icone: Phone },
  interna: { label: 'Interna', icone: ClipboardList },
}
export const TIPO_TAREFA_KEYS = Object.keys(TIPO_TAREFA) as TipoTarefa[]

export const CANAIS = ['WhatsApp privado', 'Grupo da turma', 'Ligação', 'E-mail', 'Presencial']
