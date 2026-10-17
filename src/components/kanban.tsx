import { useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { KanbanSquare, MoreHorizontal, MousePointerClick, Pencil, Plus, Table2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDicas } from '@/lib/dicas'
import { PaginacaoColuna, usePaginasPorColuna } from './paginacao'
import { Dica } from './dica'
import { Button, Dialog, Input, MenuAcoes } from './ui'

export type ColunaKanban = {
  chave: string
  titulo: string
  /** Classe da bolinha de cor no título. */
  ponto?: string
  /** Classe de fundo da coluna. */
  fundo?: string
  /** Explicação do que entra na coluna, mostrada ao passar o mouse no título. */
  dica?: string
  /** Coluna criada pela equipe: ganha o menu para renomear (se `renomeavel`) e excluir. */
  editavel?: { id: string; renomeavel: boolean }
}

/** Ações de colunas criadas pela equipe. `id` é o de `ColunaKanban.editavel`. */
export type EdicaoColunas = {
  onCriar: (titulo: string) => void
  onRenomear: (id: string, titulo: string) => void
  onExcluir: (id: string) => void
}

/**
 * Kanban genérico. Com `onMover`, os cards podem ser arrastados entre colunas;
 * sem ele, as colunas são só leitura (ex.: agrupamentos calculados).
 * Com `edicaoColunas`, aparece "Nova coluna" no fim e as colunas criadas ganham menu.
 */
export function Kanban<T>({
  colunas,
  itens,
  colunaDe,
  chaveDe,
  renderCard,
  onMover,
  vazio = 'Nada aqui',
  carregando,
  ajudaMover,
  edicaoColunas,
}: {
  colunas: ColunaKanban[]
  itens: T[]
  colunaDe: (item: T) => string
  chaveDe: (item: T) => string
  renderCard: (item: T) => ReactNode
  onMover?: (item: T, destino: string) => void
  vazio?: string
  carregando?: boolean
  /** Explica o efeito de arrastar um card (só aparece com as dicas ligadas e `onMover`). */
  ajudaMover?: string
  edicaoColunas?: EdicaoColunas
}) {
  const { ativas } = useDicas()
  const [sobre, setSobre] = useState<string | null>(null)
  const [renomeando, setRenomeando] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState<ColunaKanban | null>(null)
  const { fatiar } = usePaginasPorColuna()
  const porColuna = new Map<string, T[]>(colunas.map((c) => [c.chave, []]))

  /** Nome repetido (de coluna fixa ou criada) vira aviso aqui, antes de chegar ao banco. */
  function tituloLivre(titulo: string, ignorar?: string) {
    const t = titulo.trim().toLowerCase()
    const repetido = colunas.some((c) => c.chave !== ignorar && c.titulo.trim().toLowerCase() === t)
    if (repetido) toast.error('Já existe uma coluna com esse nome neste quadro.')
    return !repetido
  }
  for (const item of itens) porColuna.get(colunaDe(item))?.push(item)

  function soltar(destino: string, chave: string) {
    setSobre(null)
    const item = itens.find((i) => chaveDe(i) === chave)
    if (item && onMover && colunaDe(item) !== destino) onMover(item, destino)
  }

  return (
    <div className={cn('space-y-2', ENTRADA_VISAO)}>
      {ativas && onMover && ajudaMover && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MousePointerClick className="size-3.5" aria-hidden="true" />
          {ajudaMover}
        </p>
      )}
      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div className="flex min-w-full gap-3">
          {colunas.map((c) => {
            const lista = porColuna.get(c.chave) ?? []
            const { itens: visiveis, controles } = fatiar(c.chave, lista)
            return (
              <section
                key={c.chave}
                onDragOver={
                  onMover
                    ? (e) => {
                        e.preventDefault()
                        setSobre(c.chave)
                      }
                    : undefined
                }
                onDragLeave={onMover ? () => setSobre((s) => (s === c.chave ? null : s)) : undefined}
                onDrop={
                  onMover
                    ? (e) => {
                        e.preventDefault()
                        soltar(c.chave, e.dataTransfer.getData('text/kanban'))
                      }
                    : undefined
                }
                className={cn(
                  'flex min-h-48 w-72 shrink-0 grow basis-72 flex-col gap-2 rounded-xl p-2 transition-shadow',
                  c.fundo ?? 'bg-muted/60',
                  sobre === c.chave && 'ring-2 ring-primary/40',
                )}
              >
                <header className="flex items-center gap-2 px-1 py-1 text-sm font-semibold">
                  {c.ponto && <span className={cn('size-2 shrink-0 rounded-full', c.ponto)} />}
                  {c.editavel && renomeando === c.editavel.id ? (
                    <CampoTitulo
                      inicial={c.titulo}
                      rotulo={`Novo nome da coluna ${c.titulo}`}
                      onSalvar={(t) => {
                        setRenomeando(null)
                        if (t !== c.titulo && tituloLivre(t, c.chave)) edicaoColunas?.onRenomear(c.editavel!.id, t)
                      }}
                      onCancelar={() => setRenomeando(null)}
                    />
                  ) : (
                    <Dica texto={c.dica} sublinhado className="min-w-0">
                      <span className="truncate">{c.titulo}</span>
                    </Dica>
                  )}
                  <span className="ml-auto text-xs font-normal text-muted-foreground">{lista.length}</span>
                  {c.editavel && edicaoColunas && (
                    <MenuAcoes
                      rotulo={`Opções da coluna ${c.titulo}`}
                      gatilho={
                        <button
                          type="button"
                          aria-label={`Opções da coluna ${c.titulo}`}
                          className="-my-1 rounded-sm p-0.5 text-muted-foreground outline-none hover:bg-background/70 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      }
                      acoes={[
                        ...(c.editavel.renomeavel
                          ? [{ label: 'Renomear', icone: Pencil, onSelect: () => setRenomeando(c.editavel!.id) }]
                          : []),
                        { label: 'Excluir coluna…', icone: Trash2, perigo: true, onSelect: () => setExcluindo(c) },
                      ]}
                    />
                  )}
                </header>
                {visiveis.map((item) => (
                  <div
                    key={chaveDe(item)}
                    draggable={!!onMover}
                    onDragStart={
                      onMover
                        ? (e) => {
                            e.dataTransfer.setData('text/kanban', chaveDe(item))
                            e.dataTransfer.effectAllowed = 'move'
                          }
                        : undefined
                    }
                    className={cn(onMover && 'cursor-grab active:cursor-grabbing')}
                  >
                    {renderCard(item)}
                  </div>
                ))}
                {!lista.length && !carregando && (
                  <p className="px-1 py-4 text-center text-xs text-muted-foreground/70">{vazio}</p>
                )}
                {carregando && <p className="px-1 text-xs text-muted-foreground/70">Carregando…</p>}
                <PaginacaoColuna {...controles} />
              </section>
            )
          })}
          {edicaoColunas && <NovaColuna onCriar={(t) => tituloLivre(t) && edicaoColunas.onCriar(t)} />}
        </div>
      </div>
      {edicaoColunas && (
        <Dialog
          aberto={!!excluindo}
          onAbertoChange={(a) => !a && setExcluindo(null)}
          titulo={`Excluir a coluna “${excluindo?.titulo ?? ''}”?`}
          descricao={
            excluindo?.editavel?.renomeavel
              ? 'Os cards desta coluna voltam para a coluna em que estavam antes. Nada é apagado.'
              : 'A coluna sai do quadro. Nada é apagado.'
          }
        >
          <div className="flex justify-end gap-2">
            <Button variante="secundario" onClick={() => setExcluindo(null)}>
              Cancelar
            </Button>
            <Button
              variante="perigo"
              onClick={() => {
                if (excluindo?.editavel) edicaoColunas.onExcluir(excluindo.editavel.id)
                setExcluindo(null)
              }}
            >
              Excluir coluna
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  )
}

/** Campo de título inline: Enter salva, Esc cancela, sair do campo salva se tiver texto. */
function CampoTitulo({
  inicial = '',
  rotulo,
  placeholder,
  onSalvar,
  onCancelar,
}: {
  inicial?: string
  rotulo: string
  placeholder?: string
  onSalvar: (titulo: string) => void
  onCancelar: () => void
}) {
  const [valor, setValor] = useState(inicial)
  // Enter e o blur que vem logo depois não podem salvar duas vezes.
  const concluido = useRef(false)
  const concluir = (fn: () => void) => {
    if (concluido.current) return
    concluido.current = true
    fn()
  }
  const salvar = () => concluir(() => (valor.trim() ? onSalvar(valor.trim()) : onCancelar()))
  return (
    <Input
      autoFocus
      aria-label={rotulo}
      placeholder={placeholder}
      maxLength={60}
      value={valor}
      className="h-7 min-w-0 flex-1 px-2 py-1 text-sm font-semibold"
      onChange={(e) => setValor(e.target.value)}
      onBlur={salvar}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          salvar()
        }
        if (e.key === 'Escape') concluir(onCancelar)
      }}
    />
  )
}

