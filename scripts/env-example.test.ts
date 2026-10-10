import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { segredosPreenchidos } from './env-example'

// Valores fictícios, só com o formato de segredo.
const TOKEN_FALSO = 'sbp_' + '0'.repeat(40)

describe('segredosPreenchidos', () => {
  it.each([
    ['SUPABASE_DB_PASSWORD=senha-qualquer', 'SUPABASE_DB_PASSWORD'],
    ['SUPABASE_ACCESS_TOKEN=' + TOKEN_FALSO, 'SUPABASE_ACCESS_TOKEN'],
    ['SUPABASE_SERVICE_ROLE_KEY=eyJabc.def.ghi', 'SUPABASE_SERVICE_ROLE_KEY'],
    ['GITHUB_TOKEN=abc', 'GITHUB_TOKEN'],
    ['STRIPE_SECRET_KEY=sk_test_abc', 'STRIPE_SECRET_KEY'],
    ['JWT_SECRET="abc"', 'JWT_SECRET'],
    ['DATABASE_URL=postgresql://postgres:abc@host:5432/postgres', 'DATABASE_URL'],
    ['export SUPABASE_DB_PASSWORD=abc', 'SUPABASE_DB_PASSWORD'],
  ])('acusa %s', (linha, variavel) => {
    expect(segredosPreenchidos(linha).map((s) => s.variavel)).toEqual([variavel])
  })

  it.each([
    'SUPABASE_DB_PASSWORD=',
    'SUPABASE_DB_PASSWORD=<senha do banco>',
    'SUPABASE_DB_PASSWORD="<senha do banco>"',
    'SUPABASE_DB_PASSWORD=   ',
    '# SUPABASE_DB_PASSWORD=abc',
  ])('aceita placeholder ou vazio: %s', (linha) => {
    expect(segredosPreenchidos(linha)).toEqual([])
  })

  it('não acusa as chaves públicas do front', () => {
    expect(segredosPreenchidos('VITE_SUPABASE_URL=https://abc.supabase.co\nVITE_SUPABASE_ANON_KEY=eyJabc')).toEqual([])
  })

  it('acusa valor com cara de segredo mesmo em variável de nome neutro', () => {
    expect(segredosPreenchidos('OUTRA_COISA=' + TOKEN_FALSO)).toEqual([
      { linha: 1, variavel: 'OUTRA_COISA', motivo: 'valor com formato de token do Supabase' },
    ])
  })

  it('informa a linha de cada ocorrência', () => {
    const conteudo = ['# cabeçalho', 'VITE_SUPABASE_URL=https://abc.supabase.co', 'SUPABASE_DB_PASSWORD=abc'].join('\n')
    expect(segredosPreenchidos(conteudo)).toEqual([
      { linha: 3, variavel: 'SUPABASE_DB_PASSWORD', motivo: 'variável de segredo preenchida' },
    ])
  })
})

describe('.env.example do repositório', () => {
  it('não tem segredo preenchido', () => {
    const conteudo = readFileSync(join(import.meta.dirname, '..', '.env.example'), 'utf8')
    expect(segredosPreenchidos(conteudo).map(({ linha, variavel }) => `${variavel} (linha ${linha})`)).toEqual([])
  })
})
