import { useEffect, useState } from 'react'
import { Button, Dialog, Textarea } from '@/components/ui'
import type { EventoCategoria } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { CATEGORIA, CATEGORIA_KEYS } from '@/features/eventos/constantes'

export type DadosResposta = { categoria: EventoCategoria | null; nota: string | null; marcarImplementou: boolean }

/**
 * Seletor rápido do "Respondeu": um clique na categoria registra.
 * "Mandou evidência" pergunta se deve marcar implementou antes de confirmar.
 */
export function RespostaDialog({
  aberto,
  onAbertoChange,
  nome,
  jaImplementou,
  onConfirmar,
}: {
  aberto: boolean
  onAbertoChange: (aberto: boolean) => void
  nome: string
  jaImplementou: boolean
  onConfirmar: (r: DadosResposta) => void
}) {
  const [nota, setNota] = useState('')
  const [evidencia, setEvidencia] = useState(false)

  useEffect(() => {
    if (aberto) {
      setNota('')
      setEvidencia(false)
    }
  }, [aberto])

  function confirmar(categoria: EventoCategoria | null, marcarImplementou = false) {
    onConfirmar({ categoria, nota: nota.trim() || null, marcarImplementou })
    onAbertoChange(false)
  }

  return (
    <Dialog aberto={aberto} onAbertoChange={onAbertoChange} titulo={`${nome} respondeu`} descricao="Como foi a resposta?">
      <div className="space-y-3">
        <Textarea
          placeholder="Nota opcional (resumo curto, sem copiar a conversa)"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          className="min-h-14"
        />
        {evidencia ? (
          <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
            <p className="font-medium text-emerald-900">Marcar o participante como "implementou"?</p>
            <div className="flex gap-2">
              <Button onClick={() => confirmar('evidencia_implementacao', true)}>Sim, implementou</Button>
              <Button variante="secundario" onClick={() => confirmar('evidencia_implementacao', false)}>
                Não, só registrar a resposta
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            {CATEGORIA_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() =>
                  k === 'evidencia_implementacao' && !jaImplementou ? setEvidencia(true) : confirmar(k)
                }
                className={cn(
                  'rounded-md border px-3 py-2 text-left text-sm hover:border-primary hover:bg-primary/10',
                  k === 'sinal_desistencia' && 'hover:border-rose-400 hover:bg-rose-50',
                )}
              >
                {CATEGORIA[k]}
              </button>
            ))}
            <button type="button" onClick={() => confirmar(null)} className="text-left text-xs text-muted-foreground hover:underline">
              Registrar sem categoria
            </button>
          </div>
        )}
      </div>
    </Dialog>
  )
}
