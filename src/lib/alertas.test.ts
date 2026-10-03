import { describe, expect, it } from 'vitest'
import { aguardandoDemais, alertasParticipante, tarefaAtrasada } from './alertas'

const AGORA = new Date('2026-10-20T12:00:00Z')
const ev = (tipo: string, iso: string) => ({ tipo, ocorrido_em: iso })
const ativo = { status: 'ativo', created_at: '2026-10-01T00:00:00Z' }

describe('alertasParticipante', () => {
  it('inativo nunca gera alerta', () => {
    expect(alertasParticipante({ ...ativo, status: 'inativo' }, [], AGORA)).toEqual([])
  })

  it('sem contato desde o cadastro quando nunca recebeu mensagem', () => {
    const a = alertasParticipante(ativo, [], AGORA)
    expect(a).toEqual([{ tipo: 'sem_contato', desde: ativo.created_at, dias: 19 }])
  })

  it('sem contato não dispara com envio recente', () => {
    expect(alertasParticipante(ativo, [ev('mensagem_enviada', '2026-10-15T12:00:00Z')], AGORA)).toEqual([])
  })

  it('sem resposta: envio após a última resposta há mais de 10 dias', () => {
    const a = alertasParticipante(
      ativo,
      [
        ev('resposta_recebida', '2026-10-02T12:00:00Z'),
        ev('mensagem_enviada', '2026-10-05T12:00:00Z'),
        ev('mensagem_enviada', '2026-10-15T12:00:00Z'),
      ],
      AGORA,
    )
    expect(a).toEqual([{ tipo: 'sem_resposta', desde: '2026-10-02T12:00:00Z', dias: 18 }])
  })

  it('sem resposta não dispara se a última ação foi resposta dele', () => {
    const a = alertasParticipante(
      ativo,
      [ev('mensagem_enviada', '2026-10-01T12:00:00Z'), ev('resposta_recebida', '2026-10-15T12:00:00Z')],
      AGORA,
    )
    expect(a.find((x) => x.tipo === 'sem_resposta')).toBeUndefined()
  })

  it('sem resposta conta do primeiro envio quando nunca respondeu', () => {
    const a = alertasParticipante(ativo, [ev('mensagem_enviada', '2026-10-05T12:00:00Z'), ev('mensagem_enviada', '2026-10-12T12:00:00Z')], AGORA)
    expect(a).toEqual([{ tipo: 'sem_resposta', desde: '2026-10-05T12:00:00Z', dias: 15 }])
  })
})

describe('aguardandoDemais', () => {
  it('só após 48h em aguardando_resposta', () => {
    expect(aguardandoDemais({ status: 'aguardando_resposta', enviado_em: '2026-10-18T11:00:00Z' }, AGORA)).toBe(true)
    expect(aguardandoDemais({ status: 'aguardando_resposta', enviado_em: '2026-10-18T13:00:00Z' }, AGORA)).toBe(false)
    expect(aguardandoDemais({ status: 'feito', enviado_em: '2026-10-01T00:00:00Z' }, AGORA)).toBe(false)
  })
})

describe('tarefaAtrasada', () => {
  it('data anterior a hoje e não feita', () => {
    expect(tarefaAtrasada({ status: 'a_fazer', data_prevista: '2026-10-19' }, '2026-10-20')).toBe(true)
    expect(tarefaAtrasada({ status: 'a_fazer', data_prevista: '2026-10-20' }, '2026-10-20')).toBe(false)
    expect(tarefaAtrasada({ status: 'feito', data_prevista: '2026-10-01' }, '2026-10-20')).toBe(false)
    expect(tarefaAtrasada({ status: 'a_fazer', data_prevista: null }, '2026-10-20')).toBe(false)
  })
})
