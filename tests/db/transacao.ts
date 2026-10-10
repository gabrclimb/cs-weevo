import type { ClienteDb } from './cliente'

export type Papel = 'anon' | 'authenticated'

export type Transacao = {
  query: ClienteDb['query']
  /** Passa a agir como o papel do PostgREST, com `sub` no JWT (auth.uid()). */
  como(papel: Papel, userId?: string): Promise<void>
}

/** Roda `fn` numa transação que sempre termina em rollback: nada do teste persiste. */
export async function transacao(db: ClienteDb, fn: (tx: Transacao) => Promise<void>): Promise<void> {
  await db.exec('begin')
  try {
    await fn({
      query: db.query,
      como: async (papel, userId) => {
        const claims = JSON.stringify(userId ? { role: papel, sub: userId } : { role: papel })
        await db.query(`select set_config('request.jwt.claims', $1, true)`, [claims])
        await db.exec(`set local role ${papel}`)
      },
    })
  } finally {
    await db.exec('rollback')
  }
}
