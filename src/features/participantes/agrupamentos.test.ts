import { describe, expect, it } from 'vitest'
import type { ParticipanteRow, TurmaRow } from '@/lib/tipos'
import { agrupar, lerAgrupamento } from './agrupamentos'

// Dados fictícios.
const p = (id: string, extra: Partial<ParticipanteRow> = {}) => ({ id, nome: id, status: 'ativo', weevo_start: 'nao_avaliado', turma_id: null, responsavel: null, dia_escolhido: null, cadastro_plataforma: null, ...extra }) as ParticipanteRow
const t = (id: string, nome: string, ativa = true) => ({ id, nome, ativa }) as TurmaRow

const participantes = [
  p('a', { responsavel: 'Ana', turma_id: 't1', status: 'inativo' }),
  p('b', { responsavel: 'Bruno ', turma_id: 't1' }),
  p('c', { responsavel: 'Ana' }),
  p('d'),
]
const turmas = [t('t2', 'Outubro'), t('t1', 'Agosto'), t('t3', 'Antiga', false)]

describe('agrupar', () => {
  it('status: colunas fixas e mudança do campo', () => {
    const g = agrupar('status', participantes, turmas)
    expect(g.colunas.map((c) => c.chave)).toEqual(['ativo', 'aguardando', 'sem_resposta', 'inativo'])
    expect(g.colunaDe(participantes[0])).toBe('inativo')
    expect(g.mudancaPara!('sem_resposta')).toEqual({ status: 'sem_resposta' })
    expect(g.colunas[0].ponto).toBe('bg-emerald-500')
  })

  it('responsável: uma coluna por valor, mais "Sem responsável", sem espaços sobrando', () => {
    const g = agrupar('responsavel', participantes, turmas)
    expect(g.colunas.map((c) => c.titulo)).toEqual(['Sem responsável', 'Ana', 'Bruno'])
    expect(g.colunaDe(participantes[1])).toBe('Bruno')
    expect(g.colunaDe(participantes[3])).toBe(g.colunas[0].chave)
    expect(g.mudancaPara!('Ana')).toEqual({ responsavel: 'Ana' })
    expect(g.mudancaPara!(g.colunas[0].chave)).toEqual({ responsavel: null })
  })

  it('turma: ativas em ordem alfabética, encerradas só se tiverem gente', () => {
    const g = agrupar('turma', participantes, turmas)
    expect(g.colunas.map((c) => c.titulo)).toEqual(['Sem turma', 'Agosto', 'Outubro'])
    expect(g.mudancaPara!('t2')).toEqual({ turma_id: 't2' })
    expect(g.mudancaPara!(g.colunas[0].chave)).toEqual({ turma_id: null })
  })
})

describe('agrupar por faixa', () => {
  it('separa por faixa de pontuação e não permite arrastar', () => {
    const totais: Record<string, number> = { a: 80, b: 60, c: 59, d: 0 }
    const g = agrupar('faixa', participantes, turmas, (p) => totais[p.id])
    expect(g.colunas.map((c) => c.chave)).toEqual(['alta', 'media', 'baixa'])
    expect(participantes.map(g.colunaDe)).toEqual(['alta', 'alta', 'media', 'baixa'])
    expect(g.mudancaPara).toBeUndefined()
  })
})

describe('lerAgrupamento', () => {
  it('aceita só agrupamentos conhecidos', () => {
    expect(lerAgrupamento('weevo_start')).toBe('weevo_start')
    expect(lerAgrupamento('qualquer')).toBeUndefined()
  })
})
