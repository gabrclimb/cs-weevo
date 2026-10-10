import type { ClienteDb } from './cliente'

export type Papel = 'anon' | 'authenticated'

export type Transacao = {
  query: ClienteDb['query']
  /** Passa a agir como o papel do PostgREST, com `sub` no JWT (auth.uid()). */
  como(papel: Papel, userId?: string): Promise<void>
  /** Executa num savepoint e devolve a mensagem de erro, ou null se deu certo. A transação segue utilizável. */
  erro(sql: string, params?: unknown[]): Promise<string | null>
  /** Como `erro`, mas executa uma vez só e devolve também as linhas quando dá certo. */
  resultado<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ erro: string | null; linhas: T[] }>
}

/** Roda `fn` numa transação que sempre termina em rollback: nada do teste persiste. */
export async function transacao(db: ClienteDb, fn: (tx: Transacao) => Promise<void>): Promise<void> {
  async function resultado<T>(sql: string, params?: unknown[]): Promise<{ erro: string | null; linhas: T[] }> {
    await db.exec('savepoint tentativa')
    try {
      const linhas = await db.query<T>(sql, params)
      await db.exec('release savepoint tentativa')
      return { erro: null, linhas }
    } catch (e) {
      await db.exec('rollback to savepoint tentativa')
      return { erro: (e as Error).message, linhas: [] }
    }
  }

  await db.exec('begin')
  try {
    await fn({
      query: db.query,
      como: async (papel, userId) => {
        const claims = JSON.stringify(userId ? { role: papel, sub: userId } : { role: papel })
        await db.query(`select set_config('request.jwt.claims', $1, true)`, [claims])
        await db.exec(`set local role ${papel}`)
      },
      erro: async (sql, params) => (await resultado(sql, params)).erro,
      resultado,
    })
  } finally {
    await db.exec('rollback')
  }
}
