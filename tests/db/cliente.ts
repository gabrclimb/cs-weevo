import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import pg from 'pg'

/** Cliente SQL mínimo, igual nos dois motores. */
export type ClienteDb = {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
  /** Vários comandos de uma vez, sem parâmetros (migrations, stubs). */
  exec(sql: string): Promise<void>
  close(): Promise<void>
}

const RAIZ = join(import.meta.dirname, '..', '..')
const MIGRATIONS = join(RAIZ, 'supabase', 'migrations')
const STUBS = join(import.meta.dirname, 'stubs-supabase.sql')

export function arquivosMigration(): string[] {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
}

/** Banco novo no PGlite: stubs do Supabase + todas as migrations, em ordem. */
async function pglite(): Promise<ClienteDb> {
  const db = new PGlite()
  await db.exec(readFileSync(STUBS, 'utf8'))
  for (const arquivo of arquivosMigration()) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS, arquivo), 'utf8'))
    } catch (e) {
      throw new Error(`Migration ${arquivo} falhou no PGlite: ${(e as Error).message}`)
    }
  }
  return {
    query: async (sql, params) => (await db.query(sql, params)).rows as never,
    exec: async (sql) => {
      await db.exec(sql)
    },
    close: () => db.close(),
  }
}

/** Supabase local do CI: as migrations já foram aplicadas pelo `supabase start`. */
async function supabaseLocal(): Promise<ClienteDb> {
  const url = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  const host = new URL(url).hostname
  // Nunca testar contra o projeto remoto.
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(`SUPABASE_DB_URL precisa apontar para o Supabase local, não para ${host}.`)
  }
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  return {
    query: async (sql, params) => (await client.query(sql, params)).rows,
    exec: async (sql) => {
      await client.query(sql)
    },
    close: () => client.end(),
  }
}

export function criarCliente(): Promise<ClienteDb> {
  return process.env.DB_TEST_TARGET === 'supabase' ? supabaseLocal() : pglite()
}
