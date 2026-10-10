import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cenarioEncontro, motivo, type Cenario } from './cenarios'
import { criarCliente, type ClienteDb } from './cliente'
import { transacao, type Transacao } from './transacao'

let db: ClienteDb

beforeAll(async () => {
  db = await criarCliente()
})
afterAll(() => db?.close())

export function registrarEvento(tx: Transacao, dados: Record<string, unknown>) {
  return tx.resultado<{ id: string }>(`select public.registrar_evento($1::jsonb) as id`, [JSON.stringify(dados)])
}

/** Cenário de encontro mais um dia de imersão, uma outra turma e as etapas do funil. */
async function cenarioEventos(tx: Transacao) {
  const c = await cenarioEncontro(tx)
  const [dia] = await tx.query<{ id: string }>(`insert into public.imersao_dias (turma_id, data, ordem) values ($1, '2026-10-01', 1) returning id`, [c.turma])
  const [outra] = await tx.query<{ id: string }>(`insert into public.turmas (nome, tipo, modelo_suporte) values ('Turma Outubro', 'aberta', 'plantao') returning id`)
  const etapas = Object.fromEntries(
    (await tx.query<{ rotulo: string; id: string }>(`select rotulo, id from public.funil_etapas`)).map((e) => [e.rotulo, e.id]),
  )
  return { ...c, dia: dia.id, outraTurma: outra.id, etapas }
}

type CenarioEventos = Cenario & { dia: string; outraTurma: string; etapas: Record<string, string> }

describe('dados validados por tipo (5.3)', () => {
  // [tipo, dados válidos, dados inválidos, motivo exigido (tipo, rótulo) ou null]
  const CASOS: [string, (c: CenarioEventos) => object, (c: CenarioEventos) => object, [string, string] | null][] = [
    ['imersao_presenca', (c) => ({ dia: c.dia, presente: true }), (c) => ({ dia: c.dia }), null],
    ['projeto_definido', () => ({ projeto: 'Agente de atendimento' }), () => ({ projeto: ' ' }), null],
    ['cadastro_plataforma', () => ({ valor: 'informou_que_iria', conferido: false }), () => ({ valor: 'talvez', conferido: false }), null],
    ['contato_privado', () => ({ objetivo: 'convite', texto: 'Convite para o encontro 2.' }), () => ({ objetivo: 'cobranca' }), null],
    ['resposta_recebida', () => ({ texto: 'Confirmou.' }), () => ({ texto: 42 }), null],
    ['suporte_extra_pedido', () => ({}), () => ({ inesperado: true }), ['suporte_extra', 'Pedido do participante']],
    ['suporte_transferido', (c) => ({ de_turma: c.turma, para_turma: c.outraTurma }), (c) => ({ de_turma: c.turma }), ['transferencia', 'Sem computador']],
    ['saiu_do_suporte', () => ({}), () => ({ x: 1 }), ['saida_suporte', 'Não precisa de suporte']],
    ['retornou_ao_suporte', () => ({}), () => ({ x: 1 }), null],
    ['pesquisa', () => ({ tipo: 'nps_suporte', respondeu: true, nota: 9 }), () => ({ tipo: 'nps_suporte' }), null],
    ['dificuldade', () => ({ texto: 'Integração com a planilha.' }), () => ({}), null],
    ['interacao_grupo', () => ({ estado: 'so_le' }), () => ({ estado: 'as_vezes' }), null],
    ['sinal_interesse', () => ({ texto: 'Perguntou o preço do Start.' }), () => ({ texto: '' }), null],
    ['funil_etapa', (c) => ({ para: c.etapas['Em abordagem'] }), () => ({}), null],
    ['ganho_declarado', () => ({ antes: '4 horas', depois: '30 minutos', unidade: 'por relatório' }), () => ({ antes: '4 horas' }), null],
    ['evidencia', () => ({ descricao: 'Print do painel.' }), () => ({ descricao: 7 }), null],
    ['depoimento', () => ({ frase: 'Agora faço em minutos o que levava horas.' }), () => ({ frase: null }), null],
    ['nota', () => ({ texto: 'Pediu para falar só à tarde.' }), () => ({}), null],
  ]

  it.each(CASOS)('%s: aceita o válido e rejeita o inválido', async (tipo, valido, invalido, chip) => {
    await transacao(db, async (tx) => {
      const c = await cenarioEventos(tx)
      const base = {
        participante_id: c.pessoas[0],
        tipo,
        ...(tipo === 'nota' ? { fase: 'suporte' } : {}),
        ...(chip ? { motivo_id: await motivo(tx, chip[0], chip[1]), motivo_texto: 'Contexto do motivo.' } : {}),
      }
      await tx.como('authenticated', c.csA)
      expect((await registrarEvento(tx, { ...base, dados: valido(c) })).erro, 'válido').toBeNull()
      expect((await registrarEvento(tx, { ...base, dados: invalido(c) })).erro ?? 'sem erro', 'inválido').toMatch(/dados inválidos/i)
    })
  })
})

