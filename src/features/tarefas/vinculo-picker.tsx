import { useMemo, useState } from 'react'
import { User, Users, X } from 'lucide-react'
import { Input } from '@/components/ui'
import { normalize } from '@/lib/csv'
import { useParticipantes, useTurmas } from '@/features/participantes/queries'

export type Vinculo = { participante_id: string | null; turma_id: string | null }

/** Busca única para escolher um participante ou uma turma (mutuamente exclusivos). */
export function VinculoPicker({ valor, onChange }: { valor: Vinculo; onChange: (v: Vinculo) => void }) {
  const participantes = useParticipantes()
  const turmas = useTurmas()
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)

  const nomeTurma = useMemo(() => new Map(turmas.data?.map((t) => [t.id, t.nome])), [turmas.data])

  const selecionado = valor.participante_id
    ? participantes.data?.find((p) => p.id === valor.participante_id)
    : null
  const turmaSelecionada = valor.turma_id ? turmas.data?.find((t) => t.id === valor.turma_id) : null

  const resultados = useMemo(() => {
    const q = normalize(busca)
    const ts = (turmas.data ?? [])
      .filter((t) => !q || normalize(t.nome).includes(q))
      .slice(0, 5)
      .map((t) => ({ tipo: 'turma' as const, id: t.id, nome: `Turma ${t.nome}`, extra: '' }))
    const ps = (participantes.data ?? [])
      .filter((p) => !q || normalize(`${p.nome} ${p.apelido ?? ''} ${p.empresa ?? ''}`).includes(q))
      .slice(0, 8)
      .map((p) => ({
        tipo: 'participante' as const,
        id: p.id,
        nome: p.nome,
        extra: [p.turma_id && nomeTurma.get(p.turma_id), p.empresa].filter(Boolean).join(' · '),
      }))
    return [...ts, ...ps]
  }, [busca, participantes.data, turmas.data, nomeTurma])

  if (selecionado || turmaSelecionada) {
    return (
      <div className="flex items-center justify-between rounded-md border border-input bg-muted/50 px-3 py-2 text-sm">
        <span className="flex items-center gap-2">
          {selecionado ? <User className="size-4 text-primary" /> : <Users className="size-4 text-primary" />}
          {selecionado ? selecionado.nome : `Turma ${turmaSelecionada!.nome}`}
        </span>
        <button
          type="button"
          onClick={() => onChange({ participante_id: null, turma_id: null })}
          className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted"
          aria-label="Remover vínculo"
        >
          <X className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Input
        value={busca}
        placeholder="Buscar participante ou turma (vazio = tarefa interna)"
        onChange={(e) => {
          setBusca(e.target.value)
          setAberto(true)
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
      />
      {aberto && resultados.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-card py-1 shadow-lg">
          {resultados.map((r) => (
            <li key={`${r.tipo}-${r.id}`}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(
                    r.tipo === 'turma'
                      ? { participante_id: null, turma_id: r.id }
                      : { participante_id: r.id, turma_id: null },
                  )
                  setBusca('')
                  setAberto(false)
                }}
              >
                {r.tipo === 'turma' ? <Users className="size-4 text-muted-foreground/70" /> : <User className="size-4 text-muted-foreground/70" />}
                <span>{r.nome}</span>
                {r.extra && <span className="text-xs text-muted-foreground/70">{r.extra}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
