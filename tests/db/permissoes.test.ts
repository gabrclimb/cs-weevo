import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarCliente, type ClienteDb } from './cliente'
import { transacao, type Transacao } from './transacao'

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

const ADMIN = '00000000-0000-4000-8000-0000000000a1'

describe('admin (regressão)', () => {
  it.each(TABELAS_CS)('lê %s', async (tabela) => {
    await transacao(db, async (tx) => {
      await tx.query(`insert into auth.users (id) values ($1)`, [ADMIN])
      await tx.query(`insert into public.weevo_admins (user_id) values ($1)`, [ADMIN])
      await tx.como('authenticated', ADMIN)
      expect(await tx.erro(`select * from public.${tabela}`)).toBeNull()
    })
  })

  it('grava turma e participante, e o evento recalcula o último contato pelo trigger', async () => {
    await transacao(db, async (tx) => {
      await tx.query(`insert into auth.users (id) values ($1)`, [ADMIN])
      await tx.query(`insert into public.weevo_admins (user_id) values ($1)`, [ADMIN])
      await tx.como('authenticated', ADMIN)

      const [turma] = await tx.query<{ id: string }>(`insert into public.weevo_turmas (nome) values ('Turma Teste') returning id`)
      const [p] = await tx.query<{ id: string }>(
        `insert into public.weevo_participantes (nome, turma_id) values ('Pessoa Fictícia', $1) returning id`,
        [turma.id],
      )
      await tx.query(
        `insert into public.weevo_eventos (participante_id, tipo, ocorrido_em) values ($1, 'mensagem_enviada', '2026-10-01T12:00:00Z')`,
        [p.id],
      )
      const [depois] = await tx.query<{ ultimo_contato_em: unknown }>(
        `select ultimo_contato_em from public.weevo_participantes where id = $1`,
        [p.id],
      )
      expect(new Date(depois.ultimo_contato_em as string).toISOString()).toBe('2026-10-01T12:00:00.000Z')

      expect(await tx.erro(`update public.weevo_turmas set link_grupo = 'https://exemplo.invalid' where id = $1`, [turma.id])).toBeNull()
      expect(await tx.erro(`delete from public.weevo_participantes where id = $1`, [p.id])).toBeNull()
    })
  })
})

const SEM_ACESSO = '00000000-0000-4000-8000-0000000000b1'

/** Uma linha em cada tabela do CS, criada como postgres, para provar que o RLS esconde o que existe. */
async function semearCs(tx: Transacao) {
  await tx.query(`insert into auth.users (id) values ($1), ($2)`, [ADMIN, SEM_ACESSO])
  await tx.query(`insert into public.weevo_admins (user_id) values ($1)`, [ADMIN])
  const [t] = await tx.query<{ id: string }>(`insert into public.weevo_turmas (nome) values ('Turma Teste') returning id`)
  const [p] = await tx.query<{ id: string }>(
    `insert into public.weevo_participantes (nome, turma_id) values ('Pessoa Fictícia', $1) returning id`,
    [t.id],
  )
  await tx.query(`insert into public.weevo_plantoes (turma_id, numero) values ($1, 1)`, [t.id])
  await tx.query(`insert into public.weevo_eventos (participante_id, tipo) values ($1, 'nota')`, [p.id])
  await tx.query(`insert into public.weevo_tarefas (titulo, participante_id) values ('Tarefa teste', $1)`, [p.id])
  const [c] = await tx.query<{ id: string }>(`insert into public.message_template_categories (nome) values ('Categoria teste') returning id`)
  await tx.query(`insert into public.message_templates (category_id, titulo, conteudo) values ($1, 'Modelo', 'Olá')`, [c.id])
}

describe('authenticated sem linha em weevo_admins (regressão)', () => {
  it.each(TABELAS_CS)('não vê nada em %s', async (tabela) => {
    await transacao(db, async (tx) => {
      await semearCs(tx)
      await tx.como('authenticated', SEM_ACESSO)
      expect(await tx.query(`select * from public.${tabela}`)).toEqual([])
    })
  })

  it.each(TABELAS_CS.filter((t) => t !== 'weevo_admins'))('não grava em %s', async (tabela) => {
    await transacao(db, async (tx) => {
      await semearCs(tx)
      await tx.como('authenticated', SEM_ACESSO)
      expect((await tx.erro(`insert into public.${tabela} default values`)) ?? 'sem erro').toMatch(
        /row-level security|permission denied/,
      )
      expect(await tx.query(`update public.${tabela} set created_at = now() returning 1`)).toEqual([])
      expect(await tx.query(`delete from public.${tabela} returning 1`)).toEqual([])
    })
  })

  it('não se promove a admin', async () => {
    await transacao(db, async (tx) => {
      await semearCs(tx)
      await tx.como('authenticated', SEM_ACESSO)
      expect((await tx.erro(`insert into public.weevo_admins (user_id) values ($1)`, [SEM_ACESSO])) ?? 'sem erro').toMatch(
        /row-level security|permission denied/,
      )
      expect(await tx.query(`select public.is_admin() as admin`)).toEqual([{ admin: false }])
    })
  })
})

describe('objetos criados depois, sem GRANT explícito', () => {
  // Criados como postgres, como as migrations: o default privileges não pode expô-los.
  it.each(['anon', 'authenticated'] as const)('%s não acessa tabela nova', async (papel) => {
    await transacao(db, async (tx) => {
      await tx.query(`create table public.tabela_futura (id int)`)
      await tx.como(papel, papel === 'authenticated' ? ADMIN : undefined)
      expect((await tx.erro(`select * from public.tabela_futura`)) ?? 'sem erro').toMatch(/permission denied/)
      expect((await tx.erro(`insert into public.tabela_futura values (1)`)) ?? 'sem erro').toMatch(/permission denied/)
    })
  })

  it.each(['anon', 'authenticated'] as const)('%s não executa função nova', async (papel) => {
    await transacao(db, async (tx) => {
      await tx.query(`create function public.funcao_futura() returns int language sql as 'select 1'`)
      await tx.como(papel, papel === 'authenticated' ? ADMIN : undefined)
      expect((await tx.erro(`select public.funcao_futura()`)) ?? 'sem erro').toMatch(/permission denied/)
    })
  })
})

describe('LP pública (regressão)', () => {
  it('anon lê weevo_depoimentos', async () => {
    await transacao(db, async (tx) => {
      await tx.como('anon')
      const rows = await tx.query<{ chave: string }>(`select chave from public.weevo_depoimentos order by chave`)
      expect(rows.map((r) => r.chave)).toEqual(['assistencial', 'ciclo_receita', 'oncoclinica', 'superintendente'])
    })
  })

  it('anon não altera weevo_depoimentos', async () => {
    await transacao(db, async (tx) => {
      await tx.como('anon')
      expect((await tx.erro(`update public.weevo_depoimentos set video_path = 'x'`)) ?? 'sem erro').toMatch(
        /permission denied/,
      )
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