describe('motivo e fase por tipo', () => {
  // Tipos que pedem motivo (6.1): [tipo, dados, chip certo, chip de outro tipo]
  const PEDEM_MOTIVO: [string, (c: CenarioEventos) => object, [string, string], [string, string]][] = [
    ['suporte_extra_pedido', () => ({}), ['suporte_extra', 'Repor encontro perdido'], ['falta', 'Viagem']],
    ['suporte_transferido', (c) => ({ para_turma: c.outraTurma }), ['transferencia', 'Agenda'], ['falta', 'Viagem']],
    ['saiu_do_suporte', () => ({}), ['saida_suporte', 'Desistiu'], ['travou', 'Tempo']],
    ['imersao_presenca', (c) => ({ dia: c.dia, presente: false }), ['falta', 'Saúde'], ['saida_suporte', 'Desistiu']],
  ]

  it.each(PEDEM_MOTIVO)('%s exige chip do tipo certo e texto', async (tipo, dados, certo, errado) => {
    await transacao(db, async (tx) => {
      const c = await cenarioEventos(tx)
      const base = { participante_id: c.pessoas[0], tipo, dados: dados(c) }
      const m = await motivo(tx, ...certo)
      const outro = await motivo(tx, ...errado)
      await tx.como('authenticated', c.csA)
      expect((await registrarEvento(tx, base)).erro ?? 'sem erro', 'sem chip').toMatch(/Escolha o motivo/)
      expect((await registrarEvento(tx, { ...base, motivo_id: outro, motivo_texto: 'x' })).erro ?? 'sem erro', 'outro tipo').toMatch(/motivo do tipo/)
      expect((await registrarEvento(tx, { ...base, motivo_id: m, motivo_texto: ' ' })).erro ?? 'sem erro', 'sem texto').toMatch(/texto do motivo/)
      expect((await registrarEvento(tx, { ...base, motivo_id: m, motivo_texto: 'Contexto.' })).erro, 'completo').toBeNull()
    })
  })

  it('presença na imersão com presente = true não pede motivo', async () => {
    await transacao(db, async (tx) => {
      const c = await cenarioEventos(tx)
      await tx.como('authenticated', c.csA)
      expect((await registrarEvento(tx, { participante_id: c.pessoas[0], tipo: 'imersao_presenca', dados: { dia: c.dia, presente: true } })).erro).toBeNull()
    })
  })

  it('fase precisa combinar com o tipo; nota exige a fase', async () => {
    await transacao(db, async (tx) => {
      const c = await cenarioEventos(tx)
      await tx.como('authenticated', c.csA)
      expect(
        (await registrarEvento(tx, { participante_id: c.pessoas[0], tipo: 'interacao_grupo', fase: 'fechamento', dados: { estado: 'sim' } })).erro ?? 'sem erro',
      ).toMatch(/fase/)
      expect((await registrarEvento(tx, { participante_id: c.pessoas[0], tipo: 'nota', dados: { texto: 'Sem fase.' } })).erro ?? 'sem erro').toMatch(/fase/)
      const { linhas } = await registrarEvento(tx, { participante_id: c.pessoas[0], tipo: 'interacao_grupo', dados: { estado: 'sim' } })
      expect(await tx.query(`select fase from public.eventos where id = $1`, [linhas[0].id])).toEqual([{ fase: 'comunidade' }])
    })
  })
})

