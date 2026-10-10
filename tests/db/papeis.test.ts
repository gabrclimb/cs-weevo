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

  it.each([
    ['revisor', { cs: true, revisor: true, admin: false }],
    ['admin', { cs: true, revisor: true, admin: true }],
  ] as const)('%s passa nos níveis de baixo', async (papel, esperado) => {
    await transacao(db, async (tx) => {
      const id = await criarUsuario(tx, papel)
      await tx.como('authenticated', id)
      for (const [nivel, ok] of Object.entries(esperado)) {
        expect(await temPapel(tx, nivel), nivel).toBe(ok)
      }
    })
  })

  it('perfil inativo não passa em nenhum nível', async () => {
    await transacao(db, async (tx) => {
      const id = await criarUsuario(tx, 'admin', { ativo: false })
      await tx.como('authenticated', id)
      for (const nivel of ['cs', 'revisor', 'admin']) expect(await temPapel(tx, nivel), nivel).toBe(false)
    })
  })

  it('sem login, não passa', async () => {
    await transacao(db, async (tx) => {
      await tx.como('authenticated')
      expect(await temPapel(tx, 'cs')).toBe(false)
    })
  })
})

describe('usuário novo', () => {
  it('ganha perfil cs inativo, com nome do e-mail', async () => {
    await transacao(db, async (tx) => {
      const [u] = await tx.query<{ id: string }>(`insert into auth.users (id, email) values (gen_random_uuid(), 'fulana.teste@exemplo.invalid') returning id`)
      expect(await tx.query(`select nome, papel, ativo from public.perfis where user_id = $1`, [u.id])).toEqual([
        { nome: 'fulana.teste', papel: 'cs', ativo: false },
      ])
    })
  })

  it('usa o nome do metadado quando o convite traz', async () => {
    await transacao(db, async (tx) => {
      const [u] = await tx.query<{ id: string }>(
        `insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'x@exemplo.invalid', '{"nome": "Pessoa Fictícia"}') returning id`,
      )
      expect(await tx.query(`select nome from public.perfis where user_id = $1`, [u.id])).toEqual([{ nome: 'Pessoa Fictícia' }])
    })
  })
})
