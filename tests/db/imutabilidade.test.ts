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
      // service_role não tem GRANT de UPDATE (barrado antes do trigger); o DELETE existe para o --resetar e o trigger barra.
      for (const [nome, sql] of ALTERACOES) {
        const esperado = papel === 'service_role' && nome.startsWith('update') ? /permission denied|não se alteram nem se apagam/ : /não se alteram nem se apagam/
        expect((await tx.erro(sql, [c.registro])) ?? 'sem erro', nome).toMatch(esperado)
      }
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

describe('cadeia de versões', () => {
  it('uma versão já substituída não pode ser corrigida de novo (a cadeia é linear)', async () => {
    await transacao(db, async (tx) => {
      const c = await comRegistro(tx)
      const v2 = await veioCompleto(tx, c, { feito: 'Versão 2.' })
      const v3 = await veioCompleto(tx, c, { feito: 'Versão 3 sobre a 1.' })
      await tx.como('authenticated', c.csA)
      expect((await corrigir(tx, c.registro, v2)).erro).toBeNull()
      expect((await corrigir(tx, c.registro, v3)).erro ?? 'sem erro').toMatch(/duplicate key/)
    })
  })

  it('a correção é do mesmo par sessão-participante', async () => {
    await transacao(db, async (tx) => {
      const c = await comRegistro(tx)
      const dados = await veioCompleto(tx, c, { participante_id: c.pessoas[1], substitui_id: c.registro })
      await tx.como('authenticated', c.csA)
      expect((await registrar(tx, dados)).erro ?? 'sem erro').toMatch(/foreign key/)
    })
  })
})

describe('anulação (nova versão)', () => {
  const anular = (tx: Transacao, id: string, motivoId: string | null, texto: string) =>
    tx.resultado<{ id: string }>(`select public.anular_registro_encontro($1, $2, $3) as id`, [id, motivoId, texto])
  const motivoDe = async (tx: Transacao, tipo: string, rotulo: string) =>
    (await tx.query<{ id: string }>(`select id from public.motivos where tipo_registro = $1 and rotulo = $2`, [tipo, rotulo]))[0].id

  it('anula o próprio registro com motivo: o par fica sem vigente, as versões continuam visíveis', async () => {
    await transacao(db, async (tx) => {
      const c = await comRegistro(tx)
      const m = await motivoDe(tx, 'anulacao', 'Lançado por engano')
      await tx.como('authenticated', c.csA)
      expect((await anular(tx, c.registro, m, 'Era outra pessoa.')).erro).toBeNull()
      const v = await versoes(tx, c)
      expect(v.map((x) => x.vigente)).toEqual([false, false])
      expect(await tx.query(`select anulado, correcao_motivo_texto from public.registros_encontro where substitui_id = $1`, [c.registro])).toEqual([
        { anulado: true, correcao_motivo_texto: 'Era outra pessoa.' },
      ])
    })
  })

  it.each([
    ['sem motivo', null, 'Era outra pessoa.', /motivo da anulação/],
    ['sem texto', ['anulacao', 'Duplicado'], ' ', /motivo da anulação/],
    ['com motivo de correção', ['correcao', 'Dado incorreto'], 'x', /motivo de anulação/],
  ] as const)('rejeita anulação %s', async (_caso, chip, texto, mensagem) => {
    await transacao(db, async (tx) => {
      const c = await comRegistro(tx)
      const m = chip ? await motivoDe(tx, chip[0], chip[1]) : null
      await tx.como('authenticated', c.csA)
      expect((await anular(tx, c.registro, m, texto)).erro ?? 'sem erro').toMatch(mensagem)
    })
  })

  it('outro cs não anula; revisor anula; registro anulado não se corrige nem se anula de novo', async () => {
    await transacao(db, async (tx) => {
      const c = await comRegistro(tx)
      const m = await motivoDe(tx, 'anulacao', 'Duplicado')
      await tx.como('authenticated', c.csB)
      expect((await anular(tx, c.registro, m, 'Duplicado.')).erro ?? 'sem erro').toMatch(/Só revisor ou admin/)
      await tx.comoPostgres()
      await tx.como('authenticated', c.revisor)
      const { erro, linhas } = await anular(tx, c.registro, m, 'Duplicado.')
      expect(erro).toBeNull()
      expect((await anular(tx, linhas[0].id, m, 'De novo.')).erro ?? 'sem erro').toMatch(/anulado não pode/)
      expect((await corrigir(tx, linhas[0].id, await veioCompleto(tx, c))).erro ?? 'sem erro').toMatch(/anulado não pode/)
    })
  })
})

