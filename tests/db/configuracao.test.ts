import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarCliente, type ClienteDb } from './cliente'
import { transacao, type Transacao } from './transacao'
import { criarUsuario } from './usuarios'

let db: ClienteDb

beforeAll(async () => {
  db = await criarCliente()
})
afterAll(() => db?.close())

/** Roda `fn` como um cs ativo. */
async function comoCs(fn: (tx: Transacao) => Promise<void>) {
  await transacao(db, async (tx) => {
    await tx.como('authenticated', await criarUsuario(tx, 'cs'))
    await fn(tx)
  })
}

describe('seeds da configuração', () => {
  it('estados de presença (6.2)', async () => {
    await comoCs(async (tx) => {
      expect(
        await tx.query(`select chave, rotulo, conta_presenca, pede_motivo, pede_nova_data, ativo from public.estados_presenca order by ordem`),
      ).toEqual([
        { chave: 'veio', rotulo: 'Veio', conta_presenca: true, pede_motivo: false, pede_nova_data: false, ativo: true },
        { chave: 'nao_veio', rotulo: 'Não veio', conta_presenca: false, pede_motivo: true, pede_nova_data: false, ativo: true },
        { chave: 'nao_respondeu', rotulo: 'Não respondeu ao convite', conta_presenca: false, pede_motivo: true, pede_nova_data: false, ativo: true },
        { chave: 'remarcou', rotulo: 'Remarcou', conta_presenca: false, pede_motivo: true, pede_nova_data: true, ativo: true },
        { chave: 'confirmou_nao_veio', rotulo: 'Confirmou e não veio', conta_presenca: false, pede_motivo: true, pede_nova_data: false, ativo: false },
      ])
    })
  })

  it('motivos por tipo de registro (6.1, mais anulação e correção)', async () => {
    await comoCs(async (tx) => {
      const rows = await tx.query<{ tipo_registro: string; rotulos: string[] }>(
        `select tipo_registro, array_agg(rotulo order by ordem) as rotulos from public.motivos where ativo group by 1 order by 1`,
      )
      expect(Object.fromEntries(rows.map((r) => [r.tipo_registro, r.rotulos]))).toEqual({
        anulacao: ['Lançado por engano', 'Duplicado', 'Outro'],
        correcao: ['Dado incorreto', 'Complemento', 'Outro'],
        falta: ['Compromisso de trabalho', 'Viagem', 'Confundiu a data', 'Imprevisto na empresa', 'Saúde', 'Depende de terceiros', 'Não informou', 'Outro'],
        recusa_weevo_start: ['Preço', 'Momento', 'Não vê valor', 'Já resolveu o que queria', 'Sem resposta', 'Outro'],
        saida_suporte: ['Não precisa de suporte', 'Desistiu', 'Participou como convidado', 'Outro'],
        suporte_extra: ['Repor encontro perdido', 'Travou na ferramenta', 'Escopo maior que o previsto', 'Não consegue vir aos encontros', 'Pedido do participante', 'Outro'],
        transferencia: ['Sem computador', 'Agenda', 'Pedido do participante', 'Outro'],
        travou: ['Acesso ou conta', 'Ferramenta', 'Dado ou integração', 'Tempo', 'Não sabe o próximo passo', 'Depende de terceiros', 'Outro'],
      })
    })
  })

  it('temas', async () => {
    await comoCs(async (tx) => {
      const rows = await tx.query<{ rotulo: string }>(`select rotulo from public.temas where ativo order by ordem`)
      expect(rows.map((r) => r.rotulo)).toEqual([
        'Cowork',
        'Sistema/aplicação',
        'Dashboard',
        'Agente',
        'Automação',
        'Banco de dados',
        'Publicar/domínio',
        'GitHub',
        'Plataforma Weevo Start',
        'Outro',
      ])
    })
  })

  it('etapas do funil Weevo Start', async () => {
    await comoCs(async (tx) => {
      expect(await tx.query(`select rotulo, final, pede_motivo, tipo_motivo from public.funil_etapas where ativo order by ordem`)).toEqual([
        { rotulo: 'Não avaliado', final: null, pede_motivo: false, tipo_motivo: null },
        { rotulo: 'Candidato', final: null, pede_motivo: false, tipo_motivo: null },
        { rotulo: 'Em abordagem', final: null, pede_motivo: false, tipo_motivo: null },
        { rotulo: 'Em conversa', final: null, pede_motivo: false, tipo_motivo: null },
        { rotulo: 'Assinou', final: 'sucesso', pede_motivo: false, tipo_motivo: null },
        { rotulo: 'Recusou', final: 'perda', pede_motivo: true, tipo_motivo: 'recusa_weevo_start' },
      ])
    })
  })

  it('pesos (6.7), faixas, limites de alerta e carga liberada', async () => {
    await comoCs(async (tx) => {
      const rows = await tx.query<{ chave: string; valor: unknown }>(`select chave, valor from public.configuracoes order by chave`)
      expect(Object.fromEntries(rows.map((r) => [r.chave, r.valor]))).toEqual({
        alertas: { sem_contato_dias: 10, contato_sem_resposta_horas: 48, sessao_sem_registro_dias: 1 },
        carga_liberada: true,
        faixas: { quente: 70, morno: 40 },
        pesos: { status_projeto: 30, presenca: 20, resposta: 15, grupo: 15, plataforma: 10, interesse: 10 },
      })
    })
  })
})

