import type { ReactNode } from 'react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui'

/**
 * Um único botão "Filtros" que abre um painel com todos os filtros da tela.
 * `ativos` é quantos filtros estão aplicados (aparece no botão); `onLimpar` zera só os filtros do painel.
 */
export function BotaoFiltros({
  ativos,
  onLimpar,
  children,
}: {
  ativos: number
  onLimpar: () => void
  children: ReactNode
}) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <Button
          variante="secundario"
          className="group/filtros"
          aria-label={ativos ? `Filtros (${ativos} ativos)` : 'Filtros'}
        >
          <SlidersHorizontal className="size-4" />
          Filtros
          {ativos > 0 && (
            <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
              {ativos}
            </span>
          )}
          <ChevronDown className="size-4 opacity-70 transition-transform group-data-[state=open]/filtros:rotate-180" aria-hidden="true" />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="z-[60] w-80 max-w-[calc(100vw-1rem)] space-y-3 rounded-md border bg-popover p-3 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          {children}
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-xs text-muted-foreground">
              {ativos ? `${ativos} filtro(s) aplicado(s)` : 'Nenhum filtro aplicado'}
            </span>
            <Button variante="fantasma" className="h-8" disabled={!ativos} onClick={onLimpar}>
              Limpar filtros
            </Button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

/** Rótulo acima de um filtro dentro do painel. */
export function CampoFiltro({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}
