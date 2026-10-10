import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cenarioEncontro, estado, motivo, registrar, veioCompleto } from './cenarios'
import { criarCliente, type ClienteDb } from './cliente'
import { transacao } from './transacao'

let db: ClienteDb

beforeAll(async () => {
  db = await criarCliente()
})
afterAll(() => db?.close())

describe('registrar_encontro', () => {
  it('"Veio" completo grava com quem registrou e quando, mesmo que o cliente mande outro autor', async () => {
    await transacao(db, async (tx) => {
      const c = await cenarioEncontro(tx)
      const dados = await veioCompleto(tx, c, { registrado_por: c.admin, registrado_em: '2020-01-01T00:00:00Z' })
      await tx.como('authenticated', c.csA)
      const { erro, linhas } = await registrar(tx, dados)
      expect(erro).toBeNull()
      const [r] = await tx.query<{ registrado_por: string; recente: boolean; origem: string; temas: number }>(
        `select registrado_por, registrado_em > now() - interval '1 minute' as recente, origem,
                (select count(*)::int from public.registro_temas t where t.registro_id = r.id) as temas
         from public.registros_encontro r where id = $1`,
        [linhas[0].id],
      )
      expect(r).toEqual({ registrado_por: c.csA, recente: true, origem: 'manual', temas: 2 })
    })
  })
})

describe('validação do registro', () => {
  it.each([
    ['sem temas', { temas: [] }, /tema/],
    ['sem o que foi feito', { feito: '  ' }, /o que foi feito/],
    ['sem o planejado', { planejado: null }, /planejado para o próximo/],
    ['sem status do projeto', { status_projeto: null }, /status do projeto/],
  ])('rejeita "Veio" %s', async (_caso, mudanca, mensagem) => {
    await transacao(db, async (tx) => {
      const c = await cenarioEncontro(tx)
      const dados = { ...(await veioCompleto(tx, c)), ...mudanca }
      await tx.como('authenticated', c.csA)
      expect((await registrar(tx, dados)).erro ?? 'sem erro').toMatch(mensagem)
    })
  })
})

describe('modalidade', () => {
  it('é obrigatória quando a presença conta ("Veio")', async () => {
    await transacao(db, async (tx) => {
      const c = await cenarioEncontro(tx)
      const dados = { ...(await veioCompleto(tx, c)), modalidade: null }
      await tx.como('authenticated', c.csA)
      expect((await registrar(tx, dados)).erro ?? 'sem erro').toMatch(/modalidade/)
    })
  })

  it('não é exigida quando a presença não conta ("Não veio")', async () => {
    await transacao(db, async (tx) => {
      const c = await cenarioEncontro(tx)
      const dados = {
        sessao_id: c.sessao,
        participante_id: c.pessoas[0],
        presenca_id: await estado(tx, 'nao_veio'),
        motivo_id: await motivo(tx, 'falta', 'Viagem'),
        motivo_texto: 'Viajou a trabalho.',
      }
      await tx.como('authenticated', c.csA)
      expect((await registrar(tx, dados)).erro).toBeNull()
    })
  })
})

describe('motivo de falta', () => {
  it.each([
    ['sem chip', null, 'Viajou.', /motivo/],
    ['sem texto', ['falta', 'Viagem'], '  ', /texto do motivo/],
    ['com chip de outro tipo', ['travou', 'Ferramenta'], 'Viajou.', /motivo de falta/],
  ] as const)('rejeita "Não veio" %s', async (_caso, chip, texto, mensagem) => {
    await transacao(db, async (tx) => {
      const c = await cenarioEncontro(tx)
      const dados = {
        sessao_id: c.sessao,
        participante_id: c.pessoas[0],
        presenca_id: await estado(tx, 'nao_veio'),
        motivo_id: chip ? await motivo(tx, chip[0], chip[1]) : null,
        motivo_texto: texto,
      }
      await tx.como('authenticated', c.csA)
      expect((await registrar(tx, dados)).erro ?? 'sem erro').toMatch(mensagem)
    })
  })
})

