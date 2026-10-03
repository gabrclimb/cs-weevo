import { describe, expect, it } from 'vitest'
import { calcularPontuacao } from './pontuacao'

const AGORA = new Date('2026-10-20T12:00:00Z')
const ev = (tipo: string, iso: string) => ({ tipo, ocorrido_em: iso })

describe('calcularPontuacao', () => {
  it('zero sem eventos', () => {
    const p = calcularPontuacao({ implementou: false }, [], AGORA)
    expect(p.total).toBe(0)
    expect(p.detalhe.diasDesdeResposta).toBeNull()
  })

  it('implementou vale 35', () => {
    expect(calcularPontuacao({ implementou: true }, [], AGORA).implementou).toBe(35)
  })

  it('plantões: 8 por presença com teto 25', () => {
    const pres = (n: number) => Array.from({ length: n }, () => ev('plantao_presenca', '2026-10-01T10:00:00Z'))
    expect(calcularPontuacao({ implementou: false }, pres(1), AGORA).plantoes).toBe(8)
    expect(calcularPontuacao({ implementou: false }, pres(3), AGORA).plantoes).toBe(24)
    expect(calcularPontuacao({ implementou: false }, pres(4), AGORA).plantoes).toBe(25)
  })

  it('responsividade: % de envios respondidos em até 72h', () => {
    const p = calcularPontuacao(
      { implementou: false },
      [
        ev('mensagem_enviada', '2026-10-01T10:00:00Z'),
        ev('resposta_recebida', '2026-10-02T10:00:00Z'), // 24h: conta
        ev('mensagem_enviada', '2026-10-05T10:00:00Z'),
        ev('resposta_recebida', '2026-10-09T10:00:00Z'), // 96h: não conta
      ],
      AGORA,
    )
    expect(p.detalhe.enviosRespondidos).toBe(1)
    expect(p.responsividade).toBe(10)
  })

  it('resposta antes do envio não conta', () => {
    const p = calcularPontuacao(
      { implementou: false },
      [ev('resposta_recebida', '2026-10-01T09:00:00Z'), ev('mensagem_enviada', '2026-10-01T10:00:00Z')],
      AGORA,
    )
    expect(p.responsividade).toBe(0)
  })

  it('recência: 10 até 7 dias, 5 entre 8 e 14, 0 depois', () => {
    const r = (iso: string) => calcularPontuacao({ implementou: false }, [ev('resposta_recebida', iso)], AGORA).recencia
    expect(r('2026-10-15T12:00:00Z')).toBe(10)
    expect(r('2026-10-13T12:00:00Z')).toBe(10) // 7 dias
    expect(r('2026-10-10T12:00:00Z')).toBe(5)
    expect(r('2026-10-01T12:00:00Z')).toBe(0)
  })

  it('grupo: 3 por interação com teto 10', () => {
    const g = (n: number) =>
      calcularPontuacao(
        { implementou: false },
        Array.from({ length: n }, () => ev('interacao_grupo', '2026-10-01T10:00:00Z')),
        AGORA,
      ).grupo
    expect(g(2)).toBe(6)
    expect(g(4)).toBe(10)
  })

  it('total máximo é 100', () => {
    const eventos = [
      ...Array.from({ length: 4 }, () => ev('plantao_presenca', '2026-10-01T10:00:00Z')),
      ev('mensagem_enviada', '2026-10-18T10:00:00Z'),
      ev('resposta_recebida', '2026-10-18T11:00:00Z'),
      ...Array.from({ length: 4 }, () => ev('interacao_grupo', '2026-10-01T10:00:00Z')),
    ]
    expect(calcularPontuacao({ implementou: true }, eventos, AGORA).total).toBe(100)
  })
})
