import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cenarioEncontro, registrar, veioCompleto } from './cenarios'
import { criarCliente, type ClienteDb } from './cliente'
import { transacao } from './transacao'

let db: ClienteDb

beforeAll(async () => {
  db = await criarCliente()
})
afterAll(() => db?.close())

describe('registrar_encontro', () => {
  it('"Veio" completo grava com quem registrou e quando, mesmo que o cliente mande outro autor', async () => {
    await transacao(db, async (tx) => {
      const c = await cenarioEncontro(tx)
      const dados = await veioCompleto(tx, c, { registrado_por: c.admin, registrado_em: '2020-01-01T00:00:00Z' })
      await tx.como('authenticated', c.csA)
      const { erro, linhas } = await registrar(tx, dados)
      expect(erro).toBeNull()
      const [r] = await tx.query<{ registrado_por: string; recente: boolean; origem: string; temas: number }>(
        `select registrado_por, registrado_em > now() - interval '1 minute' as recente, origem,
                (select count(*)::int from public.registro_temas t where t.registro_id = r.id) as temas
         from public.registros_encontro r where id = $1`,
        [linhas[0].id],
      )
      expect(r).toEqual({ registrado_por: c.csA, recente: true, origem: 'manual', temas: 2 })
    })
  })
})
