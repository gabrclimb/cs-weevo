import { useMemo, useState, type FormEvent } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Pencil, Trash2, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, Campo, Dialog, Input } from '@/components/ui'
import { Dica, InfoDica } from '@/components/dica'
import { CABECALHO_TABELA } from '@/components/paginacao'
import { normalize } from '@/lib/csv'
import { cn } from '@/lib/utils'
import { useParticipantes, useTrocarResponsavel } from '@/features/participantes/queries'
import { DepoimentosLp } from '@/features/lp/depoimentos-admin'

type Aba = 'responsaveis' | 'videos'
const ABAS: { chave: Aba; rotulo: string }[] = [
  { chave: 'responsaveis', rotulo: 'Responsáveis' },
  { chave: 'videos', rotulo: 'Vídeos da página inicial' },
]

export const Route = createFileRoute('/cs/configuracoes')({
  validateSearch: (s: Record<string, unknown>): { aba?: Aba } => ({ aba: s.aba === 'videos' ? 'videos' : undefined }),
  component: ConfiguracoesPage,
})

type Responsavel = { nome: string; total: number; parecidoCom?: string }

function ConfiguracoesPage() {
  const aba: Aba = Route.useSearch().aba ?? 'responsaveis'
  const navigate = useNavigate({ from: Route.fullPath })
  const participantes = useParticipantes()
  const trocar = useTrocarResponsavel()
  const [renomeando, setRenomeando] = useState<Responsavel | null>(null)
  const [removendo, setRemovendo] = useState<Responsavel | null>(null)

  const { responsaveis, semResponsavel } = useMemo(() => {
    const contagem = new Map<string, number>()
    let sem = 0
    for (const p of participantes.data ?? []) {
      const nome = p.responsavel?.trim()
      if (nome) contagem.set(nome, (contagem.get(nome) ?? 0) + 1)
      else sem++
    }
    // Nomes que só diferem por maiúscula, acento ou espaço provavelmente são a mesma pessoa.
    const porChave = new Map<string, string[]>()
    for (const nome of contagem.keys()) porChave.set(normalize(nome), [...(porChave.get(normalize(nome)) ?? []), nome])
    const lista: Responsavel[] = [...contagem].map(([nome, total]) => {
      const iguais = porChave.get(normalize(nome)) ?? []
      const maisUsado = [...iguais].sort((a, b) => (contagem.get(b) ?? 0) - (contagem.get(a) ?? 0))[0]
      return { nome, total, parecidoCom: iguais.length > 1 && maisUsado !== nome ? maisUsado : undefined }
    })
    lista.sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome))
    return { responsaveis: lista, semResponsavel: sem }
  }, [participantes.data])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Ajustes gerais do sistema.</p>
      </div>

      <div role="tablist" aria-label="Seções de configurações" className="flex gap-1 border-b">
        {ABAS.map((a) => (
          <button
            key={a.chave}
            type="button"
            role="tab"
            aria-selected={aba === a.chave}
            onClick={() => navigate({ search: { aba: a.chave === 'responsaveis' ? undefined : a.chave }, replace: true })}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              aba === a.chave ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {aba === 'responsaveis' && (
      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-lg font-semibold">
            Responsáveis
            <InfoDica texto="O responsável é a pessoa da equipe que acompanha o participante. Os nomes surgem quando você os digita no cadastro do participante; aqui você corrige, une e remove." />
          </h2>
          <p className="text-sm text-muted-foreground">
            {participantes.data
              ? `${responsaveis.length} responsável(is) em uso${semResponsavel ? ` · ${semResponsavel} participante(s) sem responsável` : ''}`
              : 'Carregando…'}
          </p>
        </div>

        {participantes.error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            Não foi possível carregar os responsáveis. Tente novamente.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className={cn('border-b', CABECALHO_TABELA)}>
                  <tr>
                    <th className="px-4 py-3 font-medium">Nome</th>
                    <th className="px-4 py-3 text-right font-medium">Participantes</th>
                    <th className="px-4 py-3 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {responsaveis.map((r) => (
                    <tr key={r.nome} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 font-medium">
                          <UserRound className="size-4 text-muted-foreground/70" aria-hidden="true" />
                          {r.nome}
                          {r.parecidoCom && (
                            <Dica texto={`Parece o mesmo nome de “${r.parecidoCom}”. Use Renomear e digite “${r.parecidoCom}” para unir os dois.`}>
                              <Badge className="bg-amber-100 text-amber-800">Parece repetido</Badge>
                            </Dica>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <Link
                          to="/cs/participantes"
                          search={{ resp: r.nome }}
                          className="text-primary hover:underline"
                          title="Ver os participantes deste responsável"
                        >
                          {r.total}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <Button variante="secundario" className="h-8 px-2 text-xs" onClick={() => setRenomeando(r)}>
                            <Pencil className="size-3.5" />
                            Renomear
                          </Button>
                          <Button
                            variante="fantasma"
                            className="h-8 px-2 text-xs text-rose-600 hover:text-rose-600"
                            onClick={() => setRemovendo(r)}
                          >
                            <Trash2 className="size-3.5" />
                            Remover
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {participantes.data && responsaveis.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                        Nenhum responsável ainda. Defina o responsável na ficha do participante e ele aparece aqui.
                      </td>
                    </tr>
                  )}
                  {participantes.isLoading && (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                        Carregando…
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
      )}

      {aba === 'videos' && <DepoimentosLp />}

      <RenomearDialog
        responsavel={renomeando}
        existentes={responsaveis}
        pendente={trocar.isPending}
        onFechar={() => setRenomeando(null)}
        onConfirmar={(r, novo) =>
          trocar.mutate(
            { de: r.nome, para: novo },
            {
              onSuccess: (n) => {
                toast.success(`${n} participante(s) agora com o responsável ${novo}.`)
                setRenomeando(null)
              },
            },
          )
        }
      />

      <Dialog
        aberto={!!removendo}
        onAbertoChange={(a) => !a && setRemovendo(null)}
        titulo="Remover responsável?"
        descricao={
          removendo
            ? `“${removendo.nome}” será retirado dos ${removendo.total} participante(s) que o têm. Eles ficam sem responsável e continuam cadastrados.`
            : undefined
        }
      >
        <div className="flex justify-end gap-2">
          <Button variante="secundario" onClick={() => setRemovendo(null)}>
            Cancelar
          </Button>
          <Button
            variante="perigo"
            disabled={trocar.isPending}
            onClick={() =>
              removendo &&
              trocar.mutate(
                { de: removendo.nome, para: null },
                {
                  onSuccess: (n) => {
                    toast.success(`Responsável removido de ${n} participante(s).`)
                    setRemovendo(null)
                  },
                },
              )
            }
          >
            Remover
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

function RenomearDialog({
  responsavel,
  existentes,
  pendente,
  onFechar,
  onConfirmar,
}: {
  responsavel: Responsavel | null
  existentes: Responsavel[]
  pendente: boolean
  onFechar: () => void
  onConfirmar: (r: Responsavel, novo: string) => void
}) {
  // Reinicia o campo a cada responsável aberto: a chave muda e o formulário é remontado.
  return (
    <Dialog
      aberto={!!responsavel}
      onAbertoChange={(a) => !a && onFechar()}
      titulo="Renomear responsável"
      descricao="Vale para todos os participantes que têm este responsável."
    >
      {responsavel && (
        <FormRenomear key={responsavel.nome} responsavel={responsavel} existentes={existentes} pendente={pendente} onFechar={onFechar} onConfirmar={onConfirmar} />
      )}
    </Dialog>
  )
}

function FormRenomear({
  responsavel,
  existentes,
  pendente,
  onFechar,
  onConfirmar,
}: {
  responsavel: Responsavel
  existentes: Responsavel[]
  pendente: boolean
  onFechar: () => void
  onConfirmar: (r: Responsavel, novo: string) => void
}) {
  const [nome, setNome] = useState(responsavel.nome)
  const novo = nome.trim()
  const destino = existentes.find((e) => e.nome === novo && e.nome !== responsavel.nome)
  const igual = novo === responsavel.nome

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (novo && !igual) onConfirmar(responsavel, novo)
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <Campo
        label="Novo nome"
        dica={
          destino
            ? `Já existe “${destino.nome}”: os ${responsavel.total} participante(s) serão unidos a ele (${destino.total + responsavel.total} no total).`
            : undefined
        }
      >
        <Input required autoFocus value={nome} onChange={(e) => setNome(e.target.value)} />
      </Campo>
      <div className="flex justify-end gap-2">
        <Button variante="secundario" onClick={onFechar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!novo || igual || pendente}>
          {destino ? 'Unir' : 'Renomear'}
        </Button>
      </div>
    </form>
  )
}
