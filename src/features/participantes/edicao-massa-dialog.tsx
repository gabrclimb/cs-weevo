import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button, Campo, Dialog, Input, Select } from '@/components/ui'
import type { Database, ParticipanteRow, ParticipanteStatus, TurmaRow, WeevoStart } from '@/lib/database.types'
import { DICA_STATUS_PARTICIPANTE, DICA_WEEVO_START } from '@/lib/textos-dicas'
import { STATUS_KEYS, STATUS_PARTICIPANTE, WEEVO_START, WEEVO_START_KEYS } from './constantes'
import { useAtualizarEmMassa } from './queries'

type ParticipanteUpdate = Database['public']['Tables']['weevo_participantes']['Update']

// Valores especiais dos seletores. "" (vazio) = não alterar.
const SEM = '__sem__'
const NOVO = '__novo__'

const VAZIO = { status: '', weevo_start: '', turma: '', responsavel: '', responsavelNovo: '' }

/** Altera status, Weevo Start, turma e responsável de vários participantes de uma vez. */
export function EdicaoMassaDialog({
  aberto,
  onAbertoChange,
  participantes,
  turmas,
  responsaveis,
  onConcluido,
}: {
  aberto: boolean
  onAbertoChange: (aberto: boolean) => void
  participantes: ParticipanteRow[]
  turmas: TurmaRow[]
  responsaveis: string[]
  onConcluido: () => void
}) {
  const atualizar = useAtualizarEmMassa()
  const [form, setForm] = useState(VAZIO)

  useEffect(() => {
    if (aberto) setForm(VAZIO)
  }, [aberto])

  const mudancas: ParticipanteUpdate = {}
  if (form.status) mudancas.status = form.status as ParticipanteStatus
  if (form.weevo_start) mudancas.weevo_start = form.weevo_start as WeevoStart
  if (form.turma) mudancas.turma_id = form.turma === SEM ? null : form.turma
  if (form.responsavel === SEM) mudancas.responsavel = null
  else if (form.responsavel === NOVO) {
    if (form.responsavelNovo.trim()) mudancas.responsavel = form.responsavelNovo.trim()
  } else if (form.responsavel) mudancas.responsavel = form.responsavel

  const nomeTurma = (id: string | null) => (id ? (turmas.find((t) => t.id === id)?.nome ?? '—') : 'Sem turma')

  // Resumo do que vai mudar, com quantos participantes de fato mudam em cada campo.
  const resumo: { campo: string; para: string; mudam: number }[] = []
  if (mudancas.status) {
    resumo.push({
      campo: 'Status',
      para: STATUS_PARTICIPANTE[mudancas.status].label,
      mudam: participantes.filter((p) => p.status !== mudancas.status).length,
    })
  }
  if (mudancas.weevo_start) {
    resumo.push({
      campo: 'Weevo Start',
      para: WEEVO_START[mudancas.weevo_start].label,
      mudam: participantes.filter((p) => p.weevo_start !== mudancas.weevo_start).length,
    })
  }
  if (mudancas.turma_id !== undefined) {
    resumo.push({
      campo: 'Turma',
      para: nomeTurma(mudancas.turma_id),
      mudam: participantes.filter((p) => p.turma_id !== mudancas.turma_id).length,
    })
  }
  if (mudancas.responsavel !== undefined) {
    resumo.push({
      campo: 'Responsável',
      para: mudancas.responsavel ?? 'Sem responsável',
      mudam: participantes.filter((p) => p.responsavel !== mudancas.responsavel).length,
    })
  }

  const algoMuda = resumo.some((r) => r.mudam > 0)

  async function aplicar(e: FormEvent) {
    e.preventDefault()
    if (!algoMuda) return
    const ok = await atualizar
      .mutateAsync({ participantes, mudancas })
      .then(() => true)
      .catch(() => false)
    if (ok) {
      onAbertoChange(false)
      onConcluido()
    }
  }

  const set = (campo: keyof typeof VAZIO) => (v: string) => setForm((f) => ({ ...f, [campo]: v }))

  return (
    <Dialog
      aberto={aberto}
      onAbertoChange={onAbertoChange}
      titulo={`Alterar ${participantes.length} participante(s)`}
      descricao="Escolha só o que quer mudar. Campos em “Não alterar” ficam como estão em cada participante."
    >
      <form onSubmit={aplicar} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            label="Status"
            dica={form.status ? DICA_STATUS_PARTICIPANTE[form.status as ParticipanteStatus] : undefined}
            ajuda="A mudança fica registrada na linha do tempo de cada participante. Não altera a pontuação."
          >
            <Select value={form.status} onValueChange={set('status')}>
              <option value="">Não alterar</option>
              {STATUS_KEYS.map((k) => (
                <option key={k} value={k}>
                  {STATUS_PARTICIPANTE[k].label}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo
            label="Weevo Start"
            dica={form.weevo_start ? DICA_WEEVO_START[form.weevo_start as WeevoStart] : undefined}
            ajuda="A mudança fica registrada na linha do tempo de cada participante. Para repassar ao comercial, use “Repassar ao comercial” no botão Ações: ele também registra o repasse."
          >
            <Select value={form.weevo_start} onValueChange={set('weevo_start')}>
              <option value="">Não alterar</option>
              {WEEVO_START_KEYS.map((k) => (
                <option key={k} value={k}>
                  {WEEVO_START[k].label}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Turma" ajuda="Muda os plantões e as tarefas de turma que valem para estes participantes.">
            <Select value={form.turma} onValueChange={set('turma')}>
              <option value="">Não alterar</option>
              <option value={SEM}>Sem turma</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Responsável" ajuda="Pessoa da equipe que acompanha estes participantes.">
            <Select value={form.responsavel} onValueChange={set('responsavel')}>
              <option value="">Não alterar</option>
              <option value={SEM}>Sem responsável</option>
              {responsaveis.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              <option value={NOVO}>Outro nome…</option>
            </Select>
          </Campo>
        </div>
        {form.responsavel === NOVO && (
          <Campo label="Nome do responsável">
            <Input
              autoFocus
              value={form.responsavelNovo}
              onChange={(e) => set('responsavelNovo')(e.target.value)}
              placeholder="Ex.: Ana"
            />
          </Campo>
        )}

        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          {resumo.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma mudança escolhida ainda.</p>
          ) : (
            <ul className="space-y-1">
              {resumo.map((r) => (
                <li key={r.campo} className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{r.campo}</span>
                  <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <span>{r.para}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.mudam === 0
                      ? '(todos já estão assim)'
                      : r.mudam === participantes.length
                        ? `(${r.mudam} mudam)`
                        : `(${r.mudam} mudam, ${participantes.length - r.mudam} já estão assim)`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {mudancas.status === 'inativo' && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
              Inativos deixam de gerar alertas, não recebem tarefas geradas para a turma e ficam fora da página Engajamento por padrão.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variante="secundario" onClick={() => onAbertoChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!algoMuda || atualizar.isPending}>
            {atualizar.isPending ? 'Aplicando…' : `Aplicar em ${participantes.length}`}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
