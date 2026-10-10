import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarCliente, type ClienteDb } from './cliente'
import { transacao } from './transacao'
import { criarUsuario } from './usuarios'

let db: ClienteDb

beforeAll(async () => {
  db = await criarCliente()
})
afterAll(() => db?.close())

describe('turmas', () => {
  it('in_company exige empresa e aberta não aceita empresa', async () => {
    await transacao(db, async (tx) => {
      const [e] = await tx.query<{ id: string }>(`insert into public.empresas (nome) values ('Empresa Fictícia') returning id`)
      expect(await tx.erro(`insert into public.turmas (nome, tipo, empresa_id, modelo_suporte) values ('In company A', 'in_company', $1, 'plantao')`, [e.id])).toBeNull()
      expect(await tx.erro(`insert into public.turmas (nome, tipo, modelo_suporte) values ('Aberta A', 'aberta', 'horario_escolhido')`)).toBeNull()
      expect((await tx.erro(`insert into public.turmas (nome, tipo, modelo_suporte) values ('In company B', 'in_company', 'plantao')`)) ?? 'sem erro').toMatch(/check constraint/)
      expect((await tx.erro(`insert into public.turmas (nome, tipo, empresa_id, modelo_suporte) values ('Aberta B', 'aberta', $1, 'plantao')`, [e.id])) ?? 'sem erro').toMatch(/check constraint/)
    })
  })
})

describe('registrado_por', () => {
  it('é sempre o usuário da sessão, nunca o valor enviado', async () => {
    await transacao(db, async (tx) => {
      const quem = await criarUsuario(tx, 'revisor')
      const outro = await criarUsuario(tx, 'revisor')
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: quem })])
      const [e] = await tx.query<{ registrado_por: string }>(
        `insert into public.empresas (nome, registrado_por) values ('Empresa Fictícia', $1) returning registrado_por`,
        [outro],
      )
      const [t] = await tx.query<{ registrado_por: string }>(
        `insert into public.turmas (nome, tipo, modelo_suporte, registrado_por) values ('Turma X', 'aberta', 'plantao', $1) returning registrado_por`,
        [outro],
      )
      expect([e.registrado_por, t.registrado_por]).toEqual([quem, quem])
    })
  })
})

describe('participantes', () => {
  async function turma(tx: import('./transacao').Transacao, nome = 'Turma Teste') {
    const [t] = await tx.query<{ id: string }>(`insert into public.turmas (nome, tipo, modelo_suporte) values ($1, 'aberta', 'plantao') returning id`, [nome])
    return t.id
  }
  const inserir = (tx: import('./transacao').Transacao, turmaId: string, extra: Record<string, unknown> = {}) => {
    const campos = { nome: 'Pessoa Fictícia', turma_imersao_id: turmaId, ...extra }
    const cols = Object.keys(campos)
    return tx.erro(
      `insert into public.participantes (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})`,
      Object.values(campos),
    )
  }

  it('telefone precisa estar em E.164 do Brasil', async () => {
    await transacao(db, async (tx) => {
      const t = await turma(tx)
      expect(await inserir(tx, t, { telefone: '+5584999990000' })).toBeNull()
      expect((await inserir(tx, t, { telefone: '84 99999-0000' })) ?? 'sem erro').toMatch(/check constraint/)
    })
  })

  it('telefone e e-mail são únicos (e-mail sem diferenciar maiúsculas)', async () => {
    await transacao(db, async (tx) => {
      const t = await turma(tx)
      expect(await inserir(tx, t, { telefone: '+5584999990000', email: 'pessoa@exemplo.invalid' })).toBeNull()
      expect((await inserir(tx, t, { telefone: '+5584999990000' })) ?? 'sem erro').toMatch(/duplicate key/)
      expect((await inserir(tx, t, { email: 'PESSOA@exemplo.invalid' })) ?? 'sem erro').toMatch(/duplicate key/)
      expect(await inserir(tx, t)).toBeNull() // sem telefone nem e-mail, pode repetir
      expect(await inserir(tx, t)).toBeNull()
    })
  })

  it('situacao nasce ativo e só aceita ativo ou fora_do_suporte', async () => {
    await transacao(db, async (tx) => {
      const t = await turma(tx)
      expect(await inserir(tx, t)).toBeNull()
      expect(await tx.query(`select situacao from public.participantes`)).toEqual([{ situacao: 'ativo' }])
      expect(await inserir(tx, t, { situacao: 'fora_do_suporte' })).toBeNull()
      expect((await inserir(tx, t, { situacao: 'inativo' })) ?? 'sem erro').toMatch(/check constraint/)
    })
  })

  it('dias da imersão não se repetem na turma', async () => {
    await transacao(db, async (tx) => {
      const t = await turma(tx)
      expect(await tx.erro(`insert into public.imersao_dias (turma_id, data, ordem) values ($1, '2026-10-01', 1), ($1, '2026-10-02', 2)`, [t])).toBeNull()
      expect((await tx.erro(`insert into public.imersao_dias (turma_id, data, ordem) values ($1, '2026-10-03', 1)`, [t])) ?? 'sem erro').toMatch(/duplicate key/)
      expect((await tx.erro(`insert into public.imersao_dias (turma_id, data, ordem) values ($1, '2026-10-01', 3)`, [t])) ?? 'sem erro').toMatch(/duplicate key/)
    })
  })
})

