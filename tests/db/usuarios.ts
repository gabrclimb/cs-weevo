import { randomUUID } from 'node:crypto'
import type { Transacao } from './transacao'

export type PapelCs = 'cs' | 'revisor' | 'admin'

/** Cria um usuário em auth.users e deixa o perfil com o papel e o estado pedidos. Rode como postgres. */
export async function criarUsuario(tx: Transacao, papel: PapelCs, { ativo = true, nome = `Pessoa ${papel}` } = {}): Promise<string> {
  const id = randomUUID()
  await tx.query(`insert into auth.users (id, email) values ($1, $2)`, [id, `${id}@exemplo.invalid`])
  await tx.query(
    `insert into public.perfis (user_id, nome, papel, ativo) values ($1, $2, $3, $4)
     on conflict (user_id) do update set nome = excluded.nome, papel = excluded.papel, ativo = excluded.ativo`,
    [id, nome, papel, ativo],
  )
  return id
}
