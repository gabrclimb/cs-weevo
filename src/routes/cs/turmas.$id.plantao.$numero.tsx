import { useEffect, useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, CheckCircle2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button } from '@/components/ui'
import { cn, dataCurta, hojeISO } from '@/lib/utils'
import { useParticipantes } from '@/features/participantes/queries'
import { STATUS_PARTICIPANTE } from '@/features/participantes/constantes'
import { useAlternarPresenca, usePlantoes, useSalvarPlantao, useTurmas } from '@/features/turmas/queries'
import { useTodosEventos } from '@/features/eventos/queries'
import { useCriarTarefas, useTarefas } from '@/features/tarefas/queries'

export const Route = createFileRoute('/cs/turmas/$id/plantao/$numero')({
  component: PlantaoPage,
})

function PlantaoPage() {
  const { id, numero } = Route.useParams()
  const turmas = useTurmas()
  const plantoes = usePlantoes()
  const participantes = useParticipantes()
  const eventos = useTodosEventos()
  const tarefas = useTarefas()
  const alternar = useAlternarPresenca()
  const salvarPlantao = useSalvarPlantao()
  const criarTarefas = useCriarTarefas()

  const turma = turmas.data?.find((t) => t.id === id)
  const plantao = plantoes.data?.find((p) => p.turma_id === id && p.numero === Number(numero))
  const membros = useMemo(
    () => (participantes.data ?? []).filter((p) => p.turma_id === id).sort((a, b) => a.nome.localeCompare(b.nome)),
    [participantes.data, id],
  )
  const presentes = useMemo(
    () =>
      new Set(
        (eventos.data ?? [])
          .filter((e) => e.tipo === 'plantao_presenca' && e.plantao_id === plantao?.id)
          .map((e) => e.participante_id),
      ),
    [eventos.data, plantao?.id],
  )

  // Ausentes não inativos que ainda não têm tarefa de contato deste plantão.
  const comTarefa = useMemo(
    () => new Set((tarefas.data ?? []).filter((t) => t.plantao_id && t.plantao_id === plantao?.id).map((t) => t.participante_id)),
    [tarefas.data, plantao?.id],
  )
  const sugeridos = membros.filter((p) => !presentes.has(p.id) && p.status !== 'inativo' && !comTarefa.has(p.id))
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const chaveSugeridos = sugeridos.map((p) => p.id).join(',')
  useEffect(() => {
    setSelecionados(new Set(chaveSugeridos ? chaveSugeridos.split(',') : []))
  }, [chaveSugeridos])

  if (!turma || !plantao) {
    return (
      <p className="text-sm text-muted-foreground">
        {turmas.isLoading || plantoes.isLoading ? 'Carregando…' : 'Plantão não encontrado. Agende-o na página da turma.'}
      </p>
    )
  }

  const ocorridoEm = plantao.data
    ? new Date(`${plantao.data}T${plantao.horario ?? '12:00'}`).toISOString()
    : new Date().toISOString()

  async function criarContatos() {
    if (!plantao) return
    const n = await criarTarefas
      .mutateAsync(
        [...selecionados].map((participante_id) => ({
          titulo: `Contato leve: ausência no plantão ${plantao.numero}`,
          tipo: 'mensagem_privada' as const,
          status: 'a_fazer' as const,
          participante_id,
          plantao_id: plantao.id,
          data_prevista: hojeISO(),
          canal: 'WhatsApp privado',
          objetivo: 'Entender o status de quem não veio ao plantão',
        })),
      )
      .catch(() => null)
    if (n) toast.success(`${n} tarefa(s) de contato criada(s) em Tarefas.`)
  }

  return (
    <div className="space-y-6">
      <Link to="/cs/turmas/$id" params={{ id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4" />
        Turma {turma.nome}
      </Link>

      <section className="flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-card p-5">
        <div>
          <h1 className="text-2xl font-bold">
            Plantão {plantao.numero} · Turma {turma.nome}
          </h1>
          <p className="text-sm text-muted-foreground">
            {plantao.data ? dataCurta(plantao.data) : 'Sem data'}
            {plantao.horario && ` às ${plantao.horario.slice(0, 5)}`} · {presentes.size} de {membros.length} presente(s)
          </p>
        </div>
        {plantao.realizado ? (
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-100 text-emerald-800">Realizado</Badge>
            <Button
              variante="fantasma"
              className="text-xs"
              onClick={() => salvarPlantao.mutate({ ...plantao, realizado: false })}
            >
              <Undo2 className="size-3.5" />
              Desfazer
            </Button>
          </div>
        ) : (
          <Button onClick={() => salvarPlantao.mutate({ ...plantao, realizado: true })}>
            <CheckCircle2 className="size-4" />
            Marcar como realizado
          </Button>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Presença</h2>
        <ul className="divide-y rounded-lg border bg-card">
          {membros.map((p) => {
            const presente = presentes.has(p.id)
            return (
              <li key={p.id}>
                <label className={cn('flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50', p.status === 'inativo' && 'opacity-60')}>
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={presente}
                    disabled={alternar.isPending}
                    onChange={(e) =>
                      alternar.mutate({ participanteId: p.id, plantaoId: plantao.id, presente: e.target.checked, ocorridoEm })
                    }
                  />
                  <span className="flex-1 font-medium">{p.nome}</span>
                  {p.status !== 'ativo' && (
                    <Badge className={STATUS_PARTICIPANTE[p.status].classe}>{STATUS_PARTICIPANTE[p.status].label}</Badge>
                  )}
                </label>
              </li>
            )
          })}
          {membros.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Turma sem participantes.</li>}
        </ul>
      </section>

      {plantao.realizado && sugeridos.length > 0 && (
        <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div>
            <h2 className="font-semibold text-amber-900">Sugestão: contato leve com quem não veio</h2>
            <p className="text-sm text-amber-900/80">
              Desmarque quem não precisa de contato. Nada é criado até você confirmar.
            </p>
          </div>
          <ul className="grid gap-1 sm:grid-cols-2">
            {sugeridos.map((p) => (
              <li key={p.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selecionados.has(p.id)}
                    onChange={(e) =>
                      setSelecionados((s) => {
                        const n = new Set(s)
                        if (e.target.checked) n.add(p.id)
                        else n.delete(p.id)
                        return n
                      })
                    }
                  />
                  {p.nome}
                </label>
              </li>
            ))}
          </ul>
          <Button onClick={criarContatos} disabled={!selecionados.size || criarTarefas.isPending}>
            Criar {selecionados.size} tarefa(s) de contato
          </Button>
        </section>
      )}
    </div>
  )
}