const anularEvento = (tx: Transacao, id: string, motivoId: string | null, texto: string) =>
  tx.resultado<{ id: string }>(`select public.anular_evento($1, $2, $3) as id`, [id, motivoId, texto])
const corrigirEvento = (tx: Transacao, id: string, dados: Record<string, unknown>) =>
  tx.resultado<{ id: string }>(`select public.corrigir_evento($1, $2::jsonb) as id`, [id, JSON.stringify(dados)])
const vigentes = (tx: Transacao, participante: string, tipo: string) =>
  tx.query<{ dados: unknown; registrado_por: string }>(
    `select e.dados, e.registrado_por from public.eventos e
     where e.participante_id = $1 and e.tipo = $2 and not e.anulado
       and not exists (select 1 from public.eventos x where x.substitui_id = e.id)`,
    [participante, tipo],
  )

describe('correção e anulação de eventos', () => {
  async function comNota(tx: Transacao) {
    const c = await cenarioEventos(tx)
    await tx.como('authenticated', c.csA)
    const { linhas } = await registrarEvento(tx, { participante_id: c.pessoas[0], tipo: 'nota', fase: 'suporte', dados: { texto: 'Primeira versão.' } })
    await tx.comoPostgres()
    return { ...c, nota: linhas[0].id }
  }

  it('o autor corrige: a nova versão é a vigente', async () => {
    await transacao(db, async (tx) => {
      const c = await comNota(tx)
      await tx.como('authenticated', c.csA)
      expect((await corrigirEvento(tx, c.nota, { tipo: 'nota', fase: 'suporte', dados: { texto: 'Segunda versão.' } })).erro).toBeNull()
      expect(await vigentes(tx, c.pessoas[0], 'nota')).toEqual([{ dados: { texto: 'Segunda versão.' }, registrado_por: c.csA }])
    })
  })

  it('a correção mantém o tipo do evento (trocar o tipo é anular e registrar outro)', async () => {
    await transacao(db, async (tx) => {
      const c = await comNota(tx)
      await tx.como('authenticated', c.csA)
      expect((await corrigirEvento(tx, c.nota, { tipo: 'dificuldade', dados: { texto: 'Outra coisa.' } })).erro ?? 'sem erro').toMatch(/mantém o tipo/)
    })
  })

  it('anular exige motivo de anulação; o evento anulado sai dos vigentes', async () => {
    await transacao(db, async (tx) => {
      const c = await comNota(tx)
      const anulacao = await motivo(tx, 'anulacao', 'Lançado por engano')
      const correcao = await motivo(tx, 'correcao', 'Dado incorreto')
      await tx.como('authenticated', c.csA)
      expect((await anularEvento(tx, c.nota, null, 'x')).erro ?? 'sem erro').toMatch(/motivo da anulação/)
      expect((await anularEvento(tx, c.nota, correcao, 'x')).erro ?? 'sem erro').toMatch(/motivo de anulação/)
      expect((await anularEvento(tx, c.nota, anulacao, ' ')).erro ?? 'sem erro').toMatch(/motivo da anulação/)
      expect((await anularEvento(tx, c.nota, anulacao, 'Era de outra pessoa.')).erro).toBeNull()
      expect(await vigentes(tx, c.pessoas[0], 'nota')).toEqual([])
    })
  })

  it('outro cs não corrige nem anula; revisor só com motivo', async () => {
    await transacao(db, async (tx) => {
      const c = await comNota(tx)
      const anulacao = await motivo(tx, 'anulacao', 'Duplicado')
      const correcao = await motivo(tx, 'correcao', 'Complemento')
      const nova = { tipo: 'nota', fase: 'suporte', dados: { texto: 'Outra.' } }
      await tx.como('authenticated', c.csB)
      expect((await corrigirEvento(tx, c.nota, nova)).erro ?? 'sem erro').toMatch(/Só revisor ou admin/)
      expect((await anularEvento(tx, c.nota, anulacao, 'x')).erro ?? 'sem erro').toMatch(/Só revisor ou admin/)
      await tx.comoPostgres()
      await tx.como('authenticated', c.revisor)
      expect((await corrigirEvento(tx, c.nota, nova)).erro ?? 'sem erro').toMatch(/motivo da correção/)
      expect((await corrigirEvento(tx, c.nota, { ...nova, correcao_motivo_id: correcao, correcao_motivo_texto: 'Completei.' })).erro).toBeNull()
    })
  })
})

