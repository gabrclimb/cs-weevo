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

describe('sessões: mesmo encontro em vários horários (8.3)', () => {
  it('aceita o mesmo número em dias ou horários diferentes', async () => {
    await transacao(db, async (tx) => {
      const t = await turma(tx)
      for (const c of [
        { data: '2026-09-29', hora_inicio: '14:00' },
        { data: '2026-09-30', hora_inicio: '14:00' },
        { data: '2026-09-30', hora_inicio: '16:00' },
      ]) {
        expect((await sessao(tx, t, { tipo: 'regular', numero: 1, ...c })).erro).toBeNull()
      }
    })
  })

  it.each([
    ['com horário', { hora_inicio: '14:00' }],
    ['sem horário', {}],
  ])('rejeita a duplicata exata (%s)', async (_caso, extra) => {
    await transacao(db, async (tx) => {
      const t = await turma(tx)
      const campos = { tipo: 'regular', numero: 1, data: '2026-09-29', ...extra }
      expect((await sessao(tx, t, campos)).erro).toBeNull()
      expect((await sessao(tx, t, campos)).erro ?? 'sem erro').toMatch(/duplicate key/)
    })
  })
})

describe('quem cria e altera sessões', () => {
  async function como(tx: Transacao, papel: 'cs' | 'revisor' | 'admin') {
    await tx.como('authenticated', await criarUsuario(tx, papel))
  }

  it.each([
    ['cs', { regular: 'barrado', extra: 'gravou' }],
    ['revisor', { regular: 'gravou', extra: 'gravou' }],
    ['admin', { regular: 'gravou', extra: 'gravou' }],
  ] as const)('%s cria sessões', async (papel, esperado) => {
    await transacao(db, async (tx) => {
      const t = await turma(tx)
      await como(tx, papel)
      const regular = await sessao(tx, t, { tipo: 'regular', numero: 1 })
      const extra = await sessao(tx, t, { tipo: 'extra', repoe_numero: 1 })
      const r = (x: { erro: string | null; linhas: unknown[] }) => (x.erro ? (expect(x.erro).toMatch(/permission denied|row-level security/), 'barrado') : 'gravou')
      expect({ regular: r(regular), extra: r(extra) }).toEqual(esperado)
    })
  })

  it.each([
    ['cs', 0],
    ['revisor', 1],
  ] as const)('%s remarca a data de uma sessão (linhas alteradas: %s)', async (papel, n) => {
    await transacao(db, async (tx) => {
      const t = await turma(tx)
      const { linhas } = await sessao(tx, t, { tipo: 'regular', numero: 1 })
      await como(tx, papel)
      const { erro, linhas: alteradas } = await tx.resultado(`update public.sessoes set data = '2026-10-20' where id = $1 returning 1`, [linhas[0].id])
      if (erro) expect(erro).toMatch(/permission denied/)
      expect(erro ? 0 : alteradas.length).toBe(n)
    })
  })

  it('ninguém muda o status direto nem apaga sessão', async () => {
    await transacao(db, async (tx) => {
      const t = await turma(tx)
      const { linhas } = await sessao(tx, t, { tipo: 'regular', numero: 1 })
      await como(tx, 'admin')
      expect((await tx.erro(`update public.sessoes set status = 'realizada' where id = $1`, [linhas[0].id])) ?? 'sem erro').toMatch(/permission denied/)
      expect((await tx.erro(`delete from public.sessoes`)) ?? 'sem erro').toMatch(/permission denied/)
    })
  })

  it('membro ativo lê as sessões', async () => {
    await transacao(db, async (tx) => {
      const t = await turma(tx)
      await sessao(tx, t, { tipo: 'regular', numero: 1 })
      await como(tx, 'cs')
      expect(await tx.query(`select count(*)::int as n from public.sessoes`)).toEqual([{ n: 1 }])
    })
  })
})
