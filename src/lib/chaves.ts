// Chaves do cache do TanStack Query. Prefixos compartilhados permitem invalidar em grupo.
export const chaves = {
  turmas: ['turmas'] as const,
  plantoes: ['plantoes'] as const,
  participantes: ['participantes'] as const,
  participante: (id: string) => ['participantes', id] as const,
  eventos: ['eventos'] as const,
  eventosDe: (participanteId: string) => ['eventos', participanteId] as const,
  tarefas: ['tarefas'] as const,
  templates: ['templates'] as const,
}
