/**
 * Normaliza um telefone brasileiro para E.164 (+55DDXXXXXXXXX).
 * Retorna null quando não for possível obter um número válido.
 */
export function normalizarTelefone(input: string | null | undefined): string | null {
  if (!input) return null
  let digitos = input.replace(/\D/g, '')
  if (!digitos) return null

  // Prefixo de discagem internacional (00) e zero de operadora/tronco (0DD...)
  if (digitos.startsWith('00')) digitos = digitos.slice(2)
  if (digitos.length === 11 || digitos.length === 10) {
    // Sem DDI
    digitos = '55' + digitos
  } else if (digitos.startsWith('0') && (digitos.length === 12 || digitos.length === 11)) {
    digitos = '55' + digitos.slice(1)
  }

  if (!digitos.startsWith('55')) return null
  let nacional = digitos.slice(2)

  // Celular sem o 9: DDD + 8 dígitos começando em 6-9
  if (nacional.length === 10 && /^[6-9]$/.test(nacional[2])) {
    nacional = nacional.slice(0, 2) + '9' + nacional.slice(2)
  }

  if (nacional.length !== 10 && nacional.length !== 11) return null
  const ddd = nacional.slice(0, 2)
  if (!/^[1-9][1-9]$/.test(ddd)) return null
  if (nacional.length === 11 && nacional[2] !== '9') return null

  return '+55' + nacional
}

/** Exibe +5511987654321 como (11) 98765-4321. */
export function formatarTelefone(e164: string | null | undefined): string {
  if (!e164) return ''
  const n = e164.replace(/^\+55/, '')
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`
  return e164
}
