import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

/** Trecho de migração de dados da 1a, recortado do próprio arquivo, para rodar sobre um estado montado no teste. */
function migracaoDeAdmins(): string {
  const sql = readFileSync(join(import.meta.dirname, '../../supabase/migrations/20261010120000_fase1a_perfis.sql'), 'utf8')
  const m = sql.match(/-- migração de dados: início\n([\s\S]*?)-- migração de dados: fim/)
  if (!m) throw new Error('marcadores da migração de dados não encontrados')
  return m[1]
}

describe('admin atual (weevo_admins)', () => {
  it('vira perfil admin ativo, e is_admin() segue verdadeira', async () => {
    await transacao(db, async (tx) => {
      // Estado anterior à 1a: usuário em weevo_admins, sem perfil.
      const [u] = await tx.query<{ id: string }>(`insert into auth.users (id, email) values (gen_random_uuid(), 'admin.atual@exemplo.invalid') returning id`)
      await tx.query(`delete from public.perfis where user_id = $1`, [u.id])
      await tx.query(`insert into public.weevo_admins (user_id) values ($1)`, [u.id])

      await tx.query(migracaoDeAdmins())
      await tx.query(migracaoDeAdmins()) // idempotente

      expect(await tx.query(`select nome, papel, ativo from public.perfis where user_id = $1`, [u.id])).toEqual([
        { nome: 'admin.atual', papel: 'admin', ativo: true },
      ])
      await tx.como('authenticated', u.id)
      expect(await tx.query(`select public.is_admin() as ok`)).toEqual([{ ok: true }])
    })
  })

  it('is_admin() passa a seguir o perfil: cs ativo não é admin', async () => {
    await transacao(db, async (tx) => {
      const cs = await criarUsuario(tx, 'cs')
      await tx.query(`insert into public.weevo_admins (user_id) values ($1)`, [cs])
      await tx.como('authenticated', cs)
      expect(await tx.query(`select public.is_admin() as ok`)).toEqual([{ ok: false }])
    })
  })
})

describe('acesso a perfis', () => {
  it('membro ativo vê o time', async () => {
    await transacao(db, async (tx) => {
      const cs = await criarUsuario(tx, 'cs', { nome: 'Pessoa CS' })
      await criarUsuario(tx, 'revisor', { nome: 'Pessoa Revisora' })
      await tx.como('authenticated', cs)
      const nomes = (await tx.query<{ nome: string }>(`select nome from public.perfis order by nome`)).map((r) => r.nome)
      expect(nomes).toEqual(['Pessoa CS', 'Pessoa Revisora'])
    })
  })

  it.each([
    ['perfil inativo', { ativo: false }],
    ['sem perfil', null],
  ] as const)('%s não vê nem altera perfis', async (_caso, opcoes) => {
    await transacao(db, async (tx) => {
      await criarUsuario(tx, 'admin', { nome: 'Outra Pessoa' })
      let id: string
      if (opcoes) id = await criarUsuario(tx, 'cs', opcoes)
      else {
        ;[{ id }] = await tx.query<{ id: string }>(`insert into auth.users (id) values (gen_random_uuid()) returning id`)
        await tx.query(`delete from public.perfis where user_id = $1`, [id])
      }
      await tx.como('authenticated', id)
      expect(await tx.query(`select * from public.perfis`)).toEqual([])
      const erro = await tx.erro(`update public.perfis set papel = 'admin' returning 1`)
      if (erro) expect(erro).toMatch(/permission denied/)
      else expect(await tx.query(`update public.perfis set papel = 'admin' returning 1`)).toEqual([])
    })
  })
})

describe('alteração de perfis', () => {
  async function papelDe(tx: Transacao, id: string) {
    const [r] = await tx.query<{ papel: string; ativo: boolean }>(`select papel, ativo from public.perfis where user_id = $1`, [id])
    return r
  }

  it.each(['cs', 'revisor'] as const)('%s não se promove nem altera outros', async (papel) => {
    await transacao(db, async (tx) => {
      const eu = await criarUsuario(tx, papel)
      const outro = await criarUsuario(tx, 'cs')
      await tx.como('authenticated', eu)
      expect(await tx.query(`update public.perfis set papel = 'admin' where user_id = $1 returning 1`, [eu])).toEqual([])
      expect(await tx.query(`update public.perfis set ativo = false where user_id = $1 returning 1`, [outro])).toEqual([])
      await tx.query('reset role')
      expect(await papelDe(tx, eu)).toEqual({ papel, ativo: true })
      expect(await papelDe(tx, outro)).toEqual({ papel: 'cs', ativo: true })
    })
  })

  it('admin muda papel e ativo de outro', async () => {
    await transacao(db, async (tx) => {
      const admin = await criarUsuario(tx, 'admin')
      const outro = await criarUsuario(tx, 'cs', { ativo: false })
      await tx.como('authenticated', admin)
      expect(await tx.query(`update public.perfis set papel = 'revisor', ativo = true where user_id = $1 returning 1`, [outro])).toHaveLength(1)
      expect((await tx.erro(`update public.perfis set user_id = gen_random_uuid() where user_id = $1`, [outro])) ?? 'sem erro').toMatch(
        /permission denied/,
      )
      await tx.query('reset role')
      expect(await papelDe(tx, outro)).toEqual({ papel: 'revisor', ativo: true })
    })
  })

  it.each([
    ['rebaixar', `update public.perfis set papel = 'revisor' where user_id = $1`],
    ['desativar', `update public.perfis set ativo = false where user_id = $1`],
  ])('não deixa %s o último admin ativo', async (_acao, sql) => {
    await transacao(db, async (tx) => {
      await tx.query(`update public.perfis set ativo = false where papel = 'admin'`)
      const admin = await criarUsuario(tx, 'admin')
      await tx.como('authenticated', admin)
      expect((await tx.erro(sql, [admin])) ?? 'sem erro').toMatch(/último admin/)
    })
  })

  it('com outro admin ativo, um admin pode deixar de ser admin', async () => {
    await transacao(db, async (tx) => {
      const a = await criarUsuario(tx, 'admin')
      await criarUsuario(tx, 'admin')
      await tx.como('authenticated', a)
      expect(await tx.erro(`update public.perfis set papel = 'revisor' where user_id = $1`, [a])).toBeNull()
    })
  })
})
