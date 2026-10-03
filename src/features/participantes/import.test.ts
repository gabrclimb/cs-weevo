import { describe, expect, it } from 'vitest'
import {
  chaveNomeTurma,
  contaComoPresenca,
  detectarCabecalho,
  lerTabela,
  previaImportParticipantes,
  sugerirMapeamento,
  sugerirTurma,
  validarMapeamento,
} from './import'

// Dados fictícios.
const CSV = [
  'Nome;Apelido;Telefone;Empresa;Turma',
  'Fulano de Tal;Fulaninho;(11) 98765-4321;Empresa Exemplo;Agosto',
  'Beltrana Silva;;11 8765 1234;;setembro',
  'Ciclano Souza;;+55 11 98765-4321;;Agosto',
  ';;11999990000;;Agosto',
  'Sem Telefone;;;;',
  'Telefone Ruim;;123;;Agosto',
].join('\n')

// Mesmo formato da planilha de controle do suporte (título, colunas de encontros), com dados fictícios.
const PLANILHA = [
  'Turma Teste - Imersão,,,,,,,,,,,,',
  'Participante,Responsável,Dia Escolhido,1º Encontro,2º Encontro,3º Encontro,4º Encontro,Veio em quantos? ,Suporte Extra,Fez cadastro na plataforma?,Qual o sistema que ele ta fazendo?,Quais as maiores dificuldades?,Respondeu NPS?',
  'Pessoa Um,Ana,Quinta 14h às 16h,Não veio,Não respondeu,,,0,,,"Sistema de controle, com vírgula",,',
  'Pessoa Dois,Ana,Quinta 14h às 16h,Veio,Veio,,,2,,Informou que iria,Dashboard de vendas,Integração,Sim',
  'Pessoa Três,,Quinta 14h às 16h,Veio,Confirmou e não veio,,,1,,Sim,,,',
].join('\n')

const vazio = { telefones: [] as string[], turmas: ['Agosto'] }

describe('lerTabela + detectarCabecalho + sugerirTurma', () => {
  it('cabeçalho na primeira linha', () => {
    expect(detectarCabecalho(lerTabela(CSV))).toBe(0)
  })

  it('pula linhas de título antes do cabeçalho', () => {
    const t = lerTabela(['Controle de suporte;;;', ';;;', 'Participante;WhatsApp;Empresa;Status', 'Fulano;11987654321;X;ok'].join('\n'))
    expect(detectarCabecalho(t)).toBe(2)
  })

  it('sem nomes conhecidos, usa a linha mais preenchida', () => {
    expect(detectarCabecalho(lerTabela('Relatório\nA,B,C\n1,2,3'))).toBe(1)
  })

  it('sugere a turma pelo título acima do cabeçalho', () => {
    const t = lerTabela(PLANILHA)
    expect(sugerirTurma(t, detectarCabecalho(t))).toBe('Turma Teste')
    expect(sugerirTurma(lerTabela(CSV), 0)).toBeNull()
  })
})

describe('sugerirMapeamento / validarMapeamento', () => {
  it('reconhece aliases sem acento, caixa e pontuação', () => {
    expect(sugerirMapeamento(['Participante', 'WHATSAPP', 'Empresa', 'Status'])).toEqual(['nome', 'telefone', 'empresa', null])
  })

  it('reconhece todas as colunas da planilha de controle', () => {
    const t = lerTabela(PLANILHA)
    expect(sugerirMapeamento(t[1])).toEqual([
      'nome',
      'responsavel',
      'dia_escolhido',
      'encontro_1',
      'encontro_2',
      'encontro_3',
      'encontro_4',
      null, // "Veio em quantos?" é derivado das presenças
      'suporte_extra',
      'cadastro_plataforma',
      'sistema',
      'dificuldades',
      'nps',
    ])
  })

  it('não repete campo único', () => {
    expect(sugerirMapeamento(['Nome', 'Nome completo'])).toEqual(['nome', null])
  })

  it('exige Nome e não aceita campo único duplicado', () => {
    expect(validarMapeamento(['telefone'])).toEqual(['Escolha a coluna que vai para "Nome".'])
    expect(validarMapeamento(['nome', 'encontro_1', 'encontro_1'])).toHaveLength(1)
    expect(validarMapeamento(['nome', 'observacoes', 'observacoes'])).toEqual([])
  })
})

