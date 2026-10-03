import { Select } from '@/components/ui'

/**
 * Seletor "Agrupar por". Com `semAgrupar`, ganha a opção "Sem agrupamento" (valor `undefined`).
 */
export function SeletorAgrupar<K extends string>({
  valor,
  onChange,
  opcoes,
  ocultar = [],
  semAgrupar = false,
}: {
  valor: K | undefined
  onChange: (valor: K | undefined) => void
  opcoes: Record<K, string>
  ocultar?: K[]
  semAgrupar?: boolean
}) {
  const chaves = (Object.keys(opcoes) as K[]).filter((k) => !ocultar.includes(k))
  return (
    <Select
      className="w-56"
      value={valor ?? ''}
      onValueChange={(v) => onChange(v ? (v as K) : undefined)}
      aria-label="Agrupar por"
    >
      {semAgrupar && <option value="">Sem agrupamento</option>}
      {chaves.map((k) => (
        <option key={k} value={k}>
          Agrupar por: {opcoes[k]}
        </option>
      ))}
    </Select>
  )
}
