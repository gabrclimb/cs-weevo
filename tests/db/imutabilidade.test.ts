import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cenarioEncontro, registrar, veioCompleto, type Cenario } from './cenarios'
import { criarCliente, type ClienteDb } from './cliente'
import { transacao, type Transacao } from './transacao'

let db: ClienteDb

beforeAll(async () => {
  db = await criarCliente()
})
afterAll(() => db?.close())

/** Cenário com um "Veio" registrado pelo CS A; volta como postgres. */
async function comRegistro(tx: Transacao): Promise<Cenario & { registro: string }> {
  const c = await cenarioEncontro(tx)
  const dados = await veioCompleto(tx, c)
  await tx.como('authenticated', c.csA)
  const { erro, linhas } = await registrar(tx, dados)
  expect(erro).toBeNull()
  await tx.comoPostgres()
  return { ...c, registro: linhas[0].id }
}

describe('registros não se alteram nem se apagam', () => {
  const ALTERACOES = [
    ['update do registro', `update public.registros_encontro set feito = 'outra coisa' where id = $1`],
    ['delete do registro', `delete from public.registros_encontro where id = $1`],
    ['update dos temas', `update public.registro_temas set tema_id = tema_id where registro_id = $1`],
    ['delete dos temas', `delete from public.registro_temas where registro_id = $1`],
  ] as const

  it.each(['cs', 'revisor', 'admin'] as const)('%s (authenticated) não altera nada', async (papel) => {
    await transacao(db, async (tx) => {
      const c = await comRegistro(tx)
      await tx.como('authenticated', { cs: c.csA, revisor: c.revisor, admin: c.admin }[papel])
      for (const [nome, sql] of ALTERACOES) expect((await tx.erro(sql, [c.registro])) ?? 'sem erro', nome).toMatch(/permission denied/)
    })
  })

  it.each(['service_role', 'postgres'] as const)('%s também não altera nada', async (papel) => {
    await transacao(db, async (tx) => {
      const c = await comRegistro(tx)
      if (papel === 'service_role') await tx.como('service_role')
      for (const [nome, sql] of ALTERACOES) expect((await tx.erro(sql, [c.registro])) ?? 'sem erro', nome).toMatch(/não se alteram nem se apagam/)
    })
  })
})
