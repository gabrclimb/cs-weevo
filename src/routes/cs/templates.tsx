import { useEffect, useState, type FormEvent } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Copy, FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Campo, Dialog, Input, Select, Textarea } from '@/components/ui'
import { Dica } from '@/components/dica'
import type { TemplateRow } from '@/lib/tipos'
import {
  useExcluirCategoria,
  useExcluirTemplate,
  useSalvarCategoria,
  useSalvarTemplate,
  useTemplates,
} from '@/features/templates/queries'

export const Route = createFileRoute('/cs/templates')({
  component: TemplatesPage,
})

const PLACEHOLDERS = [
  ['[nome]', 'apelido ou primeiro nome'],
  ['[turma]', 'nome da turma'],
  ['[plantao_data]', 'próximo plantão, ex.: 08/10 (qui)'],
  ['[plantao_horario]', 'horário desse plantão'],
]

function TemplatesPage() {
  const templates = useTemplates()
  const salvarCategoria = useSalvarCategoria()
  const excluirCategoria = useExcluirCategoria()
  const excluirTemplate = useExcluirTemplate()
  const [editando, setEditando] = useState<TemplateRow | 'novo' | null>(null)
  const [excluindo, setExcluindo] = useState<TemplateRow | null>(null)

  const categorias = templates.data?.categorias ?? []
  const grupos = [
    ...categorias.map((c) => ({ categoria: c, itens: templates.data!.templates.filter((t) => t.category_id === c.id) })),
    { categoria: null, itens: (templates.data?.templates ?? []).filter((t) => !t.category_id) },
  ].filter((g) => g.categoria || g.itens.length)

  function novaCategoria() {
    const nome = window.prompt('Nome da categoria')?.trim()
    if (nome) salvarCategoria.mutate({ nome, ordem: categorias.length })
  }

  function renomear(id: string, atual: string) {
    const nome = window.prompt('Novo nome da categoria', atual)?.trim()
    if (nome && nome !== atual) salvarCategoria.mutate({ id, nome })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Templates</h1>
          <p className="text-sm text-muted-foreground">
            Placeholders: {PLACEHOLDERS.map(([p]) => p).join(', ')}. São preenchidos ao usar o template numa tarefa.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variante="secundario" onClick={novaCategoria}>
            <FolderPlus className="size-4" />
            Nova categoria
          </Button>
          <Button onClick={() => setEditando('novo')}>
            <Plus className="size-4" />
            Novo template
          </Button>
        </div>
      </div>

      {templates.error && <p className="text-sm text-rose-700">Não foi possível carregar os templates. Tente novamente.</p>}
      {templates.data && grupos.length === 0 && (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          Nenhum template ainda. Crie uma categoria (ex.: "Pós-plantão") e os templates de mensagem.
        </p>
      )}

      {grupos.map(({ categoria, itens }) => (
        <section key={categoria?.id ?? 'sem'} className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{categoria?.nome ?? 'Sem categoria'}</h2>
            {categoria && (
              <>
                <button onClick={() => renomear(categoria.id, categoria.nome)} className="rounded-sm p-1 text-muted-foreground/70 hover:text-primary" aria-label="Renomear categoria">
                  <Pencil className="size-3.5" />
                </button>
                <button
                  onClick={() => window.confirm(`Excluir a categoria "${categoria.nome}"?`) && excluirCategoria.mutate(categoria.id)}
                  className="rounded-sm p-1 text-muted-foreground/70 hover:text-rose-600"
                  aria-label="Excluir categoria"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {itens.map((t) => (
              <article key={t.id} className="flex flex-col rounded-lg border bg-card p-4 text-sm">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-medium">{t.titulo}</h3>
                  <div className="flex shrink-0 gap-0.5">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(t.conteudo)
                        toast.success('Template copiado.')
                      }}
                      className="rounded-sm p-1 text-muted-foreground/70 hover:text-primary"
                      aria-label="Copiar"
                    >
                      <Copy className="size-3.5" />
                    </button>
                    <button onClick={() => setEditando(t)} className="rounded-sm p-1 text-muted-foreground/70 hover:text-primary" aria-label="Editar">
                      <Pencil className="size-3.5" />
                    </button>
                    <button onClick={() => setExcluindo(t)} className="rounded-sm p-1 text-muted-foreground/70 hover:text-rose-600" aria-label="Excluir">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                <p className="line-clamp-6 whitespace-pre-wrap text-muted-foreground">{t.conteudo}</p>
              </article>
            ))}
            {itens.length === 0 && <p className="text-sm text-muted-foreground/70">Nenhum template nesta categoria.</p>}
          </div>
        </section>
      ))}

      <TemplateForm
        aberto={editando !== null}
        onAbertoChange={(a) => !a && setEditando(null)}
        template={editando === 'novo' ? undefined : (editando ?? undefined)}
        categorias={categorias}
      />
      <Dialog
        aberto={!!excluindo}
        onAbertoChange={(a) => !a && setExcluindo(null)}
        titulo="Excluir template?"
        descricao={`"${excluindo?.titulo}" será excluído.`}
      >
        <div className="flex justify-end gap-2">
          <Button variante="secundario" onClick={() => setExcluindo(null)}>
            Cancelar
          </Button>
          <Button variante="perigo" onClick={() => excluindo && excluirTemplate.mutate(excluindo.id, { onSuccess: () => setExcluindo(null) })}>
            Excluir
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

function TemplateForm({
  aberto,
  onAbertoChange,
  template,
  categorias,
}: {
  aberto: boolean
  onAbertoChange: (a: boolean) => void
  template?: TemplateRow
  categorias: { id: string; nome: string }[]
}) {
  const salvar = useSalvarTemplate()
  const [form, setForm] = useState({ titulo: '', category_id: '', conteudo: '' })

  useEffect(() => {
    if (aberto) {
      setForm({
        titulo: template?.titulo ?? '',
        category_id: template?.category_id ?? '',
        conteudo: template?.conteudo ?? '',
      })
    }
  }, [aberto, template])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const ok = await salvar
      .mutateAsync({
        id: template?.id,
        dados: { titulo: form.titulo.trim(), conteudo: form.conteudo, category_id: form.category_id || null },
      })
      .then(() => true)
      .catch(() => false)
    if (ok) onAbertoChange(false)
  }

  return (
    <Dialog
      aberto={aberto}
      onAbertoChange={onAbertoChange}
      titulo={template ? 'Editar template' : 'Novo template'}
      descricao="Mensagem pronta para reaproveitar nas tarefas. Os placeholders entre colchetes são trocados pelos dados de quem recebe."
      largura="max-w-2xl"
    >
      <form onSubmit={enviar} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
          <Campo label="Título *">
            <Input
              required
              autoFocus
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ex.: Lembrete de plantão"
            />
          </Campo>
          <Campo label="Categoria" ajuda="Agrupa os templates nesta tela e na lista “Usar template…” das tarefas.">
            <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
              <option value="">Sem categoria</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </Campo>
        </div>
        <Campo label="Mensagem *">
          <Textarea
            required
            className="min-h-48"
            value={form.conteudo}
            onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
            placeholder="Oi [nome]! Amanhã, [plantao_data] às [plantao_horario], tem plantão da turma [turma]…"
          />
        </Campo>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Clique para inserir:</span>
          {PLACEHOLDERS.map(([p, desc]) => (
            <Dica key={p} texto={`Vira o ${desc}.`}>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, conteudo: f.conteudo + p }))}
                className="rounded-sm border bg-muted/50 px-2 py-0.5 font-mono text-xs text-foreground hover:border-primary"
              >
                {p}
              </button>
            </Dica>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <span className="mr-auto text-xs text-muted-foreground">* obrigatório</span>
          <Button variante="secundario" onClick={() => onAbertoChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={salvar.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
