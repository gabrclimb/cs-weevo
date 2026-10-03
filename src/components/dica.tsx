import type { ReactNode } from 'react'
import { Tooltip } from 'radix-ui'
import { CircleHelp } from 'lucide-react'
import { useDicas } from '@/lib/dicas'
import { cn } from '@/lib/utils'

type Lado = 'top' | 'right' | 'bottom' | 'left'

function Conteudo({ texto, lado }: { texto: ReactNode; lado?: Lado }) {
  return (
    <Tooltip.Portal>
      <Tooltip.Content
        side={lado}
        sideOffset={6}
        collisionPadding={8}
        className="z-[70] max-w-72 rounded-md border bg-popover px-2.5 py-1.5 text-xs leading-relaxed font-normal tracking-normal text-popover-foreground normal-case shadow-md"
      >
        {texto}
      </Tooltip.Content>
    </Tooltip.Portal>
  )
}

/**
 * Explica o elemento ao passar o mouse. Some quando as dicas estão desligadas.
 * `sublinhado` marca o texto com pontilhado, para indicar que há explicação (cabeçalhos de tabela, títulos de coluna).
 */
export function Dica({
  texto,
  children,
  lado,
  sublinhado,
  className,
}: {
  texto?: ReactNode
  children: ReactNode
  lado?: Lado
  sublinhado?: boolean
  className?: string
}) {
  const { ativas } = useDicas()
  if (!ativas || !texto) return <>{children}</>
  return (
    <Tooltip.Root delayDuration={250}>
      <Tooltip.Trigger asChild>
        <span
          className={cn(
            'inline-flex cursor-help',
            sublinhado && 'underline decoration-muted-foreground/50 decoration-dotted underline-offset-4',
            className,
          )}
        >
          {children}
        </span>
      </Tooltip.Trigger>
      <Conteudo texto={texto} lado={lado} />
    </Tooltip.Root>
  )
}

/** Cabeçalho de tabela com explicação da coluna. */
export function Th({ dica, children, className }: { dica?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <th className={cn('px-4 py-3 font-medium', className)}>
      <Dica texto={dica} sublinhado>
        {children}
      </Dica>
    </th>
  )
}

/** Ícone "?" com explicação, para colocar ao lado de rótulos de campo e títulos. */
export function InfoDica({ texto, lado, className }: { texto: ReactNode; lado?: Lado; className?: string }) {
  const { ativas } = useDicas()
  if (!ativas) return null
  return (
    <Tooltip.Root delayDuration={150}>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          aria-label="Ajuda"
          onClick={(e) => e.preventDefault()}
          className={cn(
            'inline-flex shrink-0 cursor-help rounded-full text-muted-foreground/70 outline-none hover:text-primary focus-visible:text-primary focus-visible:ring-2 focus-visible:ring-ring/50',
            className,
          )}
        >
          <CircleHelp className="size-3.5" aria-hidden="true" />
        </button>
      </Tooltip.Trigger>
      <Conteudo texto={texto} lado={lado} />
    </Tooltip.Root>
  )
}
