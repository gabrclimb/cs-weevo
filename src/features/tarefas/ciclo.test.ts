import { describe, expect, it } from 'vitest'
import { efeitosEncerrarSemResposta, efeitosMudancaStatus, efeitosResposta } from './ciclo'

const AGORA = '2026-10-02T15:00:00.000Z'
const base = {
  id: 't1',
  tipo: 'mensagem_privada' as const,
  status: 'a_fazer' as const,
  participante_id: 'p1',
  plantao_id: null,
  enviado_em: null,
}

describe('efeitosMudancaStatus', () => {
  it('"Enviei": aguardando_resposta grava enviado_em e cria mensagem_enviada', () => {
    const e = efeitosMudancaStatus(base, 'aguardando_resposta', AGORA)
    expect(e.update).toEqual({ status: 'aguardando_resposta', enviado_em: AGORA })
    expect(e.eventos).toEqual([{ participante_id: 'p1', tipo: 'mensagem_enviada', tarefa_id: 't1', ocorrido_em: AGORA }])
  })

  it('"Enviei e concluí": feito direto também registra envio', () => {
    const e = efeitosMudancaStatus(base, 'feito', AGORA)
    expect(e.update.enviado_em).toBe(AGORA)
    expect(e.eventos.map((x) => x.tipo)).toEqual(['mensagem_enviada'])
  })

  it('não duplica envio de tarefa já enviada', () => {
    const e = efeitosMudancaStatus({ ...base, status: 'aguardando_resposta', enviado_em: AGORA }, 'feito', AGORA)
    expect(e.eventos).toEqual([])
    expect(e.update).toEqual({ status: 'feito' })
  })

  it('contato pós-plantão gera também plantao_ausencia_contatada', () => {
    const e = efeitosMudancaStatus({ ...base, plantao_id: 'pl1' }, 'aguardando_resposta', AGORA)
    expect(e.eventos.map((x) => x.tipo)).toEqual(['mensagem_enviada', 'plantao_ausencia_contatada'])
    expect(e.eventos[1].plantao_id).toBe('pl1')
  })

  it('tarefa de turma ou interna não gera evento', () => {
    expect(efeitosMudancaStatus({ ...base, participante_id: null }, 'feito', AGORA).eventos).toEqual([])
    expect(efeitosMudancaStatus({ ...base, tipo: 'interna' }, 'feito', AGORA).eventos).toEqual([])
  })

  it('ligação concluída gera evento ligacao', () => {
    const e = efeitosMudancaStatus({ ...base, tipo: 'ligacao' }, 'feito', AGORA)
    expect(e.eventos.map((x) => x.tipo)).toEqual(['ligacao'])
  })

  it('voltar para a_fazer não gera evento', () => {
    expect(efeitosMudancaStatus({ ...base, status: 'em_andamento' }, 'a_fazer', AGORA).eventos).toEqual([])
  })
})

describe('efeitosResposta', () => {
  it('conclui, grava respondido_em e cria resposta com categoria', () => {
    const e = efeitosResposta(
      { ...base, status: 'aguardando_resposta', enviado_em: '2026-10-01T10:00:00Z' },
      { categoria: 'duvida_tecnica', nota: 'travou no passo 2', marcarImplementou: false },
      AGORA,
    )
    expect(e.update).toEqual({ status: 'feito', respondido_em: AGORA })
    expect(e.eventos).toEqual([
      {
        participante_id: 'p1',
        tipo: 'resposta_recebida',
        tarefa_id: 't1',
        categoria: 'duvida_tecnica',
        nota: 'travou no passo 2',
        ocorrido_em: AGORA,
      },
    ])
  })

  it('evidência com implementou cria evento implementou', () => {
    const e = efeitosResposta(
      { ...base, enviado_em: AGORA },
      { categoria: 'evidencia_implementacao', nota: 'print do fluxo', marcarImplementou: true },
      AGORA,
    )
    expect(e.eventos.map((x) => x.tipo)).toEqual(['resposta_recebida', 'implementou'])
    expect(e.eventos[1].nota).toBe('Evidência: print do fluxo')
  })

  it('resposta sem "Enviei" prévio registra o envio junto', () => {
    const e = efeitosResposta(base, { categoria: null, nota: null, marcarImplementou: false }, AGORA)
    expect(e.eventos.map((x) => x.tipo)).toEqual(['mensagem_enviada', 'resposta_recebida'])
  })
})

describe('efeitosEncerrarSemResposta', () => {
  it('feito com resultado "sem resposta" e sem eventos', () => {
    expect(efeitosEncerrarSemResposta()).toEqual({ update: { status: 'feito', resultado: 'sem resposta' }, eventos: [] })
  })
})
