import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as dominio from '../../src/lib/dominio'
import { criarCliente, type ClienteDb } from './cliente'

// Coluna com CHECK do banco → constante do front que lista os mesmos valores.
const COLUNAS: [tabela: string, coluna: string, valores: readonly string[]][] = [
  ['weevo_turmas', 'tipo', dominio.TIPOS_TURMA],
  ['weevo_plantoes', 'formato', dominio.FORMATOS_PLANTAO],
  ['weevo_participantes', 'status', dominio.STATUS_PARTICIPANTE_KEYS],
  ['weevo_participantes', 'weevo_start', dominio.WEEVO_START_ETAPAS],
  ['weevo_tarefas', 'tipo', dominio.TIPOS_TAREFA],
  ['weevo_tarefas', 'status', dominio.STATUS_TAREFA_VALORES],
  ['weevo_eventos', 'tipo', dominio.TIPOS_EVENTO],
  ['weevo_eventos', 'categoria', dominio.CATEGORIAS_EVENTO],
  ['weevo_eventos', 'origem', dominio.ORIGENS_EVENTO],
]

let db: ClienteDb

beforeAll(async () => {
  db = await criarCliente()
})
afterAll(() => db?.close())

/** Valores da lista do CHECK da coluna, lidos da definição da constraint no catálogo. */
async function valoresDoCheck(tabela: string, coluna: string): Promise<string[]> {
  const rows = await db.query<{ def: string }>(
    `select pg_get_constraintdef(c.oid) as def
     from pg_constraint c
     join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
     where c.conrelid = $1::regclass and c.contype = 'c' and a.attname = $2`,
    [`public.${tabela}`, coluna],
  )
  expect(rows, `um CHECK em ${tabela}.${coluna}`).toHaveLength(1)
  return [...rows[0].def.matchAll(/'([^']+)'::text/g)].map((m) => m[1])
}

describe('constantes do domínio x CHECK do banco', () => {
  it.each(COLUNAS)('%s.%s', async (tabela, coluna, valores) => {
    expect([...valores].sort()).toEqual((await valoresDoCheck(tabela, coluna)).sort())
  })
})