describe('projeto travado', () => {
  it.each([
    ['sem chip de travamento', null, 'Sem acesso à conta.', /motivo do travamento/],
    ['com chip de outro tipo', ['falta', 'Viagem'], 'Sem acesso à conta.', /motivo de travamento/],
    ['sem texto', ['travou', 'Acesso ou conta'], '', /texto do travamento/],
  ] as const)('rejeita "travou" %s', async (_caso, chip, texto, mensagem) => {
    await transacao(db, async (tx) => {
      const c = await cenarioEncontro(tx)
      const dados = await veioCompleto(tx, c, {
        status_projeto: 'travou',
        travou_motivo_id: chip ? await motivo(tx, chip[0], chip[1]) : null,
        travou_texto: texto,
      })
      await tx.como('authenticated', c.csA)
      expect((await registrar(tx, dados)).erro ?? 'sem erro').toMatch(mensagem)
    })
  })

  it('aceita "travou" com chip e texto', async () => {
    await transacao(db, async (tx) => {
      const c = await cenarioEncontro(tx)
      const dados = await veioCompleto(tx, c, { status_projeto: 'travou', travou_motivo_id: await motivo(tx, 'travou', 'Ferramenta'), travou_texto: 'A ferramenta não exporta.' })
      await tx.como('authenticated', c.csA)
      expect((await registrar(tx, dados)).erro).toBeNull()
    })
  })
})

describe('continuidade (6.5)', () => {
  async function segundaSessao(tx: import('./transacao').Transacao, c: import('./cenarios').Cenario) {
    const [s2] = await tx.query<{ id: string }>(
      `insert into public.sessoes (turma_id, tipo, numero, data, hora_inicio, formato) values ($1, 'regular', 2, '2026-10-22', '14:00', 'online') returning id`,
      [c.turma],
    )
    await tx.query(`insert into public.sessao_participantes (sessao_id, participante_id, cs_id) values ($1, $2, $3)`, [s2.id, c.pessoas[0], c.csB])
    return s2.id
  }

  it('exige dizer se cumpriu o planejado do encontro anterior', async () => {
    await transacao(db, async (tx) => {
      const c = await cenarioEncontro(tx)
      const s2 = await segundaSessao(tx, c)
      const primeiro = await veioCompleto(tx, c)
      const segundo = await veioCompleto(tx, c, { sessao_id: s2 })
      await tx.como('authenticated', c.csA)
      expect((await registrar(tx, primeiro)).erro).toBeNull()
      await tx.comoPostgres()
      await tx.como('authenticated', c.csB) // outro CS no encontro seguinte
      expect((await registrar(tx, segundo)).erro ?? 'sem erro').toMatch(/cumpriu o planejado/)
      expect((await registrar(tx, { ...segundo, cumpriu_planejado_anterior: 'parcial' })).erro).toBeNull()
    })
  })

  it('não exige quando não há planejado anterior', async () => {
    await transacao(db, async (tx) => {
      const c = await cenarioEncontro(tx)
      const s2 = await segundaSessao(tx, c)
      const segundo = await veioCompleto(tx, c, { sessao_id: s2 })
      await tx.como('authenticated', c.csB)
      expect((await registrar(tx, segundo)).erro).toBeNull()
    })
  })
})

describe('quem e onde se registra', () => {
  it('rejeita registro de quem não foi convocado', async () => {
    await transacao(db, async (tx) => {
      const c = await cenarioEncontro(tx)
      const [x] = await tx.query<{ id: string }>(`insert into public.participantes (nome, turma_imersao_id) values ('Não convocado', $1) returning id`, [c.turma])
      const dados = await veioCompleto(tx, c, { participante_id: x.id })
      await tx.como('authenticated', c.csA)
      expect((await registrar(tx, dados)).erro ?? 'sem erro').toMatch(/foreign key/)
    })
  })

  it('rejeita um segundo registro do mesmo par sessão-participante (o caminho é corrigir)', async () => {
    await transacao(db, async (tx) => {
      const c = await cenarioEncontro(tx)
      const dados = await veioCompleto(tx, c)
      await tx.como('authenticated', c.csA)
      expect((await registrar(tx, dados)).erro).toBeNull()
      expect((await registrar(tx, dados)).erro ?? 'sem erro').toMatch(/duplicate key/)
    })
  })

  it('qualquer cs registra qualquer convocado (D3), e registrado_por fica com quem atendeu', async () => {
    await transacao(db, async (tx) => {
      const c = await cenarioEncontro(tx) // a pessoa 1 está distribuída ao CS A
      const dados = await veioCompleto(tx, c)
      await tx.como('authenticated', c.csB)
      const { erro, linhas } = await registrar(tx, dados)
      expect(erro).toBeNull()
      expect(await tx.query(`select registrado_por from public.registros_encontro where id = $1`, [linhas[0].id])).toEqual([{ registrado_por: c.csB }])
    })
  })

  it('rejeita registro em sessão cancelada', async () => {
    await transacao(db, async (tx) => {
      const c = await cenarioEncontro(tx)
      await tx.query(`update public.sessoes set status = 'cancelada' where id = $1`, [c.sessao])
      const dados = await veioCompleto(tx, c)
      await tx.como('authenticated', c.csA)
      expect((await registrar(tx, dados)).erro ?? 'sem erro').toMatch(/sessão cancelada/)
    })
  })

  it('convocação que já tem registro não pode ser removida, nem pelo revisor', async () => {
    await transacao(db, async (tx) => {
      const c = await cenarioEncontro(tx)
      const dados = await veioCompleto(tx, c)
      await tx.como('authenticated', c.csA)
      expect((await registrar(tx, dados)).erro).toBeNull()
      await tx.comoPostgres()
      await tx.como('authenticated', c.revisor)
      expect(
        (await tx.erro(`delete from public.sessao_participantes where sessao_id = $1 and participante_id = $2`, [c.sessao, c.pessoas[0]])) ?? 'sem erro',
      ).toMatch(/foreign key/)
      // a convocação sem registro (pessoa 2) sai normalmente
      expect(await tx.erro(`delete from public.sessao_participantes where sessao_id = $1 and participante_id = $2`, [c.sessao, c.pessoas[1]])).toBeNull()
    })
  })
})

