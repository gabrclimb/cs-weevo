import type { Transacao } from './transacao'
import { criarUsuario } from './usuarios'

export type Cenario = {
  turma: string
  sessao: string
  /** Participantes convocados para a sessão (o primeiro com o CS A). */
  pessoas: string[]
  csA: string
  csB: string
  revisor: string
  admin: string
}

/** Turma, sessão regular 1 e participantes convocados. Rode como postgres; volta como postgres. */
export async function cenarioEncontro(tx: Transacao, { participantes = 2, numero = 1 } = {}): Promise<Cenario> {
  const [t] = await tx.query<{ id: string }>(`insert into public.turmas (nome, tipo, modelo_suporte) values ('Turma Encontro', 'aberta', 'plantao') returning id`)
  const [s] = await tx.query<{ id: string }>(
    `insert into public.sessoes (turma_id, tipo, numero, data, hora_inicio, hora_fim, formato) values ($1, 'regular', $2, '2026-10-15', '14:00', '16:00', 'online') returning id`,
    [t.id, numero],
  )
  const csA = await criarUsuario(tx, 'cs', { nome: 'CS A' })
  const csB = await criarUsuario(tx, 'cs', { nome: 'CS B' })
  const revisor = await criarUsuario(tx, 'revisor', { nome: 'Revisor' })
  const admin = await criarUsuario(tx, 'admin', { nome: 'Admin' })
  const pessoas: string[] = []
  for (let i = 0; i < participantes; i++) {
    const [p] = await tx.query<{ id: string }>(`insert into public.participantes (nome, turma_imersao_id) values ($1, $2) returning id`, [`Pessoa ${i + 1}`, t.id])
    await tx.query(`insert into public.sessao_participantes (sessao_id, participante_id, cs_id) values ($1, $2, $3)`, [s.id, p.id, i === 0 ? csA : csB])
    pessoas.push(p.id)
  }
  return { turma: t.id, sessao: s.id, pessoas, csA, csB, revisor, admin }
}

export async function estado(tx: Transacao, chave: string): Promise<string> {
  const [r] = await tx.query<{ id: string }>(`select id from public.estados_presenca where chave = $1`, [chave])
  return r.id
}

export async function motivo(tx: Transacao, tipo: string, rotulo: string): Promise<string> {
  const [r] = await tx.query<{ id: string }>(`select id from public.motivos where tipo_registro = $1 and rotulo = $2`, [tipo, rotulo])
  return r.id
}

export async function temas(tx: Transacao, ...rotulos: string[]): Promise<string[]> {
  const rows = await tx.query<{ id: string }>(`select id from public.temas where rotulo = any ($1) order by rotulo`, [rotulos])
  return rows.map((r) => r.id)
}

/** Dados de um "Veio" completo, prontos para registrar_encontro. */
export async function veioCompleto(tx: Transacao, c: Cenario, extra: Record<string, unknown> = {}) {
  return {
    sessao_id: c.sessao,
    participante_id: c.pessoas[0],
    presenca_id: await estado(tx, 'veio'),
    modalidade: 'online',
    temas: await temas(tx, 'Agente', 'Automação'),
    feito: 'Montou o primeiro fluxo.',
    planejado: 'Conectar a planilha.',
    status_projeto: 'rodando',
    ...extra,
  }
}

export function registrar(tx: Transacao, dados: Record<string, unknown>) {
  return tx.resultado<{ id: string }>(`select public.registrar_encontro($1::jsonb) as id`, [JSON.stringify(dados)])
}
