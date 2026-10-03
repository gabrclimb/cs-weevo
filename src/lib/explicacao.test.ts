import { describe, expect, it } from 'vitest'
import { explicarPontuacao } from './explicacao'
import { calcularPontuacao } from './pontuacao'

let seq = 0
const ev = (tipo: string, iso: string, extra: { plantao_id?: string; nota?: string } = {}) => ({
  id: `e${++seq}`,
  tipo,
  ocorrido_em: iso,
  ...extra,
})

describe('explicarPontuacao', () => {
  const eventos = [
    ev('mensagem_enviada', '2026-10-05T10:00:00Z'),
    ev('resposta_recebida', '2026-10-09T10:00:00Z'), // 96h: fora da janela
    ev('mensagem_enviada', '2026-10-01T10:00:00Z'),
    ev('resposta_recebida', '2026-10-02T10:00:00Z'), // 24h: conta
    ev('mensagem_enviada', '2026-10-15T10:00:00Z'), // sem resposta
    ev('plantao_presenca', '2026-10-03T19:00:00Z', { plantao_id: 'pl1' }),
    ev('interacao_grupo', '2026-10-04T12:00:00Z', { nota: 'compartilhou o projeto' }),
    ev('implementou', '2026-10-10T12:00:00Z', { nota: 'Evidência: print' }),
  ]
  const x = explicarPontuacao(eventos)

  it('ordena envios e casa cada um com a primeira resposta seguinte', () => {
    expect(x.envios.map((e) => [e.em.slice(0, 10), e.horasAteResposta, e.contou])).toEqual([
      ['2026-10-01', 24, true],
      ['2026-10-05', 96, false],
      ['2026-10-15', null, false],
    ])
  })

  it('traz última resposta, presenças, interações e evidência', () => {
    expect(x.ultimaResposta).toBe('2026-10-09T10:00:00Z')
    expect(x.presencas).toEqual([{ id: expect.any(String), plantaoId: 'pl1', em: '2026-10-03T19:00:00Z' }])
    expect(x.interacoes[0].nota).toBe('compartilhou o projeto')
    expect(x.implementou).toEqual({ em: '2026-10-10T12:00:00Z', nota: 'Evidência: print' })
  })

  it('bate com calcularPontuacao: envios que contaram = enviosRespondidos', () => {
    const p = calcularPontuacao({ implementou: true }, eventos, new Date('2026-10-20T12:00:00Z'))
    expect(x.envios.filter((e) => e.contou).length).toBe(p.detalhe.enviosRespondidos)
    expect(x.envios.length).toBe(p.detalhe.envios)
    expect(x.presencas.length).toBe(p.detalhe.presencas)
    expect(x.interacoes.length).toBe(p.detalhe.interacoesGrupo)
  })

  it('uma resposta pode cobrir dois envios seguidos', () => {
    const y = explicarPontuacao([
      ev('mensagem_enviada', '2026-10-01T10:00:00Z'),
      ev('mensagem_enviada', '2026-10-02T10:00:00Z'),
      ev('resposta_recebida', '2026-10-02T12:00:00Z'),
    ])
    expect(y.envios.map((e) => e.contou)).toEqual([true, true])
    const p = calcularPontuacao({ implementou: false }, [
      ev('mensagem_enviada', '2026-10-01T10:00:00Z'),
      ev('mensagem_enviada', '2026-10-02T10:00:00Z'),
      ev('resposta_recebida', '2026-10-02T12:00:00Z'),
    ])
    expect(p.detalhe.enviosRespondidos).toBe(2)
  })
})
