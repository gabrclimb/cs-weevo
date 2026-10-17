import { describe, expect, it } from 'vitest'
import type { ParticipanteRow } from '@/lib/tipos'
import { agrupar } from '@/features/participantes/agrupamentos'
import { aplicarPersonalizadas, type ColunaPersonalizadaRow, type Personalizadas } from './colunas'

const coluna = (c: Partial<ColunaPersonalizadaRow> & Pick<ColunaPersonalizadaRow, 'id' | 'quadro' | 'titulo'>): ColunaPersonalizadaRow => ({
  ordem: 0,
  created_at: '2026-10-17T12:00:00Z',
  ...c,
})

type Item = { id: string; status: string }
const nativas = [
  { chave: 'a_fazer', titulo: 'A fazer' },
  { chave: 'feito', titulo: 'Feito' },
]
const montar = (p: Personalizadas) =>
  aplicarPersonalizadas<Item>('tarefas', nativas, p, { id: (i) => i.id, valor: (i) => i.status })

describe('aplicarPersonalizadas', () => {
  const personalizadas: Personalizadas = {
    colunas: [
      coluna({ id: 'c2', quadro: 'tarefas', titulo: 'Bloqueada', ordem: 1 }),
      coluna({ id: 'c1', quadro: 'tarefas', titulo: 'Em revisão', ordem: 0 }),
      coluna({ id: 'outro', quadro: 'turmas.tipo', titulo: 'Parceria' }),
    ],
    cards: [{ quadro: 'tarefas', item_id: 't1', coluna_id: 'c1', valor_base: 'a_fazer', created_at: '' }],
  }

  it('põe as colunas criadas do quadro depois das fixas, na ordem', () => {
    expect(montar(personalizadas).colunas.map((c) => c.titulo)).toEqual(['A fazer', 'Feito', 'Em revisão', 'Bloqueada'])
  })

  it('marca só as colunas criadas como editáveis', () => {
    const { colunas } = montar(personalizadas)
    expect(colunas.filter((c) => c.editavel).map((c) => c.editavel!.id)).toEqual(['c1', 'c2'])
  })

  it('o item colocado numa coluna criada aparece nela', () => {
    const m = montar(personalizadas)
    expect(m.colunaDe({ id: 't1', status: 'a_fazer' })).toBe('c1')
    expect(m.personalizadaDe({ id: 't1', status: 'a_fazer' })?.titulo).toBe('Em revisão')
    expect(m.colunaDe({ id: 't2', status: 'a_fazer' })).toBe('a_fazer')
  })

  it('se o status mudou por outro caminho, o item volta para a coluna fixa', () => {
    const m = montar(personalizadas)
    expect(m.colunaDe({ id: 't1', status: 'feito' })).toBe('feito')
    expect(m.personalizadaDe({ id: 't1', status: 'feito' })).toBeUndefined()
  })
})

describe('agrupar participantes com colunas criadas', () => {
  const p = (dados: Partial<ParticipanteRow>) => ({ id: 'p1', status: 'ativo', responsavel: null, ...dados }) as ParticipanteRow

  it('no status, a coluna criada é uma coluna à parte', () => {
    const g = agrupar('status', [p({})], [], undefined, {
      colunas: [coluna({ id: 'c1', quadro: 'participantes.status', titulo: 'Negociando' })],
      cards: [{ quadro: 'participantes.status', item_id: 'p1', coluna_id: 'c1', valor_base: 'ativo', created_at: '' }],
    })
    expect(g.colunas.at(-1)?.titulo).toBe('Negociando')
    expect(g.colunaDe(p({}))).toBe('c1')
  })

  it('no responsável, a coluna criada é um valor novo; some como criada quando alguém o recebe', () => {
    const personalizadas: Personalizadas = {
      colunas: [
        coluna({ id: 'c1', quadro: 'participantes.responsavel', titulo: 'Bia' }),
        coluna({ id: 'c2', quadro: 'participantes.responsavel', titulo: 'Ana' }),
      ],
      cards: [],
    }
    const g = agrupar('responsavel', [p({ responsavel: 'Ana' })], [], undefined, personalizadas)
    expect(g.colunas.map((c) => [c.titulo, !!c.editavel])).toEqual([
      ['Sem responsável', false],
      ['Ana', false],
      ['Bia', true],
    ])
    // Soltar na coluna criada grava o valor no participante.
    expect(g.mudancaPara?.('Bia')).toEqual({ responsavel: 'Bia' })
  })
})
