import { describe, expect, it } from 'vitest'
import { apelidoDistinto, nomeTratamento, primeiroNome } from './constantes'

describe('apelido e primeiro nome', () => {
  it('primeiroNome ignora espaços sobrando', () => {
    expect(primeiroNome('  Maria  da Silva ')).toBe('Maria')
    expect(primeiroNome('')).toBe('')
  })

  it('nomeTratamento usa o apelido e, sem ele, o primeiro nome', () => {
    expect(nomeTratamento({ nome: 'Maria da Silva', apelido: 'Mari' })).toBe('Mari')
    expect(nomeTratamento({ nome: 'Maria da Silva', apelido: null })).toBe('Maria')
  })

  it('apelidoDistinto esconde o apelido que é só o primeiro nome', () => {
    expect(apelidoDistinto({ nome: 'Maria da Silva', apelido: 'maria' })).toBeNull()
    expect(apelidoDistinto({ nome: 'Maria da Silva', apelido: null })).toBeNull()
    expect(apelidoDistinto({ nome: 'Maria da Silva', apelido: 'Mari' })).toBe('Mari')
  })
})
