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
