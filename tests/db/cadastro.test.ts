import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarCliente, type ClienteDb } from './cliente'
import { transacao } from './transacao'
import { criarUsuario } from './usuarios'

let db: ClienteDb

beforeAll(async () => {
  db = await criarCliente()
})
afterAll(() => db?.close())

describe('turmas', () => {
  it('in_company exige empresa e aberta não aceita empresa', async () => {
    await transacao(db, async (tx) => {
      const [e] = await tx.query<{ id: string }>(`insert into public.empresas (nome) values ('Empresa Fictícia') returning id`)
      expect(await tx.erro(`insert into public.turmas (nome, tipo, empresa_id, modelo_suporte) values ('In company A', 'in_company', $1, 'plantao')`, [e.id])).toBeNull()
      expect(await tx.erro(`insert into public.turmas (nome, tipo, modelo_suporte) values ('Aberta A', 'aberta', 'horario_escolhido')`)).toBeNull()
      expect((await tx.erro(`insert into public.turmas (nome, tipo, modelo_suporte) values ('In company B', 'in_company', 'plantao')`)) ?? 'sem erro').toMatch(/check constraint/)
      expect((await tx.erro(`insert into public.turmas (nome, tipo, empresa_id, modelo_suporte) values ('Aberta B', 'aberta', $1, 'plantao')`, [e.id])) ?? 'sem erro').toMatch(/check constraint/)
    })
  })
})

describe('registrado_por', () => {
  it('é sempre o usuário da sessão, nunca o valor enviado', async () => {
    await transacao(db, async (tx) => {
      const quem = await criarUsuario(tx, 'revisor')
      const outro = await criarUsuario(tx, 'revisor')
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: quem })])
      const [e] = await tx.query<{ registrado_por: string }>(
        `insert into public.empresas (nome, registrado_por) values ('Empresa Fictícia', $1) returning registrado_por`,
        [outro],
      )
      const [t] = await tx.query<{ registrado_por: string }>(
        `insert into public.turmas (nome, tipo, modelo_suporte, registrado_por) values ('Turma X', 'aberta', 'plantao', $1) returning registrado_por`,
        [outro],
      )
      expect([e.registrado_por, t.registrado_por]).toEqual([quem, quem])
    })
  })
})

describe('participantes', () => {
  async function turma(tx: import('./transacao').Transacao, nome = 'Turma Teste') {
    const [t] = await tx.query<{ id: string }>(`insert into public.turmas (nome, tipo, modelo_suporte) values ($1, 'aberta', 'plantao') returning id`, [nome])
    return t.id
  }
  const inserir = (tx: import('./transacao').Transacao, turmaId: string, extra: Record<string, unknown> = {}) => {
    const campos = { nome: 'Pessoa Fictícia', turma_imersao_id: turmaId, ...extra }
    const cols = Object.keys(campos)
    return tx.erro(
      `insert into public.participantes (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})`,
      Object.values(campos),
    )
  }

  it('telefone precisa estar em E.164 do Brasil', async () => {
    await transacao(db, async (tx) => {
      const t = await turma(tx)
      expect(await inserir(tx, t, { telefone: '+5584999990000' })).toBeNull()
      expect((await inserir(tx, t, { telefone: '84 99999-0000' })) ?? 'sem erro').toMatch(/check constraint/)
    })
  })

  it('telefone e e-mail são únicos (e-mail sem diferenciar maiúsculas)', async () => {
    await transacao(db, async (tx) => {
      const t = await turma(tx)
      expect(await inserir(tx, t, { telefone: '+5584999990000', email: 'pessoa@exemplo.invalid' })).toBeNull()
      expect((await inserir(tx, t, { telefone: '+5584999990000' })) ?? 'sem erro').toMatch(/duplicate key/)
      expect((await inserir(tx, t, { email: 'PESSOA@exemplo.invalid' })) ?? 'sem erro').toMatch(/duplicate key/)
      expect(await inserir(tx, t)).toBeNull() // sem telefone nem e-mail, pode repetir
      expect(await inserir(tx, t)).toBeNull()
    })
  })

  it('situacao nasce ativo e só aceita ativo ou fora_do_suporte', async () => {
    await transacao(db, async (tx) => {
      const t = await turma(tx)
      expect(await inserir(tx, t)).toBeNull()
      expect(await tx.query(`select situacao from public.participantes`)).toEqual([{ situacao: 'ativo' }])
      expect(await inserir(tx, t, { situacao: 'fora_do_suporte' })).toBeNull()
      expect((await inserir(tx, t, { situacao: 'inativo' })) ?? 'sem erro').toMatch(/check constraint/)
    })
  })

  it('dias da imersão não se repetem na turma', async () => {
    await transacao(db, async (tx) => {
      const t = await turma(tx)
      expect(await tx.erro(`insert into public.imersao_dias (turma_id, data, ordem) values ($1, '2026-10-01', 1), ($1, '2026-10-02', 2)`, [t])).toBeNull()
      expect((await tx.erro(`insert into public.imersao_dias (turma_id, data, ordem) values ($1, '2026-10-03', 1)`, [t])) ?? 'sem erro').toMatch(/duplicate key/)
      expect((await tx.erro(`insert into public.imersao_dias (turma_id, data, ordem) values ($1, '2026-10-01', 3)`, [t])) ?? 'sem erro').toMatch(/duplicate key/)
    })
  })
})

describe('turma de suporte', () => {
  it('nasce igual à da imersão, mesmo se o cliente mandar outra', async () => {
    await transacao(db, async (tx) => {
      const [a] = await tx.query<{ id: string }>(`insert into public.turmas (nome, tipo, modelo_suporte) values ('Turma A', 'aberta', 'plantao') returning id`)
      const [b] = await tx.query<{ id: string }>(`insert into public.turmas (nome, tipo, modelo_suporte) values ('Turma B', 'aberta', 'plantao') returning id`)
      const [p] = await tx.query<{ turma_suporte_id: string }>(
        `insert into public.participantes (nome, turma_imersao_id, turma_suporte_id) values ('Pessoa Fictícia', $1, $2) returning turma_suporte_id`,
        [a.id, b.id],
      )
      expect(p.turma_suporte_id).toBe(a.id)
    })
  })
})
