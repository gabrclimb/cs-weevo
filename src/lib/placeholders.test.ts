import { describe, expect, it } from 'vitest'
import { placeholdersPendentes, preencherPlaceholders, proximoPlantao } from './placeholders'

describe('preencherPlaceholders', () => {
  it('preenche os valores conhecidos', () => {
    expect(
      preencherPlaceholders('Oi [nome], turma [turma]: plantão [plantao_data] às [plantao_horario].', {
        nome: 'Fulano',
        turma: 'Agosto',
        plantaoData: '02/10 (sex)',
        plantaoHorario: '19:00',
      }),
    ).toBe('Oi Fulano, turma Agosto: plantão 02/10 (sex) às 19:00.')
  })

  it('mantém placeholder sem valor ou desconhecido', () => {
    const t = preencherPlaceholders('Oi [nome], [plantao_data] [outro]', { nome: 'Fulano' })
    expect(t).toBe('Oi Fulano, [plantao_data] [outro]')
    expect(placeholdersPendentes(t)).toEqual(['[plantao_data]', '[outro]'])
  })
})

describe('proximoPlantao', () => {
  it('pega o menor número não realizado com data', () => {
    expect(
      proximoPlantao([
        { numero: 1, data: '2026-10-01', horario: '19:00:00', realizado: true },
        { numero: 3, data: '2026-10-15', horario: null, realizado: false },
        { numero: 2, data: '2026-10-08', horario: '18:30:00', realizado: false },
      ]),
    ).toEqual({ plantaoData: '08/10 (qui)', plantaoHorario: '18:30' })
  })

  it('sem plantão pendente retorna nulos', () => {
    expect(proximoPlantao([])).toEqual({ plantaoData: null, plantaoHorario: null })
  })
})
