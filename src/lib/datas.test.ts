import { describe, expect, it } from 'vitest'
import { parseWeevoDatas } from './datas'

const REF = new Date(2026, 9, 2)

describe('parseWeevoDatas', () => {
  it.each([
    ['02/10', ['2026-10-02']],
    ['seg 5/10', ['2026-10-05']],
    ['05/10/26', ['2026-10-05']],
    ['05/10/2027', ['2027-10-05']],
    ['02/10 a 04/10', ['2026-10-02', '2026-10-04']],
    ['2 e 5/10', ['2026-10-02', '2026-10-05']],
    ['2, 3 e 5/10', ['2026-10-02', '2026-10-03', '2026-10-05']],
    ['02 / 10', ['2026-10-02']],
  ])('%s', (texto, esperado) => {
    expect(parseWeevoDatas(texto, REF)).toEqual(esperado)
  })

  it.each([null, '', 'semana que vem', '31/02', '10/13'])('sem data válida: %s', (texto) => {
    expect(parseWeevoDatas(texto, REF)).toEqual([])
  })
})
