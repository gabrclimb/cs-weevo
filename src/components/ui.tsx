import { Children, Fragment, isValidElement, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactElement, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { Dialog as DialogPrimitive, Select as SelectPrimitive } from 'radix-ui'
import { Check, ChevronDown, ChevronUp, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { InfoDica } from './dica'

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo'

const VARIANTES: Record<Variante, string> = {
  primario:
    'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.20),inset_0_-1px_0_0_rgb(0_0_0/0.05),0_10px_22px_-12px_rgb(0_0_0/0.40)]',
  secundario: 'border-border bg-background hover:bg-muted hover:text-foreground',
  fantasma: 'hover:bg-muted hover:text-foreground',
  perigo: 'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
}

export function Button({
  variante = 'primario',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-[min(var(--radius-md),12px)] border border-transparent bg-clip-padding px-2.5 text-[0.8rem] font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
        VARIANTES[variante],
        className,
      )}
      {...props}
    />
  )
}

const campo =
  'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:ring-destructive/40'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(campo, 'h-9 py-1', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(campo, 'min-h-20', className)} {...props} />
}

type Opcao = { valor: string; label: ReactNode; disabled?: boolean }
type GrupoOpcoes = { label?: string; opcoes: Opcao[] }
type PropsOption = { value?: string | number; children?: ReactNode; disabled?: boolean }

// O Radix não aceita item com valor "", então "" (ex.: "Todas as turmas") vira este sentinela.
const VALOR_VAZIO = '__vazio__'

function lerOpcao(el: ReactElement<PropsOption>): Opcao {
  return { valor: String(el.props.value ?? ''), label: el.props.children, disabled: el.props.disabled }
}

/** Converte filhos <option>/<optgroup> em grupos, para manter a mesma escrita do select nativo. */
function lerGrupos(children: ReactNode): GrupoOpcoes[] {
  const grupos: GrupoOpcoes[] = []
  let soltas: GrupoOpcoes | null = null
  Children.forEach(children, (filho) => {
    if (!isValidElement<PropsOption & { label?: string }>(filho)) return
    if (filho.type === 'optgroup') {
      const opcoes = Children.toArray(filho.props.children).filter(isValidElement<PropsOption>).map(lerOpcao)
      grupos.push({ label: filho.props.label, opcoes })
      soltas = null
    } else if (filho.type === 'option') {
      if (!soltas) grupos.push((soltas = { opcoes: [] }))
      soltas.opcoes.push(lerOpcao(filho))
    }
  })
  return grupos
}

export function Select({
  value,
  onValueChange,
  children,
  className,
  disabled,
  placeholder,
  'aria-label': ariaLabel,
}: {
  value: string | number
  onValueChange: (valor: string) => void
  children: ReactNode
  className?: string
  disabled?: boolean
  placeholder?: string
  'aria-label'?: string
}) {
  const grupos = lerGrupos(children)
  const atual = String(value)
  return (
    <SelectPrimitive.Root
      value={atual === '' ? VALOR_VAZIO : atual}
      onValueChange={(v) => onValueChange(v === VALOR_VAZIO ? '' : v)}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn(
          campo,
          'flex h-9 items-center justify-between gap-2 py-1 pr-2 text-left whitespace-nowrap data-[placeholder]:text-muted-foreground [&>span]:truncate',
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="relative z-[60] max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center">
            <ChevronUp className="size-4" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="p-1">
            {grupos.map((g, i) => (
              <Fragment key={i}>
                {i > 0 && <SelectPrimitive.Separator className="-mx-1 my-1 h-px bg-border" />}
                <SelectPrimitive.Group>
                  {g.label && (
                    <SelectPrimitive.Label className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{g.label}</SelectPrimitive.Label>
                  )}
                  {g.opcoes.map((o) => (
                    <SelectPrimitive.Item
                      key={o.valor}
                      value={o.valor === '' ? VALOR_VAZIO : o.valor}
                      disabled={o.disabled}
                      className="relative flex w-full items-center rounded-md py-1.5 pr-8 pl-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-muted data-[highlighted]:text-foreground"
                    >
                      <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                      <span className="absolute right-2 flex size-4 items-center justify-center">
                        <SelectPrimitive.ItemIndicator>
                          <Check className="size-4" />
                        </SelectPrimitive.ItemIndicator>
                      </span>
                    </SelectPrimitive.Item>
                  ))}
                </SelectPrimitive.Group>
              </Fragment>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center">
            <ChevronDown className="size-4" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

/**
 * Rótulo + campo. `dica` fica sempre visível abaixo do campo (orientação de preenchimento);
 * `ajuda` é a explicação mais longa no ícone "?", que some quando as dicas estão desligadas.
 */
export function Campo({
  label,
  children,
  dica,
  ajuda,
}: {
  label: string
  children: ReactNode
  dica?: ReactNode
  ajuda?: ReactNode
}) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center gap-1.5 text-sm font-medium">
        {label}
        {ajuda && <InfoDica texto={ajuda} lado="top" />}
      </span>
      {children}
      {dica && <span className="block text-xs text-muted-foreground">{dica}</span>}
    </label>
  )
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', className)}>
      {children}
    </span>
  )
}

export function Dialog({
  aberto,
  onAbertoChange,
  titulo,
  descricao,
  children,
  largura = 'max-w-lg',
}: {
  aberto: boolean
  onAbertoChange: (aberto: boolean) => void
  titulo: string
  descricao?: string
  children: ReactNode
  largura?: string
}) {
  return (
    <DialogPrimitive.Root open={aberto} onOpenChange={onAbertoChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none" />
        <DialogPrimitive.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-popover p-6 text-popover-foreground shadow-xl',
            largura,
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="text-lg font-semibold">{titulo}</DialogPrimitive.Title>
              {descricao ? (
                <DialogPrimitive.Description className="text-sm text-muted-foreground">{descricao}</DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">{titulo}</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close className="rounded-sm p-1 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Fechar">
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