describe('turma de suporte', () => {
  it('nasce igual à da imersão, mesmo se o cliente mandar outra', async () => {
    await transacao(db, async (tx) => {
      const [a] = await tx.query<{ id: string }>(`insert into public.turmas (nome, tipo, modelo_suporte) values ('Turma A', 'aberta', 'plantao') returning id`)
      const [b] = await tx.query<{ id: string }>(`insert into public.turmas (nome, tipo, modelo_suporte) values ('Turma B', 'aberta', 'plantao') returning id`)
      const [p] = await tx.query<{ turma_suporte_id: string }>(
        `insert into public.participantes (nome, turma_imersao_id, turma_suporte_id) values ('Pessoa Fictícia', $1, $2) returning turma_suporte_id`,
        [a.id, b.id],
      )
      expect(p.turma_suporte_id).toBe(a.id)
    })
  })
})

describe('quem cadastra (D2: revisor e admin)', () => {
  type Tx = import('./transacao').Transacao
  /** Prepara, como postgres, uma turma e um participante para os testes de update. */
  async function base(tx: Tx) {
    const [t] = await tx.query<{ id: string }>(`insert into public.turmas (nome, tipo, modelo_suporte) values ('Turma Base', 'aberta', 'plantao') returning id`)
    const [p] = await tx.query<{ id: string }>(`insert into public.participantes (nome, turma_imersao_id) values ('Pessoa Base', $1) returning id`, [t.id])
    return { turma: t.id, participante: p.id }
  }
  const ESCRITAS = (b: { turma: string; participante: string }): [string, string, unknown[]][] => [
    ['empresas', `insert into public.empresas (nome) values ('Empresa Nova') returning 1`, []],
    ['turmas', `insert into public.turmas (nome, tipo, modelo_suporte) values ('Turma Nova', 'aberta', 'plantao') returning 1`, []],
    ['turmas (update)', `update public.turmas set link_grupo = 'https://exemplo.invalid' where id = $1 returning 1`, [b.turma]],
    ['imersao_dias', `insert into public.imersao_dias (turma_id, data, ordem) values ($1, '2026-10-01', 1) returning 1`, [b.turma]],
    ['participantes', `insert into public.participantes (nome, turma_imersao_id) values ('Pessoa Nova', $1) returning 1`, [b.turma]],
    ['participantes (update)', `update public.participantes set apelido = 'Apelido' where id = $1 returning 1`, [b.participante]],
  ]

  async function tentar(tx: Tx, sql: string, params: unknown[]) {
    const { erro, linhas } = await tx.resultado(sql, params)
    if (erro) {
      expect(erro).toMatch(/permission denied|row-level security/)
      return 'barrado'
    }
    return linhas.length ? 'gravou' : 'barrado'
  }

  it.each([
    ['cs', 'barrado'],
    ['revisor', 'gravou'],
    ['admin', 'gravou'],
  ] as const)('%s → %s', async (papel, esperado) => {
    await transacao(db, async (tx) => {
      const b = await base(tx)
      const id = await criarUsuario(tx, papel)
      await tx.como('authenticated', id)
      for (const [nome, sql, params] of ESCRITAS(b)) expect(await tentar(tx, sql, params), nome).toBe(esperado)
    })
  })

  it('todo membro ativo lê o cadastro', async () => {
    await transacao(db, async (tx) => {
      await base(tx)
      await tx.query(`insert into public.empresas (nome) values ('Empresa Lida')`)
      await tx.como('authenticated', await criarUsuario(tx, 'cs'))
      const [r] = await tx.query<Record<string, number>>(
        `select (select count(*) from public.empresas)::int e, (select count(*) from public.turmas)::int t, (select count(*) from public.participantes)::int p`,
      )
      expect(r).toEqual({ e: 1, t: 1, p: 1 })
    })
  })

  it('quem alterou o participante fica em atualizado_por', async () => {
    await transacao(db, async (tx) => {
      const b = await base(tx)
      const revisor = await criarUsuario(tx, 'revisor')
      await tx.como('authenticated', revisor)
      const [p] = await tx.query<{ atualizado_por: string }>(
        `update public.participantes set apelido = 'Novo' where id = $1 returning atualizado_por`,
        [b.participante],
      )
      expect(p.atualizado_por).toBe(revisor)
    })
  })
})

