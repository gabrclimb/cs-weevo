import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import {
  Dialog as DialogPrimitive,
  DropdownMenu as MenuPrimitive,
  Popover as PopoverPrimitive,
  Select as SelectPrimitive,
} from 'radix-ui'
import { Check, ChevronDown, ChevronUp, Eye, EyeOff, X, type LucideIcon } from 'lucide-react'
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

/** Campo de senha com botão de olho para mostrar ou esconder o que foi digitado. */
export function InputSenha({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visivel, setVisivel] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={visivel ? 'text' : 'password'} className={cn('pr-10', className)} />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? 'Esconder senha' : 'Mostrar senha'}
        aria-pressed={visivel}
        title={visivel ? 'Esconder senha' : 'Mostrar senha'}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {visivel ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  )
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
type PropsCampoLista = {
  role: 'combobox'
  autoComplete: 'off'
  'aria-expanded': boolean
  'aria-controls': string
  'aria-autocomplete': 'list'
  'aria-activedescendant': string | undefined
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
}

/**
 * Lista flutuante de opções presa a um campo de texto (busca, sugestões).
 * Fica num portal para não ser cortada pela rolagem do modal, tem fundo sólido como o Select
 * e navega com ↑ ↓ Enter Esc. O campo é renderizado por `children`, que recebe os atributos de acessibilidade.
 */
export function ListaFlutuante<T>({
  aberto,
  itens,
  chaveDe,
  renderItem,
  onEscolher,
  onFechar,
  children,
}: {
  aberto: boolean
  itens: T[]
  chaveDe: (item: T) => string
  renderItem: (item: T) => ReactNode
  onEscolher: (item: T) => void
  onFechar: () => void
  children: (props: PropsCampoLista) => ReactNode
}) {
  const id = useId()
  const ancora = useRef<HTMLDivElement>(null)
  const [ativo, setAtivo] = useState(0)
  const visivel = aberto && itens.length > 0

  useEffect(() => setAtivo(0), [itens.length, visivel])

  // O modal trava a rolagem da página pelo document; a roda do mouse na lista não pode chegar até lá.
  const lista = useCallback((el: HTMLDivElement | null) => {
    el?.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true })
    el?.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true })
  }, [])

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!visivel) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAtivo((a) => (a + 1) % itens.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAtivo((a) => (a - 1 + itens.length) % itens.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      onEscolher(itens[Math.min(ativo, itens.length - 1)])
    }
  }

  return (
    <PopoverPrimitive.Root open={visivel} onOpenChange={(o) => !o && onFechar()}>
      <PopoverPrimitive.Anchor asChild>
        <div ref={ancora}>
          {children({
            role: 'combobox',
            autoComplete: 'off',
            'aria-expanded': visivel,
            'aria-controls': id,
            'aria-autocomplete': 'list',
            'aria-activedescendant': visivel ? `${id}-${ativo}` : undefined,
            onKeyDown,
          })}
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          ref={lista}
          id={id}
          role="listbox"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (ancora.current?.contains(e.target as Node)) e.preventDefault()
          }}
          onMouseDown={(e) => e.preventDefault()}
          className="z-[60] max-h-[min(16rem,var(--radix-popover-content-available-height))] w-(--radix-popover-trigger-width) overflow-y-auto overscroll-contain rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          {itens.map((item, i) => (
            <div
              key={chaveDe(item)}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === ativo}
              onMouseEnter={() => setAtivo(i)}
              onClick={() => onEscolher(item)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none',
                i === ativo && 'bg-muted text-foreground',
              )}
            >
              {renderItem(item)}
            </div>
          ))}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

const semAcento = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

/** Campo de texto livre com sugestões (substitui o <datalist>, que o navegador desenha fora do tema). */
export function InputSugestoes({
  value,
  onValueChange,
  sugestoes,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'list'> & {
  value: string
  onValueChange: (valor: string) => void
  sugestoes: string[]
}) {
  const [aberto, setAberto] = useState(false)
  const q = semAcento(value)
  const itens = sugestoes.filter((s) => {
    const n = semAcento(s)
    return n.includes(q) && n !== q
  })

  function escolher(valor: string) {
    onValueChange(valor)
    setAberto(false)
  }

  return (
    <ListaFlutuante
      aberto={aberto}
      itens={itens}
      chaveDe={(s) => s}
      renderItem={(s) => <span className="truncate">{s}</span>}
      onEscolher={escolher}
      onFechar={() => setAberto(false)}
    >
      {(a11y) => (
        <Input
          {...props}
          {...a11y}
          value={value}
          onChange={(e) => {
            onValueChange(e.target.value)
            setAberto(true)
          }}
          onFocus={(e) => {
            setAberto(true)
            props.onFocus?.(e)
          }}
          onClick={() => setAberto(true)}
          onBlur={(e) => {
            setAberto(false)
            props.onBlur?.(e)
          }}
        />
      )}
    </ListaFlutuante>
  )
}

export type AcaoMenu =
  | {
      label: string
      icone?: LucideIcon
      /** Linha de apoio abaixo do rótulo (ex.: quantos serão afetados ou por que está desabilitada). */
      descricao?: string
      onSelect: () => void
      disabled?: boolean
      perigo?: boolean
    }
  | 'separador'

/** Botão único que abre um menu com várias ações (mesmo visual do Select). */
export function MenuAcoes({
  rotulo,
  icone: Icone,
  acoes,
  variante = 'primario',
  disabled,
}: {
  rotulo: ReactNode
  icone?: LucideIcon
  acoes: AcaoMenu[]
  variante?: Variante
  disabled?: boolean
}) {
  return (
    <MenuPrimitive.Root modal={false}>
      <MenuPrimitive.Trigger asChild disabled={disabled}>
        <Button variante={variante}>
          {Icone && <Icone className="size-4" />}
          {rotulo}
          <ChevronDown className="size-4 opacity-70" aria-hidden="true" />
        </Button>
      </MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Content
          align="end"
          sideOffset={4}
          collisionPadding={8}
          className="z-[60] min-w-64 rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          {acoes.map((a, i) =>
            a === 'separador' ? (
              <MenuPrimitive.Separator key={i} className="-mx-1 my-1 h-px bg-border" />
            ) : (
              <MenuPrimitive.Item
                key={a.label}
                disabled={a.disabled}
                onSelect={a.onSelect}
                className={cn(
                  'flex items-start gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-muted data-[highlighted]:text-foreground',
                  a.perigo && 'text-rose-600 data-[highlighted]:text-rose-600',
                )}
              >
                {a.icone && <a.icone className="mt-0.5 size-4 shrink-0 opacity-80" aria-hidden="true" />}
                <span className="min-w-0">
                  {a.label}
                  {a.descricao && <span className="block text-xs text-muted-foreground">{a.descricao}</span>}
                </span>
              </MenuPrimitive.Item>
            ),
          )}
        </MenuPrimitive.Content>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  )
}

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
