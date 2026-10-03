import { AlertTriangle } from 'lucide-react'
import { placeholdersPendentes } from '@/lib/placeholders'

/** Prévia da mensagem destacando placeholders sem valor, para não enviar texto quebrado. */
export function MensagemPreview({ texto }: { texto: string }) {
  const pendentes = placeholdersPendentes(texto)
  if (!pendentes.length) return null
  const partes = texto.split(/(\[\w+\])/g)
  return (
    <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
      <p className="flex items-center gap-1.5 font-medium text-amber-900">
        <AlertTriangle className="size-4" />
        Placeholder sem valor: {pendentes.join(', ')}
      </p>
      <p className="whitespace-pre-wrap text-foreground">
        {partes.map((p, i) =>
          /^\[\w+\]$/.test(p) ? (
            <mark key={i} className="rounded-sm bg-amber-300 px-0.5">
              {p}
            </mark>
          ) : (
            p
          ),
        )}
      </p>
    </div>
  )
}
