/**
 * Extrai datas de texto livre usado na planilha antiga ("02/10", "seg 02/10/26", "2 e 5/10", "02/10 a 04/10").
 * Retorna datas ISO (yyyy-MM-dd) em ordem, sem repetição. Ano ausente = ano de referência.
 */
export function parseWeevoDatas(texto: string | null | undefined, referencia: Date = new Date()): string[] {
  if (!texto) return []
  const anoRef = referencia.getFullYear()
  const datas: string[] = []

  const iso = (d: number, m: number, a: number) => {
    const data = new Date(a, m - 1, d)
    if (data.getFullYear() !== a || data.getMonth() !== m - 1 || data.getDate() !== d) return
    datas.push(`${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  const ano = (a?: string) => (!a ? anoRef : a.length === 2 ? 2000 + Number(a) : Number(a))

  // "2 e 5/10", "2, 3 e 5/10": dias soltos que herdam o mês seguinte
  const limpo = texto.replace(/(\d{1,2})((?:\s*(?:,|e)\s*\d{1,2})+)\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?/gi, (_m, d1, resto, m, a) => {
    const dias = [d1, ...resto.split(/\s*(?:,|e)\s*/i).filter(Boolean)]
    return dias.map((d: string) => `${d}/${m}${a ? '/' + a : ''}`).join(' ')
  })

  for (const m of limpo.matchAll(/(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?/g)) {
    iso(Number(m[1]), Number(m[2]), ano(m[3]))
  }
  return [...new Set(datas)]
}
