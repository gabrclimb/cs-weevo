import { createFileRoute, redirect } from '@tanstack/react-router'

// Pontuações foi unificada com o Ranking na página Engajamento; links antigos continuam funcionando.
export const Route = createFileRoute('/_app/pontuacoes')({
  validateSearch: (s: Record<string, unknown>): { turma?: string; q?: string; ordem?: 'nome' } => ({
    turma: typeof s.turma === 'string' && s.turma ? s.turma : undefined,
    q: typeof s.q === 'string' && s.q ? s.q : undefined,
    ordem: s.ordem === 'nome' ? 'nome' : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/engajamento', search, replace: true })
  },
})