describe('contaComoPresenca', () => {
  it.each([
    ['Veio', true],
    ['veio ', true],
    ['Sim', true],
    ['Não veio', false],
    ['Confirmou e não veio', false],
    ['Não respondeu', false],
    ['', false],
  ])('%s', (v, esperado) => expect(contaComoPresenca(v)).toBe(esperado))
})

describe('previaImportParticipantes', () => {
  const tabela = lerTabela(CSV)
  const mapa = sugerirMapeamento(tabela[0])
  const previa = previaImportParticipantes(tabela, 0, mapa, vazio)

  it('separa novos com telefone normalizado', () => {
    expect(previa.total).toBe(6)
    expect(previa.novos.map((n) => n.nome)).toEqual(['Fulano de Tal', 'Beltrana Silva', 'Sem Telefone'])
    expect(previa.novos[0]).toMatchObject({
      telefone: '+5511987654321',
      turma: 'Agosto',
      dados: { apelido: 'Fulaninho', empresa: 'Empresa Exemplo' },
    })
  })

  it('duplicados e inválidas', () => {
    expect(previa.duplicados.map((d) => [d.nome, d.motivo])).toEqual([['Ciclano Souza', 'telefone já cadastrado']])
    expect(previa.invalidas).toEqual([
      { linha: 5, motivo: 'Nome vazio' },
      { linha: 7, motivo: 'Telefone inválido: 123' },
    ])
  })

  it('turmas novas sem repetir as existentes', () => {
    expect(previa.turmasNovas).toEqual(['setembro'])
  })

  it('respeita mapeamento manual, mandando coluna para observações', () => {
    const p = previaImportParticipantes(tabela, 0, ['nome', null, null, 'observacoes', null], vazio)
    expect(p.novos[0]).toMatchObject({
      nome: 'Fulano de Tal',
      telefone: null,
      turma: null,
      dados: { observacoes: 'Empresa: Empresa Exemplo' },
    })
  })

  it('planilha de controle: campos extras, presenças e turma fixa', () => {
    const t = lerTabela(PLANILHA)
    const p = previaImportParticipantes(t, 1, sugerirMapeamento(t[1]), { telefones: [], turmas: [] }, 'Turma Teste')
    expect(p.novos).toHaveLength(3)
    expect(p.plantoesMapeados).toEqual([1, 2, 3, 4])
    expect(p.novos.map((n) => n.presencas)).toEqual([[], [1, 2], [1]])
    expect(p.novos[1]).toMatchObject({
      linha: 4,
      turma: 'Turma Teste',
      dados: {
        responsavel: 'Ana',
        dia_escolhido: 'Quinta 14h às 16h',
        cadastro_plataforma: 'Informou que iria',
        sistema: 'Dashboard de vendas',
        dificuldades: 'Integração',
        nps: 'Sim',
      },
    })
    expect(p.novos[0].dados.sistema).toBe('Sistema de controle, com vírgula')
    expect(p.turmasNovas).toEqual(['Turma Teste'])
  })

  it('sem telefone, deduplica por nome na mesma turma', () => {
    const t = lerTabela(PLANILHA)
    const p = previaImportParticipantes(
      t,
      1,
      sugerirMapeamento(t[1]),
      { telefones: [], turmas: ['Turma Teste'], nomesPorTurma: [chaveNomeTurma('Pessoa Dois', 'Turma Teste')] },
      'Turma Teste',
    )
    expect(p.duplicados.map((d) => [d.nome, d.motivo])).toEqual([['Pessoa Dois', 'mesmo nome já cadastrado nesta turma']])
  })

  it('conta presenças que ficariam sem turma', () => {
    const t = lerTabela(PLANILHA)
    const p = previaImportParticipantes(t, 1, sugerirMapeamento(t[1]), { telefones: [], turmas: [] })
    expect(p.presencasSemTurma).toBe(3)
  })
})
