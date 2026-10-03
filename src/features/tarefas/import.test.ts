import { describe, expect, it } from 'vitest'
import { chaveImport, previaImportTarefas } from './import'

// Dados fictícios.
const ctx = {
  chavesExistentes: [] as string[],
  participantes: [
    { id: 'p1', nome: 'Fulano de Tal', apelido: 'Fulaninho' },
    { id: 'p2', nome: 'Beltrana Silva', apelido: null },
    { id: 'p3', nome: 'Ciclano', apelido: 'Ciça' },
    { id: 'p4', nome: 'Ciça', apelido: null },
  ],
  turmas: [{ id: 't1', nome: 'Agosto' }],
  referencia: new Date(2026, 9, 2),
}

const CSV = [
  'Tarefa;Para quem;Data;Horário;Canal;Status;Tipo',
  'Perguntar sobre implementação;Fulaninho;seg 05/10;19h;WhatsApp;A fazer;',
  'Aviso do plantão;Turma Agosto;02/10;18:30;Grupo;;Conteúdo no grupo',
  'Ligar;beltrana silva;;;;Feito;ligacao',
  'Revisar planilha;Time;;;;;',
  'Perguntar sobre implementação;Fulaninho;seg 05/10;;;;',
  ';Fulano;;;;;',
  'Mensagem;Ciça;;;;;',
].join('\n')

describe('previaImportTarefas', () => {
  const p = previaImportTarefas(CSV, ctx)

  it('conta, deduplica e lista inválidas', () => {
    expect(p.total).toBe(7)
    expect(p.novas).toHaveLength(5)
    expect(p.duplicadas).toBe(1)
    expect(p.invalidas).toEqual([{ linha: 7, motivo: 'Tarefa sem título' }])
  })

  it('vincula por apelido ou nome normalizado do participante', () => {
    expect(p.novas[0]).toMatchObject({ participante_id: 'p1', turma_id: null, para_quem: null, tipo: 'mensagem_privada' })
    expect(p.novas[2]).toMatchObject({ participante_id: 'p2', status: 'feito', tipo: 'ligacao' })
  })

  it('vincula a turma, aceitando prefixo "Turma"', () => {
    expect(p.novas[1]).toMatchObject({ turma_id: 't1', participante_id: null, tipo: 'conteudo_grupo' })
  })

  it('nome ambíguo ou desconhecido fica em texto livre', () => {
    expect(p.novas[3]).toMatchObject({ participante_id: null, turma_id: null, para_quem: 'Time', tipo: 'interna' })
    expect(p.novas[4]).toMatchObject({ participante_id: null, para_quem: 'Ciça' })
    expect([p.vinculadasParticipante, p.vinculadasTurma, p.semVinculo]).toEqual([2, 1, 2])
  })

  it('converte data em texto e horário', () => {
    expect(p.novas[0]).toMatchObject({ data: 'seg 05/10', data_prevista: '2026-10-05', horario: '19:00' })
    expect(p.novas[1].horario).toBe('18:30')
  })

  it('ignora tarefas já importadas antes', () => {
    const de_novo = previaImportTarefas(CSV, { ...ctx, chavesExistentes: [chaveImport('Ligar', 'beltrana silva', null)] })
    expect(de_novo.novas.map((n) => n.titulo)).not.toContain('Ligar')
  })
})