describe('validação de configuracoes', () => {
  const PESOS_OK = { status_projeto: 30, presenca: 20, resposta: 15, grupo: 15, plataforma: 10, interesse: 10 }

  it.each([
    ['pesos que não somam 100', 'pesos', { ...PESOS_OK, interesse: 20 }],
    ['peso faltando', 'pesos', { status_projeto: 30, presenca: 20, resposta: 15, grupo: 15, plataforma: 20 }],
    ['peso negativo', 'pesos', { ...PESOS_OK, status_projeto: 50, interesse: -10 }],
    ['faixa morno acima da quente', 'faixas', { quente: 40, morno: 70 }],
    ['faixa acima de 100', 'faixas', { quente: 120, morno: 40 }],
    ['carga_liberada que não é booleano', 'carga_liberada', 'sim'],
    ['alerta zerado', 'alertas', { sem_contato_dias: 0, contato_sem_resposta_horas: 48, sessao_sem_registro_dias: 1 }],
  ])('rejeita %s', async (_caso, chave, valor) => {
    await transacao(db, async (tx) => {
      expect((await tx.erro(`update public.configuracoes set valor = $2 where chave = $1`, [chave, JSON.stringify(valor)])) ?? 'sem erro').toMatch(
        /configuração inválida/i,
      )
    })
  })

  it.each([
    ['pesos', { status_projeto: 40, presenca: 20, resposta: 10, grupo: 10, plataforma: 10, interesse: 10 }],
    ['faixas', { quente: 80, morno: 50 }],
    ['carga_liberada', false],
  ])('aceita %s válido', async (chave, valor) => {
    await transacao(db, async (tx) => {
      expect(await tx.erro(`update public.configuracoes set valor = $2 where chave = $1`, [chave, JSON.stringify(valor)])).toBeNull()
    })
  })
})

describe('quem altera a configuração', () => {
  // Uma escrita por tabela; cada uma muda pelo menos uma linha quando permitida.
  const ESCRITAS: [tabela: string, sql: string][] = [
    ['estados_presenca', `update public.estados_presenca set rotulo = rotulo || ' ' where chave = 'veio' returning 1`],
    ['motivos', `insert into public.motivos (tipo_registro, rotulo, ordem) values ('falta', 'Motivo de teste', 99) returning 1`],
    ['temas', `insert into public.temas (rotulo, ordem) values ('Tema de teste', 99) returning 1`],
    ['funil_etapas', `update public.funil_etapas set ordem = ordem where rotulo = 'Candidato' returning 1`],
    ['configuracoes (carga_liberada)', `update public.configuracoes set valor = 'false' where chave = 'carga_liberada' returning 1`],
    ['configuracoes (pesos)', `update public.configuracoes set valor = valor where chave = 'pesos' returning 1`],
  ]

  async function tentar(tx: Transacao, sql: string): Promise<'gravou' | 'barrado'> {
    const { erro, linhas } = await tx.resultado(sql)
    if (erro) {
      expect(erro).toMatch(/permission denied|row-level security/)
      return 'barrado'
    }
    return linhas.length ? 'gravou' : 'barrado'
  }

  it.each(['cs', 'revisor'] as const)('%s não altera listas nem parâmetros', async (papel) => {
    for (const [tabela, sql] of ESCRITAS) {
      await transacao(db, async (tx) => {
        await tx.como('authenticated', await criarUsuario(tx, papel))
        expect(await tentar(tx, sql), tabela).toBe('barrado')
      })
    }
  })

  it('admin cria, edita e desativa', async () => {
    for (const [tabela, sql] of [...ESCRITAS, ['motivos (desativar)', `update public.motivos set ativo = false where rotulo = 'Viagem' returning 1`] as const]) {
      await transacao(db, async (tx) => {
        await tx.como('authenticated', await criarUsuario(tx, 'admin'))
        expect(await tentar(tx, sql), tabela).toBe('gravou')
      })
    }
  })

  it.each(['estados_presenca', 'motivos', 'temas', 'funil_etapas', 'configuracoes'])('ninguém apaga de %s, nem o admin', async (tabela) => {
    await transacao(db, async (tx) => {
      await tx.como('authenticated', await criarUsuario(tx, 'admin'))
      expect((await tx.erro(`delete from public.${tabela}`)) ?? 'sem erro').toMatch(/permission denied/)
    })
  })
})
