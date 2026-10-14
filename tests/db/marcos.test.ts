import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarCliente, type ClienteDb } from './cliente'
import { transacao, type Transacao } from './transacao'

let db: ClienteDb

beforeAll(async () => {
  db = await criarCliente()
})
afterAll(() => db?.close())

const ADMIN = '00000000-0000-4000-8000-0000000000a1'

/** Admin ativo e uma turma, já com a sessão como o admin. */
async function adminComTurma(tx: Transacao): Promise<string> {
  await tx.query(`insert into auth.users (id) values ($1)`, [ADMIN])
  await tx.query(
    `insert into public.perfis (user_id, nome, papel, ativo) values ($1, 'Admin', 'admin', true)
     on conflict (user_id) do update set papel = 'admin', ativo = true`,
    [ADMIN],
  )
  await tx.como('authenticated', ADMIN)
  const [t] = await tx.query<{ id: string }>(`insert into public.weevo_turmas (nome) values ('Turma Teste') returning id`)
  return t.id
}

describe('datas da turma (weevo_marcos)', () => {
  it('admin agenda o NPS e uma data livre, edita e marca como concluída', async () => {
    await transacao(db, async (tx) => {
      const turma = await adminComTurma(tx)
      const [nps] = await tx.query<{ id: string; concluido: boolean }>(
        `insert into public.weevo_marcos (turma_id, tipo, titulo, data, horario) values ($1, 'nps', 'Envio do NPS', '2026-10-20', '10:00') returning id, concluido`,
        [turma],
      )
      expect(nps.concluido).toBe(false)
      expect(
        await tx.erro(`insert into public.weevo_marcos (turma_id, titulo, data) values ($1, 'Encerramento', '2026-10-25')`, [turma]),
      ).toBeNull()
      expect(await tx.erro(`update public.weevo_marcos set concluido = true where id = $1`, [nps.id])).toBeNull()
      expect(await tx.erro(`delete from public.weevo_marcos where tipo = 'outro'`)).toBeNull()
    })
  })

  it('a turma tem um NPS só; datas livres podem ser várias', async () => {
    await transacao(db, async (tx) => {
      const turma = await adminComTurma(tx)
      await tx.query(`insert into public.weevo_marcos (turma_id, tipo, titulo) values ($1, 'nps', 'Envio do NPS')`, [turma])
      expect(await tx.erro(`insert into public.weevo_marcos (turma_id, tipo, titulo) values ($1, 'nps', 'Outro NPS')`, [turma])).toMatch(
        /duplicate key/,
      )
      await tx.query(`insert into public.weevo_marcos (turma_id, titulo) values ($1, 'Encerramento'), ($1, 'Certificados')`, [turma])
    })
  })

  it('o título não pode ficar em branco', async () => {
    await transacao(db, async (tx) => {
      const turma = await adminComTurma(tx)
      expect(await tx.erro(`insert into public.weevo_marcos (turma_id, titulo) values ($1, '  ')`, [turma])).toMatch(/check constraint/)
    })
  })

  it('saem junto com a turma excluída', async () => {
    await transacao(db, async (tx) => {
      const turma = await adminComTurma(tx)
      await tx.query(`insert into public.weevo_marcos (turma_id, titulo) values ($1, 'Encerramento')`, [turma])
      await tx.query(`delete from public.weevo_turmas where id = $1`, [turma])
      expect(await tx.query(`select 1 from public.weevo_marcos`)).toEqual([])
    })
  })
})
