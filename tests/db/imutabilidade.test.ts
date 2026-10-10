import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cenarioEncontro, registrar, veioCompleto, type Cenario } from './cenarios'
import { criarCliente, type ClienteDb } from './cliente'
import { transacao, type Transacao } from './transacao'

let db: ClienteDb

beforeAll(async () => {
  db = await criarCliente()
})
afterAll(() => db?.close())

/** Cenário com um "Veio" registrado pelo CS A; volta como postgres. */
async function comRegistro(tx: Transacao): Promise<Cenario & { registro: string }> {
  const c = await cenarioEncontro(tx)
  const dados = await veioCompleto(tx, c)
  await tx.como('authenticated', c.csA)
  const { erro, linhas } = await registrar(tx, dados)
  expect(erro).toBeNull()
  await tx.comoPostgres()
  return { ...c, registro: linhas[0].id }
}

describe('registros não se alteram nem se apagam', () => {
  const ALTERACOES = [
    ['update do registro', `update public.registros_encontro set feito = 'outra coisa' where id = $1`],
    ['delete do registro', `delete from public.registros_encontro where id = $1`],
    ['update dos temas', `update public.registro_temas set tema_id = tema_id where registro_id = $1`],
    ['delete dos temas', `delete from public.registro_temas where registro_id = $1`],
  ] as const

  it.each(['cs', 'revisor', 'admin'] as const)('%s (authenticated) não altera nada', async (papel) => {
    await transacao(db, async (tx) => {
      const c = await comRegistro(tx)
      await tx.como('authenticated', { cs: c.csA, revisor: c.revisor, admin: c.admin }[papel])
      for (const [nome, sql] of ALTERACOES) expect((await tx.erro(sql, [c.registro])) ?? 'sem erro', nome).toMatch(/permission denied/)
    })
  })

  it.each(['service_role', 'postgres'] as const)('%s também não altera nada', async (papel) => {
    await transacao(db, async (tx) => {
      const c = await comRegistro(tx)
      if (papel === 'service_role') await tx.como('service_role')
      for (const [nome, sql] of ALTERACOES) expect((await tx.erro(sql, [c.registro])) ?? 'sem erro', nome).toMatch(/não se alteram nem se apagam/)
    })
  })
})

function corrigir(tx: Transacao, substitui: string, dados: Record<string, unknown>) {
  return tx.resultado<{ id: string }>(`select public.corrigir_registro_encontro($1, $2::jsonb) as id`, [substitui, JSON.stringify(dados)])
}

/** Versões do par sessão-participante, da mais antiga à mais nova, com quem é a vigente. */
function versoes(tx: Transacao, c: Cenario) {
  return tx.query<{ feito: string; registrado_por: string; vigente: boolean }>(
    `select r.feito, r.registrado_por,
            not r.anulado and not exists (select 1 from public.registros_encontro x where x.substitui_id = r.id) as vigente
     from public.registros_encontro r
     where r.sessao_id = $1 and r.participante_id = $2
     order by r.registrado_em, r.substitui_id nulls first`,
    [c.sessao, c.pessoas[0]],
  )
}

describe('correção por nova versão', () => {
  it('quem registrou corrige: nova versão vigente, a anterior continua visível', async () => {
    await transacao(db, async (tx) => {
      const c = await comRegistro(tx)
      const dados = await veioCompleto(tx, c, { feito: 'Montou o fluxo e publicou.' })
      await tx.como('authenticated', c.csA)
      expect((await corrigir(tx, c.registro, dados)).erro).toBeNull()
      expect(await versoes(tx, c)).toEqual([
        { feito: 'Montou o primeiro fluxo.', registrado_por: c.csA, vigente: false },
        { feito: 'Montou o fluxo e publicou.', registrado_por: c.csA, vigente: true },
      ])
    })
  })
})

describe('quem corrige', () => {
  it('outro cs não corrige registro alheio', async () => {
    await transacao(db, async (tx) => {
      const c = await comRegistro(tx)
      const dados = await veioCompleto(tx, c, { feito: 'Outra versão.' })
      await tx.como('authenticated', c.csB)
      expect((await corrigir(tx, c.registro, dados)).erro ?? 'sem erro').toMatch(/Só revisor ou admin corrigem/)
    })
  })

  it('revisor corrige registro alheio só com motivo de correção', async () => {
    await transacao(db, async (tx) => {
      const c = await comRegistro(tx)
      const [m] = await tx.query<{ id: string }>(`select id from public.motivos where tipo_registro = 'correcao' and rotulo = 'Dado incorreto'`)
      const [errado] = await tx.query<{ id: string }>(`select id from public.motivos where tipo_registro = 'falta' and rotulo = 'Viagem'`)
      const dados = await veioCompleto(tx, c, { feito: 'Versão do revisor.' })
      await tx.como('authenticated', c.revisor)
      expect((await corrigir(tx, c.registro, dados)).erro ?? 'sem erro').toMatch(/motivo da correção/)
      expect((await corrigir(tx, c.registro, { ...dados, correcao_motivo_id: errado.id, correcao_motivo_texto: 'x' })).erro ?? 'sem erro').toMatch(
        /motivo de correção/,
      )
      expect((await corrigir(tx, c.registro, { ...dados, correcao_motivo_id: m.id, correcao_motivo_texto: '  ' })).erro ?? 'sem erro').toMatch(
        /motivo da correção/,
      )
      expect((await corrigir(tx, c.registro, { ...dados, correcao_motivo_id: m.id, correcao_motivo_texto: 'Feito estava trocado com outro participante.' })).erro).toBeNull()
      expect((await versoes(tx, c)).map((v) => [v.registrado_por, v.vigente])).toEqual([
        [c.csA, false],
        [c.revisor, true],
      ])
    })
  })
})
