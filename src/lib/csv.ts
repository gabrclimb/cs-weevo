import Papa from 'papaparse'

/** Normaliza texto para comparação: minúsculas, sem acento, espaços colapsados. */
export function normalize(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Lê CSV com cabeçalho. Detecta vírgula ou ponto e vírgula; remove BOM. */
export function parseCsv(conteudo: string): { cabecalho: string[]; linhas: Record<string, string>[] } {
  const resultado = Papa.parse<Record<string, string>>(conteudo.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  })
  return { cabecalho: resultado.meta.fields ?? [], linhas: resultado.data }
}
