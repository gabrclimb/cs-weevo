import { PESOS } from './config'

type EventoMin = { tipo: string; ocorrido_em: string }

export type Pontuacao = {
  total: number
  implementou: number
  plantoes: number
  responsividade: number
  recencia: number
  grupo: number
  /** Dados brutos usados no cálculo, para exibir na decomposição. */
  detalhe: {
    presencas: number
    envios: number
    enviosRespondidos: number
    diasDesdeResposta: number | null
    interacoesGrupo: number
  }
}

const HORA = 3_600_000
const DIA = 24 * HORA

/** Pontuação de engajamento de 0 a 100 (seção 6.5). */
export function calcularPontuacao(
  participante: { implementou: boolean },
  eventos: EventoMin[],
  agora: Date = new Date(),
): Pontuacao {
  const t = (e: EventoMin) => new Date(e.ocorrido_em).getTime()
  const envios = eventos.filter((e) => e.tipo === 'mensagem_enviada').map(t)
  const respostas = eventos
    .filter((e) => e.tipo === 'resposta_recebida')
    .map(t)
    .sort((a, b) => a - b)
  const presencas = eventos.filter((e) => e.tipo === 'plantao_presenca').length
  const interacoesGrupo = eventos.filter((e) => e.tipo === 'interacao_grupo').length

  const janela = PESOS.janelaRespostaHoras * HORA
  const enviosRespondidos = envios.filter((envio) => respostas.some((r) => r >= envio && r - envio <= janela)).length

  const ultimaResposta = respostas.at(-1)
  const diasDesdeResposta =
    ultimaResposta === undefined ? null : Math.floor((agora.getTime() - ultimaResposta) / DIA)

  const implementou = participante.implementou ? PESOS.implementou : 0
  const plantoes = Math.min(presencas * PESOS.porPresenca, PESOS.tetoPlantoes)
  const responsividade = envios.length ? Math.round((enviosRespondidos / envios.length) * PESOS.responsividadeMax) : 0
  const recencia =
    diasDesdeResposta === null
      ? 0
      : diasDesdeResposta <= 7
        ? PESOS.recencia7Dias
        : diasDesdeResposta <= 14
          ? PESOS.recencia14Dias
          : 0
  const grupo = Math.min(interacoesGrupo * PESOS.porInteracaoGrupo, PESOS.tetoGrupo)

  return {
    total: implementou + plantoes + responsividade + recencia + grupo,
    implementou,
    plantoes,
    responsividade,
    recencia,
    grupo,
    detalhe: { presencas, envios: envios.length, enviosRespondidos, diasDesdeResposta, interacoesGrupo },
  }
}