describe('remarcação (6.4)', () => {
  type Tx = import('./transacao').Transacao
  async function remarcou(tx: Tx, c: import('./cenarios').Cenario, extra: Record<string, unknown> = {}) {
    return {
      sessao_id: c.sessao,
      participante_id: c.pessoas[0],
      presenca_id: await estado(tx, 'remarcou'),
      motivo_id: await motivo(tx, 'falta', 'Compromisso de trabalho'),
      motivo_texto: 'Reunião com cliente.',
      nova_data: '2026-10-18T17:00:00-03:00',
      ...extra,
    }
  }

  it('exige a nova data', async () => {
    await transacao(db, async (tx) => {
      const c = await cenarioEncontro(tx)
      const dados = await remarcou(tx, c, { nova_data: null })
      await tx.como('authenticated', c.csA)
      expect((await registrar(tx, dados)).erro ?? 'sem erro').toMatch(/nova data/)
    })
  })

  it('cria a sessão extra que repõe o encontro e convoca com o mesmo CS', async () => {
    await transacao(db, async (tx) => {
      const c = await cenarioEncontro(tx) // pessoa 1 distribuída ao CS A; quem registra é o CS B
      const dados = await remarcou(tx, c)
      await tx.como('authenticated', c.csB)
      const { erro, linhas } = await registrar(tx, dados)
      expect(erro).toBeNull()
      const [r] = await tx.query<{ sessao_extra_id: string }>(`select sessao_extra_id from public.registros_encontro where id = $1`, [linhas[0].id])
      expect(
        await tx.query(
          `select tipo, numero, repoe_numero, data::text, hora_inicio::text, hora_fim::text, formato, status from public.sessoes where id = $1`,
          [r.sessao_extra_id],
        ),
      ).toEqual([
        { tipo: 'extra', numero: null, repoe_numero: 1, data: '2026-10-18', hora_inicio: '17:00:00', hora_fim: '19:00:00', formato: 'online', status: 'agendada' },
      ])
      expect(await tx.query(`select participante_id, cs_id from public.sessao_participantes where sessao_id = $1`, [r.sessao_extra_id])).toEqual([
        { participante_id: c.pessoas[0], cs_id: c.csA },
      ])
    })
  })

  it('é tudo ou nada: se o registro falha, a sessão extra não fica', async () => {
    await transacao(db, async (tx) => {
      const c = await cenarioEncontro(tx)
      const dados = await remarcou(tx, c, { motivo_texto: '' })
      await tx.como('authenticated', c.csA)
      expect((await registrar(tx, dados)).erro ?? 'sem erro').toMatch(/texto do motivo/)
      expect(await tx.query(`select count(*)::int as n from public.sessoes where tipo = 'extra'`)).toEqual([{ n: 0 }])
    })
  })
})

describe('insert direto, sem a RPC', () => {
  it('"Veio" sem temas é barrado no fim da transação', async () => {
    await transacao(db, async (tx) => {
      const c = await cenarioEncontro(tx)
      await tx.como('authenticated', c.csA)
      const veio = await estado(tx, 'veio')
      const sql = `insert into public.registros_encontro (sessao_id, participante_id, presenca_id, modalidade, feito, planejado, status_projeto)
                   values ($1, $2, $3, 'online', 'Feito', 'Planejado', 'rodando')`
      expect(await tx.erro(sql, [c.sessao, c.pessoas[0], veio])).toBeNull() // o temas só é conferido no commit
      expect((await tx.erro(`set constraints public.registros_encontro_temas immediate`)) ?? 'sem erro').toMatch(/pelo menos um tema/)
    })
  })
})
