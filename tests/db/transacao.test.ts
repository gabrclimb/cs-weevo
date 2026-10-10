import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarCliente, type ClienteDb } from './cliente'
import { transacao } from './transacao'

const USUARIO = '00000000-0000-4000-8000-000000000001'

let db: ClienteDb

beforeAll(async () => {
  db = await criarCliente()
})
afterAll(() => db?.close())

describe('transacao', () => {
  it('como authenticated, auth.uid() devolve o id do usuário', async () => {
    await transacao(db, async (tx) => {
      await tx.como('authenticated', USUARIO)
      const [r] = await tx.query(`select auth.uid() as uid, current_user as papel`)
      expect(r).toEqual({ uid: USUARIO, papel: 'authenticated' })
    })
  })

  it('como anon, auth.uid() é nulo', async () => {
    await transacao(db, async (tx) => {
      await tx.como('anon')
      const [r] = await tx.query(`select auth.uid() as uid, current_user as papel`)
      expect(r).toEqual({ uid: null, papel: 'anon' })
    })
  })

  it('desfaz tudo ao terminar', async () => {
    await transacao(db, async (tx) => {
      await tx.query(`insert into auth.users (id) values ($1)`, [USUARIO])
    })
    const rows = await db.query(`select 1 from auth.users where id = $1`, [USUARIO])
    expect(rows).toEqual([])
  })
})
