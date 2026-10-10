import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarCliente, type ClienteDb } from './cliente'

let db: ClienteDb

beforeAll(async () => {
  db = await criarCliente()
})
afterAll(() => db?.close())

describe('migrations', () => {
  it('criam todas as tabelas do schema public', async () => {
    const rows = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public' order by 1`,
    )
    expect(rows.map((r) => r.table_name)).toEqual([
      'configuracoes',
      'empresas',
      'estados_presenca',
      'funil_etapas',
      'imersao_dias',
      'message_template_categories',
      'message_templates',
      'motivos',
      'participantes',
      'perfis',
      'sessao_participantes',
      'sessoes',
      'temas',
      'turmas',
      'weevo_admins',
      'weevo_depoimentos',
      'weevo_eventos',
      'weevo_participantes',
      'weevo_plantoes',
      'weevo_tarefas',
      'weevo_turmas',
    ])
  })

  it('deixam o RLS ligado em todas elas', async () => {
    const rows = await db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    )
    expect(rows).toEqual([])
  })
})
