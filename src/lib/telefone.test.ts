import { describe, expect, it } from 'vitest'
import { formatarTelefone, normalizarTelefone } from './telefone'

describe('normalizarTelefone', () => {
  it.each([
    ['+55 11 98765-4321', '+5511987654321'],
    ['5511987654321', '+5511987654321'],
    ['(11) 98765-4321', '+5511987654321'],
    ['11987654321', '+5511987654321'],
    ['11 9 8765 4321', '+5511987654321'],
    ['011987654321', '+5511987654321'],
    ['005511987654321', '+5511987654321'],
  ])('com e sem DDI, máscara e espaço: %s', (entrada, esperado) => {
    expect(normalizarTelefone(entrada)).toBe(esperado)
  })

  it.each([
    ['(31) 8765-4321', '+5531987654321'],
    ['553187654321', '+5531987654321'],
    ['+55 31 8765 4321', '+5531987654321'],
  ])('insere o 9 em celular antigo: %s', (entrada, esperado) => {
    expect(normalizarTelefone(entrada)).toBe(esperado)
  })

  it('mantém fixo sem inserir 9', () => {
    expect(normalizarTelefone('(11) 3456-7890')).toBe('+551134567890')
  })

  it.each([null, undefined, '', 'abc', '12345', '+1 415 555 0100', '(01) 98765-4321', '11887654321'])(
    'inválido: %s',
    (entrada) => {
      expect(normalizarTelefone(entrada)).toBeNull()
    },
  )
})

describe('formatarTelefone', () => {
  it('formata celular e fixo', () => {
    expect(formatarTelefone('+5511987654321')).toBe('(11) 98765-4321')
    expect(formatarTelefone('+551134567890')).toBe('(11) 3456-7890')
    expect(formatarTelefone(null)).toBe('')
  })
})
