import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarCliente, type ClienteDb } from './cliente'
import { transacao, type Transacao } from './transacao'

let db: ClienteDb

beforeAll(async () => {
  db = await criarCliente()
})
afterAll(() => db?.close())

const ADMIN = '00000000-0000-4000-8000-0000000000a1'
const ITEM = '00000000-0000-4000-8000-0000000000b1'

async function comoAdmin(tx: Transacao) {
  await tx.query(`insert into auth.users (id) values ($1)`, [ADMIN])
  await tx.query(
    `insert into public.perfis (user_id, nome, papel, ativo) values ($1, 'Admin', 'admin', true)
     on conflict (user_id) do update set papel = 'admin', ativo = true`,
    [ADMIN],
  )
  await tx.como('authenticated', ADMIN)
}

describe('colunas personalizadas dos kanbans', () => {
  it('admin cria, renomeia e coloca um card numa coluna nova', async () => {
    await transacao(db, async (tx) => {
      await comoAdmin(tx)
      const [c] = await tx.query<{ id: string; ordem: number }>(
        `insert into public.weevo_kanban_colunas (quadro, titulo) values ('tarefas', 'Em revisão') returning id, ordem`,
      )
      expect(c.ordem).toBe(0)
      expect(await tx.erro(`update public.weevo_kanban_colunas set titulo = 'Revisão' where id = $1`, [c.id])).toBeNull()
      expect(
        await tx.erro(
          `insert into public.weevo_kanban_cards (quadro, item_id, coluna_id, valor_base) values ('tarefas', $1, $2, 'a_fazer')`,
          [ITEM, c.id],
        ),
      ).toBeNull()
      // O mesmo item só fica numa coluna personalizada por quadro: mover é upsert.
      expect(
        await tx.erro(
          `insert into public.weevo_kanban_cards (quadro, item_id, coluna_id, valor_base) values ('tarefas', $1, $2, 'feito')
           on conflict (quadro, item_id) do update set coluna_id = excluded.coluna_id, valor_base = excluded.valor_base`,
          [ITEM, c.id],
        ),
      ).toBeNull()
    })
  })

  it('o título não fica em branco nem repete no mesmo quadro', async () => {
    await transacao(db, async (tx) => {
      await comoAdmin(tx)
      expect(await tx.erro(`insert into public.weevo_kanban_colunas (quadro, titulo) values ('tarefas', '  ')`)).toMatch(/check constraint/)
      await tx.query(`insert into public.weevo_kanban_colunas (quadro, titulo) values ('tarefas', 'Em revisão')`)
      expect(await tx.erro(`insert into public.weevo_kanban_colunas (quadro, titulo) values ('tarefas', ' em REVISÃO ')`)).toMatch(
        /duplicate key/,
      )
      // Em outro quadro o mesmo título pode.
      expect(await tx.erro(`insert into public.weevo_kanban_colunas (quadro, titulo) values ('turmas.situacao', 'Em revisão')`)).toBeNull()
    })
  })

  it('só aceita os quadros que existem', async () => {
    await transacao(db, async (tx) => {
      await comoAdmin(tx)
      expect(await tx.erro(`insert into public.weevo_kanban_colunas (quadro, titulo) values ('hoje', 'Extra')`)).toMatch(/check constraint/)
    })
  })

  it('o card precisa estar numa coluna do mesmo quadro', async () => {
    await transacao(db, async (tx) => {
      await comoAdmin(tx)
      const [c] = await tx.query<{ id: string }>(
        `insert into public.weevo_kanban_colunas (quadro, titulo) values ('turmas.tipo', 'Parceria') returning id`,
      )
      expect(
        await tx.erro(`insert into public.weevo_kanban_cards (quadro, item_id, coluna_id, valor_base) values ('tarefas', $1, $2, 'a_fazer')`, [
          ITEM,
          c.id,
        ]),
      ).toMatch(/foreign key/)
    })
  })

  it('excluir a coluna devolve os cards para a coluna de origem', async () => {
    await transacao(db, async (tx) => {
      await comoAdmin(tx)
      const [c] = await tx.query<{ id: string }>(
        `insert into public.weevo_kanban_colunas (quadro, titulo) values ('tarefas', 'Em revisão') returning id`,
      )
      await tx.query(`insert into public.weevo_kanban_cards (quadro, item_id, coluna_id, valor_base) values ('tarefas', $1, $2, 'a_fazer')`, [
        ITEM,
        c.id,
      ])
      await tx.query(`delete from public.weevo_kanban_colunas where id = $1`, [c.id])
      expect(await tx.query(`select 1 from public.weevo_kanban_cards`)).toEqual([])
    })
  })

  it('anon não lê nem grava', async () => {
    await transacao(db, async (tx) => {
      await tx.como('anon')
      expect(await tx.erro(`select * from public.weevo_kanban_colunas`)).toMatch(/permission denied/)
      expect(await tx.erro(`select * from public.weevo_kanban_cards`)).toMatch(/permission denied/)
    })
  })
})