describe('dupla', () => {
  type Tx = import('./transacao').Transacao
  async function pessoas(tx: Tx, n: number, turmaNome = 'Turma Dupla') {
    const [t] = await tx.query<{ id: string }>(
      `insert into public.turmas (nome, tipo, modelo_suporte) values ($1, 'aberta', 'plantao') on conflict (nome) do update set nome = excluded.nome returning id`,
      [turmaNome],
    )
    const ids: string[] = []
    for (let i = 0; i < n; i++) {
      const [p] = await tx.query<{ id: string }>(`insert into public.participantes (nome, turma_imersao_id) values ($1, $2) returning id`, [`Pessoa ${turmaNome} ${i}`, t.id])
      ids.push(p.id)
    }
    return ids
  }
  const parceiros = (tx: Tx, ids: string[]) =>
    tx.query<{ id: string; parceiro_presenca_id: string | null }>(`select id, parceiro_presenca_id from public.participantes where id = any ($1) order by id`, [ids])

  it('definir_dupla grava os dois lados; desfazer_dupla limpa os dois', async () => {
    await transacao(db, async (tx) => {
      const [a, b] = await pessoas(tx, 2)
      await tx.como('authenticated', await criarUsuario(tx, 'revisor'))
      await tx.query(`select public.definir_dupla($1, $2)`, [a, b])
      expect(Object.fromEntries((await parceiros(tx, [a, b])).map((r) => [r.id, r.parceiro_presenca_id]))).toEqual({ [a]: b, [b]: a })
      await tx.query(`select public.desfazer_dupla($1)`, [b])
      expect((await parceiros(tx, [a, b])).map((r) => r.parceiro_presenca_id)).toEqual([null, null])
    })
  })

  it.each([
    ['a mesma pessoa', 'si', /consigo mesm/],
    ['quem já tem dupla', 'ocupado', /já tem dupla/],
    ['turmas de suporte diferentes', 'turma', /mesma turma de suporte/],
  ] as const)('rejeita %s', async (_caso, situacao, mensagem) => {
    await transacao(db, async (tx) => {
      const [a, b, c] = await pessoas(tx, 3)
      const [x] = await pessoas(tx, 1, 'Outra Turma')
      await tx.como('authenticated', await criarUsuario(tx, 'revisor'))
      if (situacao === 'ocupado') await tx.query(`select public.definir_dupla($1, $2)`, [a, b])
      const alvo = { si: [a, a], ocupado: [c, a], turma: [a, x] }[situacao]
      expect((await tx.erro(`select public.definir_dupla($1, $2)`, alvo)) ?? 'sem erro').toMatch(mensagem)
    })
  })

  it('cs não define dupla', async () => {
    await transacao(db, async (tx) => {
      const [a, b] = await pessoas(tx, 2)
      await tx.como('authenticated', await criarUsuario(tx, 'cs'))
      expect((await tx.erro(`select public.definir_dupla($1, $2)`, [a, b])) ?? 'sem erro').toMatch(/Apenas revisor ou admin/)
    })
  })
})