describe('exceção do --resetar (carga da planilha)', () => {
  /** Registro de carga com um tema, gravado como service_role; volta como postgres. */
  async function comCarga(tx: Transacao) {
    const c = await cenarioEncontro(tx)
    const [veio] = await tx.query<{ id: string }>(`select id from public.estados_presenca where chave = 'veio'`)
    const [tema] = await tx.query<{ id: string }>(`select id from public.temas where rotulo = 'Agente'`)
    await tx.como('service_role')
    const [r] = await tx.query<{ id: string }>(
      `insert into public.registros_encontro (sessao_id, participante_id, presenca_id, modalidade, origem) values ($1, $2, $3, 'presencial', 'import') returning id`,
      [c.sessao, c.pessoas[1], veio.id],
    )
    await tx.query(`insert into public.registro_temas (registro_id, tema_id) values ($1, $2)`, [r.id, tema.id])
    await tx.comoPostgres()
    return { ...c, carga: r.id }
  }
  const apagarCarga = (tx: Transacao, id: string) =>
    tx.erro(`with t as (delete from public.registro_temas where registro_id = $1) delete from public.registros_encontro where id = $1`, [id])

  it('service_role apaga registro de carga com carga liberada', async () => {
    await transacao(db, async (tx) => {
      const c = await comCarga(tx)
      await tx.como('service_role')
      expect(await tx.erro(`delete from public.registro_temas where registro_id = $1`, [c.carga])).toBeNull()
      expect(await tx.erro(`delete from public.registros_encontro where id = $1`, [c.carga])).toBeNull()
      expect(await tx.query(`select count(*)::int as n from public.registros_encontro where id = $1`, [c.carga])).toEqual([{ n: 0 }])
    })
  })

  it('com carga_liberada = false, nem o service_role apaga', async () => {
    await transacao(db, async (tx) => {
      const c = await comCarga(tx)
      await tx.query(`update public.configuracoes set valor = 'false' where chave = 'carga_liberada'`)
      await tx.como('service_role')
      expect((await apagarCarga(tx, c.carga)) ?? 'sem erro').toMatch(/não se alteram nem se apagam/)
    })
  })

  it('postgres sem JWT e authenticated não apagam carga', async () => {
    await transacao(db, async (tx) => {
      const c = await comCarga(tx)
      expect((await apagarCarga(tx, c.carga)) ?? 'sem erro').toMatch(/não se alteram nem se apagam/)
      await tx.como('authenticated', c.admin)
      expect((await apagarCarga(tx, c.carga)) ?? 'sem erro').toMatch(/permission denied/)
    })
  })

  it('registro manual nunca se apaga, nem pelo service_role com carga liberada', async () => {
    await transacao(db, async (tx) => {
      const c = await comRegistro(tx)
      await tx.como('service_role')
      expect((await apagarCarga(tx, c.registro)) ?? 'sem erro').toMatch(/não se alteram nem se apagam/)
    })
  })

  it('update de carga continua proibido', async () => {
    await transacao(db, async (tx) => {
      const c = await comCarga(tx)
      await tx.como('service_role')
      expect((await tx.erro(`update public.registros_encontro set modalidade = 'online' where id = $1`, [c.carga])) ?? 'sem erro').toMatch(
        /permission denied|não se alteram nem se apagam/,
      )
    })
  })
})
