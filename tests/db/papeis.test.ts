import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarCliente, type ClienteDb } from './cliente'
import { transacao, type Transacao } from './transacao'
import { criarUsuario } from './usuarios'

let db: ClienteDb

beforeAll(async () => {
  db = await criarCliente()
})
afterAll(() => db?.close())

async function temPapel(tx: Transacao, minimo: string): Promise<boolean> {
  const [r] = await tx.query<{ ok: boolean }>(`select public.tem_papel($1) as ok`, [minimo])
  return r.ok
}

describe('tem_papel', () => {
  it('cs ativo passa no nível cs e não no revisor', async () => {
    await transacao(db, async (tx) => {
      const cs = await criarUsuario(tx, 'cs')
      await tx.como('authenticated', cs)
      expect(await temPapel(tx, 'cs')).toBe(true)
      expect(await temPapel(tx, 'revisor')).toBe(false)
    })
  })
})
