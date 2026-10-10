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
