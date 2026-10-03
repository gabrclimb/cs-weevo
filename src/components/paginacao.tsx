import { useEffect, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Select } from '@/components/ui'
import { cn } from '@/lib/utils'

export const TAMANHOS_PAGINA = [15, 30, 50, 100] as const

/** Estilo do cabeçalho das tabelas. O rodapé com a paginação usa a mesma aparência (ver RODAPE_TABELA). */
export const CABECALHO_TABELA = 'text-left text-[11px] font-semibold tracking-wider text-muted-foreground uppercase'
/** Rodapé da tabela: igual ao cabeçalho, com a borda no topo. */
export const RODAPE_TABELA = `border-t px-4 py-3 ${CABECALHO_TABELA}`
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
          <Select className="w-20 font-normal" value={tamanho} onValueChange={(v) => setTamanho(Number(v))} aria-label="Itens por página">
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

/** Quantos cards cada coluna do kanban mostra por vez. */
export const ITENS_POR_COLUNA = 10

/** Página atual de cada coluna do kanban, separadas por chave. A página volta para a última válida se a coluna encolher. */
export function usePaginasPorColuna(tamanho: number = ITENS_POR_COLUNA) {
  const [paginas, setPaginas] = useState<Record<string, number>>({})

  function fatiar<T>(chave: string, itens: T[]) {
    const totalPaginas = Math.max(1, Math.ceil(itens.length / tamanho))
    const pagina = Math.min(paginas[chave] ?? 1, totalPaginas)
    const inicio = (pagina - 1) * tamanho
    return {
      itens: itens.slice(inicio, inicio + tamanho),
      controles: {
        pagina,
        totalPaginas,
        total: itens.length,
        inicio,
        tamanho,
        ir: (n: number) => setPaginas((p) => ({ ...p, [chave]: n })),
      },
    }
  }

  return { fatiar }
}

/** Rodapé compacto de uma coluna do kanban. Só aparece quando a coluna tem mais cards do que cabem. */
export function PaginacaoColuna({
  pagina,
  totalPaginas,
  total,
  inicio,
  tamanho,
  ir,
}: ReturnType<ReturnType<typeof usePaginasPorColuna>['fatiar']>['controles']) {
  if (total <= tamanho) return null
  const fim = Math.min(inicio + tamanho, total)
  const botao =
    'inline-flex size-7 items-center justify-center rounded-md border bg-background text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40'
  return (
    <nav aria-label="Paginação da coluna" className="mt-auto flex items-center justify-between gap-2 px-1 pt-1 text-xs text-muted-foreground">
      <span className="tabular-nums">
        {inicio + 1}–{fim} de {total}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Página anterior" title="Página anterior" disabled={pagina <= 1} onClick={() => ir(pagina - 1)} className={botao}>
          <ChevronLeft className="size-3.5" />
        </button>
        <span className="min-w-8 text-center tabular-nums">
          {pagina}/{totalPaginas}
        </span>
        <button type="button" aria-label="Próxima página" title="Próxima página" disabled={pagina >= totalPaginas} onClick={() => ir(pagina + 1)} className={botao}>
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </nav>
  )
}
