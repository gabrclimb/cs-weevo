import { PESOS } from './config'

type EventoExplicacao = {
  id: string
  tipo: string
  ocorrido_em: string
  plantao_id?: string | null
  nota?: string | null
}

export type EnvioExplicado = {
  id: string
  em: string
  /** Primeira resposta registrada depois deste envio (pode ser fora da janela). */
  respostaEm: string | null
  horasAteResposta: number | null
  /** Respondido dentro da janela: é o que conta na responsividade. */
  contou: boolean
}

export type Explicacao = {
  implementou: { em: string; nota: string | null } | null
  presencas: { id: string; plantaoId: string | null; em: string }[]
  envios: EnvioExplicado[]
  ultimaResposta: string | null
  interacoes: { id: string; em: string; nota: string | null }[]
}

const HORA = 3_600_000

/**
 * Registros que sustentam cada parte da pontuação (mesma regra de `calcularPontuacao`):
 * um envio conta como respondido se a primeira resposta depois dele chegou dentro da janela.
 */
export function explicarPontuacao(eventos: EventoExplicacao[]): Explicacao {
  const ms = (iso: string) => new Date(iso).getTime()
  const porData = [...eventos].sort((a, b) => ms(a.ocorrido_em) - ms(b.ocorrido_em))
  const respostas = porData.filter((e) => e.tipo === 'resposta_recebida')
  const janela = PESOS.janelaRespostaHoras * HORA

  const envios = porData
    .filter((e) => e.tipo === 'mensagem_enviada')
    .map((e): EnvioExplicado => {
      const resposta = respostas.find((r) => ms(r.ocorrido_em) >= ms(e.ocorrido_em))
      const diff = resposta ? ms(resposta.ocorrido_em) - ms(e.ocorrido_em) : null
      return {
        id: e.id,
        em: e.ocorrido_em,
        respostaEm: resposta?.ocorrido_em ?? null,
        horasAteResposta: diff === null ? null : Math.round(diff / HORA),
        contou: diff !== null && diff <= janela,
      }
    })

  const impl = porData.find((e) => e.tipo === 'implementou')

  return {
    implementou: impl ? { em: impl.ocorrido_em, nota: impl.nota ?? null } : null,
    presencas: porData
      .filter((e) => e.tipo === 'plantao_presenca')
      .map((e) => ({ id: e.id, plantaoId: e.plantao_id ?? null, em: e.ocorrido_em })),
    envios,
    ultimaResposta: respostas.at(-1)?.ocorrido_em ?? null,
    interacoes: porData
      .filter((e) => e.tipo === 'interacao_grupo')
      .map((e) => ({ id: e.id, em: e.ocorrido_em, nota: e.nota ?? null })),
  }
}
