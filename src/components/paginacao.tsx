import { useEffect, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Select } from '@/components/ui'
import { cn } from '@/lib/utils'

export const TAMANHOS_PAGINA = [15, 30, 50, 100] as const
const CHAVE_TAMANHO = 'weevo:itens-por-pagina'

function tamanhoSalvo(): number {
  try {
    const v = Number(localStorage.getItem(CHAVE_TAMANHO))
    return (TAMANHOS_PAGINA as readonly number[]).includes(v) ? v : TAMANHOS_PAGINA[0]
  } catch {
    return TAMANHOS_PAGINA[0]
  }
}

/**
 * Paginação local de uma lista já filtrada e ordenada.
 * `chaveReset` (ex.: filtros serializados) volta para a página 1 quando muda.
 * O tamanho escolhido fica salvo no navegador e vale para todas as listas.
 */
export function usePaginacao<T>(itens: T[], chaveReset?: unknown) {
  const [pagina, setPagina] = useState(1)
  const [tamanho, setTamanhoState] = useState<number>(tamanhoSalvo)
  const chave = JSON.stringify(chaveReset ?? null)

  useEffect(() => setPagina(1), [chave])

  const totalPaginas = Math.max(1, Math.ceil(itens.length / tamanho))
  const atual = Math.min(pagina, totalPaginas)
  const inicio = (atual - 1) * tamanho

  function setTamanho(t: number) {
    setTamanhoState(t)
    setPagina(1)
    try {
      localStorage.setItem(CHAVE_TAMANHO, String(t))
    } catch {
      // Sem armazenamento no navegador: vale só nesta sessão.
    }
  }

  return {
    itensPagina: itens.slice(inicio, inicio + tamanho),
    /** Posição do primeiro item da página na lista completa (para numeração). */
    inicio,
    controles: {
      pagina: atual,
      totalPaginas,
      total: itens.length,
      tamanho,
      inicio,
      setPagina,
      setTamanho,
    },
  }
}

export function Paginacao({
  pagina,
  totalPaginas,
  total,
  tamanho,
  inicio,
  setPagina,
  setTamanho,
  className,
}: ReturnType<typeof usePaginacao>['controles'] & { className?: string }) {
  if (!total) return null
  const fim = Math.min(inicio + tamanho, total)
  return (
    <nav
      aria-label="Paginação"
      className={cn('flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground', className)}
    >
      <span className="tabular-nums">
        {inicio + 1}–{fim} de {total}
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          Por página
          <Select className="w-20" value={tamanho} onValueChange={(v) => setTamanho(Number(v))} aria-label="Itens por página">
            {TAMANHOS_PAGINA.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </label>
        <div className="flex items-center gap-1">
          <BotaoPagina label="Primeira página" disabled={pagina <= 1} onClick={() => setPagina(1)}>
            <ChevronsLeft className="size-4" />
          </BotaoPagina>
          <BotaoPagina label="Página anterior" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>
            <ChevronLeft className="size-4" />
          </BotaoPagina>
          <span className="px-2 tabular-nums">
            {pagina} / {totalPaginas}
          </span>
          <BotaoPagina label="Próxima página" disabled={pagina >= totalPaginas} onClick={() => setPagina(pagina + 1)}>
            <ChevronRight className="size-4" />
          </BotaoPagina>
          <BotaoPagina label="Última página" disabled={pagina >= totalPaginas} onClick={() => setPagina(totalPaginas)}>
            <ChevronsRight className="size-4" />
          </BotaoPagina>
        </div>
      </div>
    </nav>
  )
}

function BotaoPagina({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-8 items-center justify-center rounded-md border bg-background text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  )
}
