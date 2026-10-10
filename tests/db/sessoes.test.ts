import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarCliente, type ClienteDb } from './cliente'
import { transacao, type Transacao } from './transacao'
import { criarUsuario } from './usuarios'

let db: ClienteDb

beforeAll(async () => {
  db = await criarCliente()
})
afterAll(() => db?.close())

async function turma(tx: Transacao, nome = 'Turma Sessões') {
  const [t] = await tx.query<{ id: string }>(`insert into public.turmas (nome, tipo, modelo_suporte) values ($1, 'aberta', 'plantao') returning id`, [nome])
  return t.id
}

const sessao = (tx: Transacao, turmaId: string, campos: Record<string, unknown>) => {
  const todos = { turma_id: turmaId, data: '2026-10-15', formato: 'online', ...campos }
  const cols = Object.keys(todos)
  return tx.resultado<{ id: string }>(
    `insert into public.sessoes (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
    Object.values(todos),
  )
}

describe('sessões: regular x extra', () => {
  it.each([
    ['regular com número', { tipo: 'regular', numero: 1 }, true],
    ['regular sem número', { tipo: 'regular' }, false],
    ['regular que repõe', { tipo: 'regular', numero: 2, repoe_numero: 1 }, false],
    ['extra sem número', { tipo: 'extra' }, true],
    ['extra que repõe o encontro 2', { tipo: 'extra', repoe_numero: 2 }, true],
    ['extra com número', { tipo: 'extra', numero: 3 }, false],
    ['número zero', { tipo: 'regular', numero: 0 }, false],
    ['fim antes do início', { tipo: 'regular', numero: 1, hora_inicio: '16:00', hora_fim: '14:00' }, false],
  ])('%s', async (_caso, campos, aceita) => {
    await transacao(db, async (tx) => {
      const { erro } = await sessao(tx, await turma(tx), campos)
      if (aceita) expect(erro).toBeNull()
      else expect(erro ?? 'sem erro').toMatch(/check constraint/)
    })
  })
})