describe('o que não se escreve direto', () => {
  type Tx = import('./transacao').Transacao
  async function participante(tx: Tx) {
    const [t] = await tx.query<{ id: string }>(`insert into public.turmas (nome, tipo, modelo_suporte) values ('Turma D', 'aberta', 'plantao') returning id`)
    const [p] = await tx.query<{ id: string }>(`insert into public.participantes (nome, turma_imersao_id) values ('Pessoa D', $1) returning id`, [t.id])
    return { turma: t.id, participante: p.id }
  }

  it.each(['situacao', 'turma_suporte_id', 'projeto', 'parceiro_presenca_id', 'turma_imersao_id'])(
    'admin não altera %s direto',
    async (coluna) => {
      await transacao(db, async (tx) => {
        const b = await participante(tx)
        await tx.como('authenticated', await criarUsuario(tx, 'admin'))
        const valor = { situacao: 'fora_do_suporte', projeto: 'X' }[coluna] ?? b.turma
        expect((await tx.erro(`update public.participantes set ${coluna} = $2 where id = $1`, [b.participante, valor])) ?? 'sem erro').toMatch(
          /permission denied/,
        )
      })
    },
  )

  it.each(['situacao', 'turma_suporte_id', 'projeto', 'parceiro_presenca_id'])('revisor não informa %s ao cadastrar', async (coluna) => {
    await transacao(db, async (tx) => {
      const b = await participante(tx)
      await tx.como('authenticated', await criarUsuario(tx, 'revisor'))
      const valor = { situacao: 'ativo', projeto: 'X', parceiro_presenca_id: b.participante }[coluna] ?? b.turma
      expect(
        (await tx.erro(`insert into public.participantes (nome, turma_imersao_id, ${coluna}) values ('Nova', $1, $2)`, [b.turma, valor])) ?? 'sem erro',
      ).toMatch(/permission denied/)
    })
  })
})

describe('nada de cadastro se apaga', () => {
  it.each(['empresas', 'turmas', 'imersao_dias', 'participantes'])('ninguém apaga de %s, nem o admin', async (tabela) => {
    await transacao(db, async (tx) => {
      await tx.como('authenticated', await criarUsuario(tx, 'admin'))
      expect((await tx.erro(`delete from public.${tabela}`)) ?? 'sem erro').toMatch(/permission denied/)
    })
  })

  it('turma com participante não sai nem pelo postgres (RESTRICT)', async () => {
    await transacao(db, async (tx) => {
      const [t] = await tx.query<{ id: string }>(`insert into public.turmas (nome, tipo, modelo_suporte) values ('Turma R', 'aberta', 'plantao') returning id`)
      await tx.query(`insert into public.participantes (nome, turma_imersao_id) values ('Pessoa R', $1)`, [t.id])
      expect((await tx.erro(`delete from public.turmas where id = $1`, [t.id])) ?? 'sem erro').toMatch(/foreign key/)
    })
  })

  it('revisor arquiva turma, empresa e participante', async () => {
    await transacao(db, async (tx) => {
      const [e] = await tx.query<{ id: string }>(`insert into public.empresas (nome) values ('Empresa A') returning id`)
      const [t] = await tx.query<{ id: string }>(`insert into public.turmas (nome, tipo, modelo_suporte) values ('Turma A', 'aberta', 'plantao') returning id`)
      const [p] = await tx.query<{ id: string }>(`insert into public.participantes (nome, turma_imersao_id) values ('Pessoa A', $1) returning id`, [t.id])
      await tx.como('authenticated', await criarUsuario(tx, 'revisor'))
      expect(await tx.query(`update public.empresas set arquivada = true where id = $1 returning arquivada`, [e.id])).toEqual([{ arquivada: true }])
      expect(await tx.query(`update public.turmas set arquivada = true where id = $1 returning arquivada`, [t.id])).toEqual([{ arquivada: true }])
      expect(await tx.query(`update public.participantes set arquivado = true where id = $1 returning arquivado`, [p.id])).toEqual([{ arquivado: true }])
    })
  })
})
