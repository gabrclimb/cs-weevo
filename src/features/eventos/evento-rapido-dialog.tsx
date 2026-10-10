import { useEffect, useState, type FormEvent } from 'react'
import { format } from 'date-fns'
import { Button, Campo, Dialog, Input, Textarea } from '@/components/ui'
import type { EventoTipo } from '@/lib/tipos'
import { EVENTO } from './constantes'

const TEXTOS: Partial<Record<EventoTipo, { descricao: string; notaLabel: string; notaObrigatoria?: boolean }>> = {
  interacao_grupo: { descricao: 'O participante interagiu no grupo da turma.', notaLabel: 'O que ele fez (opcional)' },
  implementou: {
    descricao: 'Registre a evidência de implementação.',
    notaLabel: 'Evidência *',
    notaObrigatoria: true,
  },
  nota: { descricao: 'Observação livre na linha do tempo.', notaLabel: 'Nota *', notaObrigatoria: true },
  ligacao: { descricao: 'Ligação feita para o participante.', notaLabel: 'Resumo (opcional)' },
}

/** Registro de evento avulso com data editável (para registrar algo que aconteceu antes). */
export function EventoRapidoDialog({
  tipo,
  onFechar,
  onConfirmar,
}: {
  tipo: EventoTipo | null
  onFechar: () => void
  onConfirmar: (dados: { nota: string | null; ocorrido_em: string }) => void
}) {
  const [nota, setNota] = useState('')
  const [quando, setQuando] = useState('')

  useEffect(() => {
    if (tipo) {
      setNota('')
      setQuando(format(new Date(), "yyyy-MM-dd'T'HH:mm"))
    }
  }, [tipo])

  const textos = tipo ? TEXTOS[tipo] : undefined

  function enviar(e: FormEvent) {
    e.preventDefault()
    onConfirmar({ nota: nota.trim() || null, ocorrido_em: new Date(quando).toISOString() })
    onFechar()
  }

  return (
    <Dialog
      aberto={!!tipo}
      onAbertoChange={(a) => !a && onFechar()}
      titulo={tipo ? EVENTO[tipo].label : ''}
      descricao={textos?.descricao}
    >
      <form onSubmit={enviar} className="space-y-3">
        <Campo label={textos?.notaLabel ?? 'Nota'}>
          <Textarea autoFocus required={textos?.notaObrigatoria} value={nota} onChange={(e) => setNota(e.target.value)} />
        </Campo>
        <Campo label="Quando" dica="Use a data e hora em que aconteceu de verdade: a pontuação depende delas.">
          <Input type="datetime-local" required value={quando} onChange={(e) => setQuando(e.target.value)} />
        </Campo>
        <div className="flex justify-end gap-2">
          <Button variante="secundario" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit">Registrar</Button>
        </div>
      </form>
    </Dialog>
  )
}
