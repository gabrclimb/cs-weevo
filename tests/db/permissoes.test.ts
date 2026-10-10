import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarCliente, type ClienteDb } from './cliente'
import { transacao } from './transacao'

/** Tabelas do CS: nenhuma delas é da LP pública. */
const TABELAS_CS = [
  'weevo_admins',
  'weevo_turmas',
  'weevo_plantoes',
  'weevo_participantes',
  'weevo_eventos',
  'weevo_tarefas',
  'message_template_categories',
  'message_templates',
]

let db: ClienteDb

beforeAll(async () => {
  db = await criarCliente()
})
afterAll(() => db?.close())

describe('anon', () => {
  it.each(TABELAS_CS)('não lê %s', async (tabela) => {
    await transacao(db, async (tx) => {
      await tx.como('anon')
      expect((await tx.erro(`select * from public.${tabela}`)) ?? 'sem erro').toMatch(/permission denied/)
    })
  })

  // O privilégio barra antes do RLS: "permission denied", não "violates row-level security".
  it.each(TABELAS_CS)('não escreve em %s', async (tabela) => {
    await transacao(db, async (tx) => {
      await tx.como('anon')
      for (const sql of [
        `insert into public.${tabela} default values`,
        `update public.${tabela} set created_at = now()`,
        `delete from public.${tabela}`,
      ]) {
        expect((await tx.erro(sql)) ?? 'sem erro', sql).toMatch(/permission denied/)
      }
    })
  })
})

describe('função de trigger', () => {
  // Sem o revoke, a chamada passa da checagem de privilégio e só falha por não estar num trigger.
  it.each(['anon', 'authenticated'] as const)('%s não executa weevo_recalcular_participante', async (papel) => {
    await transacao(db, async (tx) => {
      await tx.como(papel)
      expect((await tx.erro(`select public.weevo_recalcular_participante()`)) ?? 'sem erro').toMatch(
        /permission denied for function/,
      )
    })
  })
})
