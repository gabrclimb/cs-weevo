import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarCliente, type ClienteDb } from './cliente'
import { transacao } from './transacao'

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
