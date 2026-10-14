import { useEffect, useRef } from 'react'

/** Checkbox com estado "parcial" (alguns da página marcados). */
export function CaixaSelecao({
  checked,
  indeterminate = false,
  onChange,
  'aria-label': ariaLabel,
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: (marcado: boolean) => void
  'aria-label': string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={ariaLabel}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="size-4 cursor-pointer accent-primary"
    />
  )
}
