import { createFileRoute, redirect } from '@tanstack/react-router'

// Ranking foi unificado com Pontuações na página Engajamento; links antigos continuam funcionando.
export const Route = createFileRoute('/_app/ranking')({
  validateSearch: (s: Record<string, unknown>): { turma?: string; todos?: boolean } => ({
    turma: typeof s.turma === 'string' && s.turma ? s.turma : undefined,
    todos: s.todos === true || s.todos === 'true' ? true : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/engajamento', search, replace: true })
  },
})
