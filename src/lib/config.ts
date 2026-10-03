// Parâmetros de negócio ajustáveis (seções 6.4 e 6.5 da especificação).

export const ALERTAS = {
  /** Tarefa em "aguardando resposta" há mais que isso gera alerta. */
  aguardandoHoras: 48,
  /** Participante sem mensagem enviada há mais que isso. */
  semContatoDias: 10,
  /** Participante sem resposta há mais que isso (com envio após a última resposta). */
  semRespostaDias: 10,
}

// Heurística inicial (nível D). Revisar comparando quem assinou com quem recusou.
export const PESOS = {
  implementou: 35,
  porPresenca: 8,
  tetoPlantoes: 25,
  responsividadeMax: 20,
  janelaRespostaHoras: 72,
  recencia7Dias: 10,
  recencia14Dias: 5,
  porInteracaoGrupo: 3,
  tetoGrupo: 10,
}

/** Faixas de cor da pontuação: verde a partir de `alta`, amarelo a partir de `media`. */
export const FAIXAS_PONTUACAO = { alta: 60, media: 30 }
