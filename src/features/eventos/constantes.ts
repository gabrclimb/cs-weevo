import {
  CalendarCheck,
  CalendarX,
  CheckCircle2,
  Handshake,
  MessageCircleReply,
  MessagesSquare,
  Phone,
  Rocket,
  Send,
  StickyNote,
  type LucideIcon,
} from 'lucide-react'
import type { EventoCategoria, EventoTipo } from '@/lib/tipos'

export const EVENTO: Record<EventoTipo, { label: string; icone: LucideIcon; cor: string }> = {
  mensagem_enviada: { label: 'Mensagem enviada', icone: Send, cor: 'text-sky-600 bg-sky-50' },
  resposta_recebida: { label: 'Resposta recebida', icone: MessageCircleReply, cor: 'text-emerald-600 bg-emerald-50' },
  ligacao: { label: 'Ligação', icone: Phone, cor: 'text-sky-600 bg-sky-50' },
  plantao_presenca: { label: 'Presença em plantão', icone: CalendarCheck, cor: 'text-primary bg-primary/10' },
  plantao_ausencia_contatada: { label: 'Contato pós-ausência no plantão', icone: CalendarX, cor: 'text-amber-600 bg-amber-50' },
  interacao_grupo: { label: 'Interação no grupo', icone: MessagesSquare, cor: 'text-violet-600 bg-violet-50' },
  implementou: { label: 'Implementou', icone: Rocket, cor: 'text-emerald-700 bg-emerald-50' },
  status_alterado: { label: 'Status alterado', icone: CheckCircle2, cor: 'text-muted-foreground bg-muted' },
  repassado_comercial: { label: 'Repassado ao comercial', icone: Handshake, cor: 'text-violet-700 bg-violet-50' },
  nota: { label: 'Nota', icone: StickyNote, cor: 'text-muted-foreground bg-muted' },
}

export const CATEGORIA: Record<EventoCategoria, string> = {
  confirmou: 'Confirmou ou agradeceu',
  duvida_tecnica: 'Dúvida técnica ou travou',
  evidencia_implementacao: 'Mandou evidência de implementação',
  interesse_continuar: 'Interesse em continuar ou na Weevo Start',
  sinal_desistencia: 'Sinal de desistência, preço ou reclamação',
  so_conversa: 'Só conversa',
}

export const CATEGORIA_KEYS = Object.keys(CATEGORIA) as EventoCategoria[]
