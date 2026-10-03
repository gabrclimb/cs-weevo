import { format, parse } from 'date-fns'

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export type ContextoPlaceholder = {
  nome?: string | null
  turma?: string | null
  plantaoData?: string | null
  plantaoHorario?: string | null
}

const MAPA: Record<string, keyof ContextoPlaceholder> = {
  nome: 'nome',
  turma: 'turma',
  plantao_data: 'plantaoData',
  plantao_horario: 'plantaoHorario',
}

/** Substitui [nome], [turma], [plantao_data], [plantao_horario]. Sem valor, mantém o placeholder. */
export function preencherPlaceholders(texto: string, ctx: ContextoPlaceholder): string {
  return texto.replace(/\[(\w+)\]/g, (original, chave: string) => {
    const campo = MAPA[chave.toLowerCase()]
    const valor = campo ? ctx[campo] : null
    return valor ? valor : original
  })
}

/** Placeholders que ficaram sem valor no texto. */
export function placeholdersPendentes(texto: string): string[] {
  return [...new Set([...texto.matchAll(/\[(\w+)\]/g)].map((m) => m[0]))]
}

/** Próximo plantão não realizado (menor número com data), formatado para os placeholders. */
export function proximoPlantao(
  plantoes: { numero: number; data: string | null; horario: string | null; realizado: boolean }[],
): { plantaoData: string | null; plantaoHorario: string | null } {
  const proximo = plantoes
    .filter((p) => !p.realizado && p.data)
    .sort((a, b) => a.numero - b.numero)[0]
  if (!proximo?.data) return { plantaoData: null, plantaoHorario: null }
  const data = parse(proximo.data, 'yyyy-MM-dd', new Date())
  return {
    plantaoData: `${format(data, 'dd/MM')} (${DIAS[data.getDay()]})`,
    plantaoHorario: proximo.horario ? proximo.horario.slice(0, 5) : null,
  }
}