describe('estado do participante derivado dos eventos', () => {
  const participante = (tx: Transacao, id: string) =>
    tx.query<{ situacao: string; turma_suporte_id: string; projeto: string | null }>(
      `select situacao, turma_suporte_id, projeto from public.participantes where id = $1`,
      [id],
    ).then((r) => r[0])

  it('saiu_do_suporte leva a fora_do_suporte; retornou_ao_suporte volta a ativo', async () => {
    await transacao(db, async (tx) => {
      const c = await cenarioEventos(tx)
      const m = await motivo(tx, 'saida_suporte', 'Não precisa de suporte')
      await tx.como('authenticated', c.csA)
      await registrarEvento(tx, { participante_id: c.pessoas[0], tipo: 'saiu_do_suporte', motivo_id: m, motivo_texto: 'Já resolveu.', ocorrido_em: '2026-10-05T10:00:00Z' })
      expect((await participante(tx, c.pessoas[0])).situacao).toBe('fora_do_suporte')
      expect((await registrarEvento(tx, { participante_id: c.pessoas[0], tipo: 'retornou_ao_suporte', ocorrido_em: '2026-10-08T10:00:00Z' })).erro).toBeNull()
      expect((await participante(tx, c.pessoas[0])).situacao).toBe('ativo')
    })
  })

  it('anular o saiu_do_suporte devolve o ativo', async () => {
    await transacao(db, async (tx) => {
      const c = await cenarioEventos(tx)
      const m = await motivo(tx, 'saida_suporte', 'Desistiu')
      const a = await motivo(tx, 'anulacao', 'Lançado por engano')
      await tx.como('authenticated', c.csA)
      const { linhas } = await registrarEvento(tx, { participante_id: c.pessoas[0], tipo: 'saiu_do_suporte', motivo_id: m, motivo_texto: 'Desistiu.' })
      expect((await participante(tx, c.pessoas[0])).situacao).toBe('fora_do_suporte')
      expect((await anularEvento(tx, linhas[0].id, a, 'Era outra pessoa.')).erro).toBeNull()
      expect((await participante(tx, c.pessoas[0])).situacao).toBe('ativo')
    })
  })

  it('suporte_transferido muda a turma de suporte; anular volta para a da imersão', async () => {
    await transacao(db, async (tx) => {
      const c = await cenarioEventos(tx)
      const m = await motivo(tx, 'transferencia', 'Sem computador')
      const a = await motivo(tx, 'anulacao', 'Lançado por engano')
      await tx.como('authenticated', c.csA)
      const { linhas } = await registrarEvento(tx, {
        participante_id: c.pessoas[0],
        tipo: 'suporte_transferido',
        dados: { de_turma: c.turma, para_turma: c.outraTurma },
        motivo_id: m,
        motivo_texto: 'Vai fazer com a turma de outubro.',
      })
      expect((await participante(tx, c.pessoas[0])).turma_suporte_id).toBe(c.outraTurma)
      await anularEvento(tx, linhas[0].id, a, 'Transferência cancelada.')
      expect((await participante(tx, c.pessoas[0])).turma_suporte_id).toBe(c.turma)
    })
  })

  it('projeto_definido preenche o projeto; a correção troca', async () => {
    await transacao(db, async (tx) => {
      const c = await cenarioEventos(tx)
      await tx.como('authenticated', c.csA)
      const { linhas } = await registrarEvento(tx, { participante_id: c.pessoas[0], tipo: 'projeto_definido', dados: { projeto: 'Agente de vendas' } })
      expect((await participante(tx, c.pessoas[0])).projeto).toBe('Agente de vendas')
      await corrigirEvento(tx, linhas[0].id, { tipo: 'projeto_definido', dados: { projeto: 'Agente de atendimento' } })
      expect((await participante(tx, c.pessoas[0])).projeto).toBe('Agente de atendimento')
    })
  })
})
