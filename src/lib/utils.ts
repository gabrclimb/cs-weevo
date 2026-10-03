import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNowStrict, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function dataHora(iso: string | null | undefined): string {
  return iso ? format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : ''
}

export function dataCurta(iso: string | null | undefined): string {
  return iso ? format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR }) : ''
}

export function haQuanto(iso: string | null | undefined): string {
  return iso ? `há ${formatDistanceToNowStrict(parseISO(iso), { locale: ptBR })}` : '—'
}

/** Data local de hoje (ou deslocada em dias) no formato yyyy-MM-dd. */
export function hojeISO(deslocamentoDias = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + deslocamentoDias)
  return format(d, 'yyyy-MM-dd')
}

/** Mensagem amigável para erros do Supabase/Postgres. */
export function mensagemErro(erro: { code?: string; message?: string } | null | undefined): string {
  if (!erro) return 'Erro desconhecido.'
  if (erro.code === '23505') return 'Já existe um registro com esse valor (telefone ou nome duplicado).'
  if (erro.code === '42501') return 'Você não tem permissão para esta ação.'
  // Detalhe técnico só no console; na tela, mensagem genérica.
  console.error(erro)
  return 'Não foi possível concluir a ação. Tente novamente.'
}
