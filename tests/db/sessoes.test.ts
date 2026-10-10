import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarCliente, type ClienteDb } from './cliente'
import { transacao, type Transacao } from './transacao'
import { criarUsuario } from './usuarios'

let db: ClienteDb

beforeAll(async () => {
  db = await criarCliente()
})
afterAll(() => db?.close())

async function turma(tx: Transacao, nome = 'Turma Sessões') {
  const [t] = await tx.query<{ id: string }>(`insert into public.turmas (nome, tipo, modelo_suporte) values ($1, 'aberta', 'plantao') returning id`, [nome])
  return t.id
}

const sessao = (tx: Transacao, turmaId: string, campos: Record<string, unknown>) => {
  const todos = { turma_id: turmaId, data: '2026-10-15', formato: 'online', ...campos }
  const cols = Object.keys(todos)
  return tx.resultado<{ id: string }>(
    `insert into public.sessoes (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
    Object.values(todos),
  )
}

describe('sessões: regular x extra', () => {
  it.each([
    ['regular com número', { tipo: 'regular', numero: 1 }, true],
    ['regular sem número', { tipo: 'regular' }, false],
    ['regular que repõe', { tipo: 'regular', numero: 2, repoe_numero: 1 }, false],
    ['extra sem número', { tipo: 'extra' }, true],
    ['extra que repõe o encontro 2', { tipo: 'extra', repoe_numero: 2 }, true],
    ['extra com número', { tipo: 'extra', numero: 3 }, false],
    ['número zero', { tipo: 'regular', numero: 0 }, false],
    ['fim antes do início', { tipo: 'regular', numero: 1, hora_inicio: '16:00', hora_fim: '14:00' }, false],
  ])('%s', async (_caso, campos, aceita) => {
    await transacao(db, async (tx) => {
      const { erro } = await sessao(tx, await turma(tx), campos)
      if (aceita) expect(erro).toBeNull()
      else expect(erro ?? 'sem erro').toMatch(/check constraint/)
    })
  })
})

describe('sessões: mesmo encontro em vários horários (8.3)', () => {
  it('aceita o mesmo número em dias ou horários diferentes', async () => {
    await transacao(db, async (tx) => {
      const t = await turma(tx)
      for (const c of [
        { data: '2026-09-29', hora_inicio: '14:00' },
        { data: '2026-09-30', hora_inicio: '14:00' },
        { data: '2026-09-30', hora_inicio: '16:00' },
      ]) {
        expect((await sessao(tx, t, { tipo: 'regular', numero: 1, ...c })).erro).toBeNull()
      }
    })
  })

  it.each([
    ['com horário', { hora_inicio: '14:00' }],
    ['sem horário', {}],
  ])('rejeita a duplicata exata (%s)', async (_caso, extra) => {
    await transacao(db, async (tx) => {
      const t = await turma(tx)
      const campos = { tipo: 'regular', numero: 1, data: '2026-09-29', ...extra }
      expect((await sessao(tx, t, campos)).erro).toBeNull()
      expect((await sessao(tx, t, campos)).erro ?? 'sem erro').toMatch(/duplicate key/)
    })
  })
})

describe('quem cria e altera sessões', () => {
  async function como(tx: Transacao, papel: 'cs' | 'revisor' | 'admin') {
    await tx.como('authenticated', await criarUsuario(tx, papel))
  }

  it.each([
    ['cs', { regular: 'barrado', extra: 'gravou' }],
    ['revisor', { regular: 'gravou', extra: 'gravou' }],
    ['admin', { regular: 'gravou', extra: 'gravou' }],
  ] as const)('%s cria sessões', async (papel, esperado) => {
    await transacao(db, async (tx) => {
      const t = await turma(tx)
      await como(tx, papel)
      const regular = await sessao(tx, t, { tipo: 'regular', numero: 1 })
      const extra = await sessao(tx, t, { tipo: 'extra', repoe_numero: 1 })
      const r = (x: { erro: string | null; linhas: unknown[] }) => (x.erro ? (expect(x.erro).toMatch(/permission denied|row-level security/), 'barrado') : 'gravou')
      expect({ regular: r(regular), extra: r(extra) }).toEqual(esperado)
    })
  })

  it.each([
    ['cs', 0],
    ['revisor', 1],
  ] as const)('%s remarca a data de uma sessão (linhas alteradas: %s)', async (papel, n) => {
    await transacao(db, async (tx) => {
      const t = await turma(tx)
      const { linhas } = await sessao(tx, t, { tipo: 'regular', numero: 1 })
      await como(tx, papel)
      const { erro, linhas: alteradas } = await tx.resultado(`update public.sessoes set data = '2026-10-20' where id = $1 returning 1`, [linhas[0].id])
      if (erro) expect(erro).toMatch(/permission denied/)
      expect(erro ? 0 : alteradas.length).toBe(n)
    })
  })

  it('ninguém muda o status direto nem apaga sessão', async () => {
    await transacao(db, async (tx) => {
      const t = await turma(tx)
      const { linhas } = await sessao(tx, t, { tipo: 'regular', numero: 1 })
      await como(tx, 'admin')
      expect((await tx.erro(`update public.sessoes set status = 'realizada' where id = $1`, [linhas[0].id])) ?? 'sem erro').toMatch(/permission denied/)
      expect((await tx.erro(`delete from public.sessoes`)) ?? 'sem erro').toMatch(/permission denied/)
    })
  })

  it('membro ativo lê as sessões', async () => {
    await transacao(db, async (tx) => {
      const t = await turma(tx)
      await sessao(tx, t, { tipo: 'regular', numero: 1 })
      await como(tx, 'cs')
      expect(await tx.query(`select count(*)::int as n from public.sessoes`)).toEqual([{ n: 1 }])
    })
  })
})

describe('convocação e distribuição por CS', () => {
  async function cenario(tx: Transacao) {
    const t = await turma(tx)
    const outra = await turma(tx, 'Outra Turma')
    const { linhas } = await sessao(tx, t, { tipo: 'regular', numero: 1 })
    const pessoas: string[] = []
    for (const [nome, tid] of [['Pessoa 1', t], ['Pessoa 2', t], ['Pessoa de outra turma', outra]] as const) {
      const [p] = await tx.query<{ id: string }>(`insert into public.participantes (nome, turma_imersao_id) values ($1, $2) returning id`, [nome, tid])
      pessoas.push(p.id)
    }
    const csA = await criarUsuario(tx, 'cs', { nome: 'CS A' })
    const csB = await criarUsuario(tx, 'cs', { nome: 'CS B' })
    const csInativo = await criarUsuario(tx, 'cs', { ativo: false })
    const revisor = await criarUsuario(tx, 'revisor')
    return { sessao: linhas[0].id, pessoas, csA, csB, csInativo, revisor }
  }
  const distribuir = (tx: Transacao, sessaoId: string, itens: { participante_id: string; cs_id: string | null }[]) =>
    tx.resultado<{ n: number }>(`select public.distribuir_participantes($1, $2::jsonb) as n`, [sessaoId, JSON.stringify(itens)])
  const convocados = (tx: Transacao, sessaoId: string) =>
    tx.query<{ participante_id: string; cs_id: string | null }>(
      `select participante_id, cs_id from public.sessao_participantes where sessao_id = $1 order by participante_id`,
      [sessaoId],
    )

  it('revisor convoca e distribui; chamar de novo redistribui', async () => {
    await transacao(db, async (tx) => {
      const c = await cenario(tx)
      const [p1, p2] = c.pessoas
      await tx.como('authenticated', c.revisor)
      expect((await distribuir(tx, c.sessao, [{ participante_id: p1, cs_id: c.csA }, { participante_id: p2, cs_id: null }])).linhas).toEqual([{ n: 2 }])
      await distribuir(tx, c.sessao, [{ participante_id: p2, cs_id: c.csB }])
      const esperado = [{ participante_id: p1, cs_id: c.csA }, { participante_id: p2, cs_id: c.csB }].sort((a, b) => a.participante_id.localeCompare(b.participante_id))
      expect(await convocados(tx, c.sessao)).toEqual(esperado)
    })
  })

  it('convocação duplicada direta é rejeitada', async () => {
    await transacao(db, async (tx) => {
      const c = await cenario(tx)
      await tx.query(`insert into public.sessao_participantes (sessao_id, participante_id) values ($1, $2)`, [c.sessao, c.pessoas[0]])
      expect((await tx.erro(`insert into public.sessao_participantes (sessao_id, participante_id) values ($1, $2)`, [c.sessao, c.pessoas[0]])) ?? 'sem erro').toMatch(
        /duplicate key/,
      )
    })
  })

  it.each([
    ['participante de outra turma de suporte', 'turma', /turma de suporte/],
    ['CS inativo', 'inativo', /CS precisa ter perfil ativo/],
    ['sessão que não está agendada', 'cancelada', /sessão agendada/],
  ] as const)('rejeita %s', async (_caso, situacao, mensagem) => {
    await transacao(db, async (tx) => {
      const c = await cenario(tx)
      if (situacao === 'cancelada') await tx.query(`update public.sessoes set status = 'cancelada' where id = $1`, [c.sessao])
      await tx.como('authenticated', c.revisor)
      const item = {
        turma: { participante_id: c.pessoas[2], cs_id: c.csA },
        inativo: { participante_id: c.pessoas[0], cs_id: c.csInativo },
        cancelada: { participante_id: c.pessoas[0], cs_id: c.csA },
      }[situacao]
      expect((await distribuir(tx, c.sessao, [item])).erro ?? 'sem erro').toMatch(mensagem)
    })
  })

  it('cs não distribui', async () => {
    await transacao(db, async (tx) => {
      const c = await cenario(tx)
      await tx.como('authenticated', c.csA)
      expect((await distribuir(tx, c.sessao, [{ participante_id: c.pessoas[0], cs_id: c.csA }])).erro ?? 'sem erro').toMatch(
        /permission denied|row-level security/,
      )
    })
  })

  it.each([
    ['revisor', 0],
    ['cs', 1],
  ] as const)('%s remove convocação (restam %s)', async (papel, restam) => {
    await transacao(db, async (tx) => {
      const c = await cenario(tx)
      await tx.query(`insert into public.sessao_participantes (sessao_id, participante_id) values ($1, $2)`, [c.sessao, c.pessoas[0]])
      await tx.como('authenticated', papel === 'revisor' ? c.revisor : c.csA)
      const erro = await tx.erro(`delete from public.sessao_participantes where sessao_id = $1`, [c.sessao])
      if (erro) expect(erro).toMatch(/permission denied/)
      expect((await convocados(tx, c.sessao)).length).toBe(restam)
    })
  })
})