/** Última "coluna" do quadro: botão que vira campo para dar nome à coluna nova. */
function NovaColuna({ onCriar }: { onCriar: (titulo: string) => void }) {
  const [aberta, setAberta] = useState(false)
  return (
    <div className="w-72 shrink-0">
      {aberta ? (
        <div className="flex items-center gap-2 rounded-xl bg-muted/60 p-2">
          <CampoTitulo
            rotulo="Nome da nova coluna"
            placeholder="Nome da coluna"
            onSalvar={(t) => {
              setAberta(false)
              onCriar(t)
            }}
            onCancelar={() => setAberta(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAberta(true)}
          className="flex h-11 w-full items-center gap-1.5 rounded-xl border border-dashed px-3 text-sm font-medium text-muted-foreground outline-none hover:border-foreground/30 hover:bg-muted/40 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Plus className="size-4" />
          Nova coluna
        </button>
      )}
    </div>
  )
}

export type Visao = 'tabela' | 'kanban'

export function lerVisao(v: unknown): Visao | undefined {
  return v === 'kanban' || v === 'tabela' ? v : undefined
}

/** Entrada suave da visão (tabela ou kanban) que acabou de ser escolhida. Aplicar na raiz de cada visão. */
export const ENTRADA_VISAO = 'animate-in fade-in-0 slide-in-from-bottom-2 duration-500 ease-out motion-reduce:animate-none'

/** Alternância Tabela / Kanban. O destaque desliza de uma opção para a outra. */
export function VisaoToggle({ valor, onChange }: { valor: Visao; onChange: (v: Visao) => void }) {
  const opcoes: [Visao, string, typeof Table2][] = [
    ['tabela', 'Tabela', Table2],
    ['kanban', 'Kanban', KanbanSquare],
  ]
  return (
    <div role="radiogroup" aria-label="Visualização" className="relative inline-grid h-9 grid-cols-2 rounded-md border bg-background p-0.5">
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-[5px] bg-muted shadow-xs transition-transform duration-500 ease-in-out motion-reduce:transition-none',
          valor === 'kanban' && 'translate-x-full',
        )}
      />
      {opcoes.map(([v, label, Icone]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={valor === v}
          onClick={() => onChange(v)}
          className={cn(
            'relative inline-flex items-center justify-center gap-1.5 rounded-[5px] px-2.5 text-[0.8rem] font-medium transition-colors duration-500 outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            valor === v ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icone className="size-4" />
          {label}
        </button>
      ))}
    </div>
  )
}
