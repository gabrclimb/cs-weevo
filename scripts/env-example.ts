/** Uma variável de segredo com valor preenchido no .env.example. */
export type SegredoPreenchido = { linha: number; variavel: string; motivo: string }

const LINHA = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/
const NOME_SEGREDO = /PASSWORD|PASSWD|SECRET|TOKEN|SERVICE_ROLE|PRIVATE|_KEY$|DATABASE_URL|DB_URL/
// Expostas ao navegador por definição (chaves públicas); o valor ainda é conferido abaixo.
const PREFIXO_PUBLICO = /^(VITE_|NEXT_PUBLIC_|PUBLIC_)/

function semAspas(v: string): string {
  const t = v.trim()
  return /^(["']).*\1$/.test(t) ? t.slice(1, -1) : t
}

function papelDoJwt(v: string): string | null {
  const partes = v.split('.')
  if (partes.length !== 3) return null
  try {
    return JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8')).role ?? null
  } catch {
    return null
  }
}

/** Motivo pelo qual o valor parece segredo, independente do nome da variável. */
function formatoDeSegredo(v: string): string | null {
  if (/sbp_[0-9a-f]{40}/.test(v)) return 'valor com formato de token do Supabase'
  if (papelDoJwt(v) === 'service_role') return 'JWT com papel service_role'
  if (/^[a-z][a-z0-9+.-]*:\/\/[^:/@\s]+:[^@\s]+@/i.test(v)) return 'URL de banco com senha'
  return null
}

/** Variáveis de segredo do .env.example que não estão vazias nem com placeholder `<...>`. */
export function segredosPreenchidos(conteudo: string): SegredoPreenchido[] {
  const achados: SegredoPreenchido[] = []
  conteudo.split(/\r?\n/).forEach((texto, i) => {
    const m = texto.match(LINHA)
    if (!m) return
    const [, variavel, bruto] = m
    const valor = semAspas(bruto)
    if (!valor || /^<[^>]*>$/.test(valor)) return
    const motivo =
      formatoDeSegredo(valor) ??
      (NOME_SEGREDO.test(variavel) && !PREFIXO_PUBLICO.test(variavel) ? 'variável de segredo preenchida' : null)
    if (motivo) achados.push({ linha: i + 1, variavel, motivo })
  })
  return achados
}
