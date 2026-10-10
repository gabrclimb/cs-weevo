import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Wand2 } from 'lucide-react'
import { Button, Campo, Dialog, Input, InputSugestoes, Select, Textarea } from '@/components/ui'
import { InfoDica } from '@/components/dica'
import { DICA_STATUS_TAREFA, DICA_TIPO_TAREFA } from '@/lib/textos-dicas'
import type { TarefaRow } from '@/lib/tipos'
import { preencherPlaceholders } from '@/lib/placeholders'
import { useParticipantes, useTurmas } from '@/features/participantes/queries'
import { usePlantoes } from '@/features/turmas/queries'
import { CANAIS, STATUS_TAREFA, STATUS_TAREFA_KEYS, TIPO_TAREFA, TIPO_TAREFA_KEYS } from './constantes'
import { contextoPlaceholders } from './contexto'
import { MensagemPreview } from './mensagem-preview'
import { useSalvarTarefa, useTemplates, type TarefaInsert } from './queries'
import { VinculoPicker } from './vinculo-picker'

type Form = {
  titulo: string
  tipo: TarefaRow['tipo']
  status: TarefaRow['status']
  participante_id: string | null
  turma_id: string | null
  data_prevista: string
  horario: string
  canal: string
  objetivo: string
  mensagem: string
  para_quem: string
}

const VAZIO: Form = {
  titulo: '',
  tipo: 'mensagem_privada',
  status: 'a_fazer',
  participante_id: null,
  turma_id: null,
  data_prevista: '',
  horario: '',
  canal: '',
  objetivo: '',
  mensagem: '',
  para_quem: '',
}

export function TarefaForm({
  aberto,
  onAbertoChange,
  tarefa,
  inicial,
}: {
  aberto: boolean
  onAbertoChange: (aberto: boolean) => void
  tarefa?: TarefaRow
  inicial?: Partial<TarefaInsert>
}) {
  const salvar = useSalvarTarefa()
  const templates = useTemplates()
  const participantes = useParticipantes()
  const turmas = useTurmas()
  const plantoes = usePlantoes()
  const [form, setForm] = useState<Form>(VAZIO)

  useEffect(() => {
    if (!aberto) return
    const origem = tarefa ?? inicial ?? {}
    setForm({
      ...VAZIO,
      titulo: origem.titulo ?? '',
      tipo: origem.tipo ?? VAZIO.tipo,
      status: origem.status ?? VAZIO.status,
      participante_id: origem.participante_id ?? null,
      turma_id: origem.turma_id ?? null,
      data_prevista: origem.data_prevista ?? '',
      horario: origem.horario?.slice(0, 5) ?? '',
      canal: origem.canal ?? '',
      objetivo: origem.objetivo ?? '',
      mensagem: origem.mensagem ?? '',
      para_quem: origem.para_quem ?? '',
    })
  }, [aberto, tarefa, inicial])

  const contexto = useMemo(
    () =>
      contextoPlaceholders(form, {
        participantes: participantes.data ?? [],
        turmas: turmas.data ?? [],
        plantoes: plantoes.data ?? [],
      }),
    [form, participantes.data, turmas.data, plantoes.data],
  )

  function usarTemplate(id: string) {
    const t = templates.data?.templates.find((x) => x.id === id)
    if (!t) return
    setForm((f) => ({
      ...f,
      titulo: f.titulo || t.titulo,
      mensagem: preencherPlaceholders(t.conteudo, contexto),
    }))
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const semVinculo = !form.participante_id && !form.turma_id
    const dados: TarefaInsert = {
      titulo: form.titulo.trim(),
      tipo: form.tipo,
      status: form.status,
      participante_id: form.participante_id,
      turma_id: form.turma_id,
      data_prevista: form.data_prevista || null,
      horario: form.horario || null,
      canal: form.canal.trim() || null,
      objetivo: form.objetivo.trim() || null,
      mensagem: form.mensagem.trim() || null,
      para_quem: semVinculo ? form.para_quem.trim() || null : null,
    }
    const ok = await salvar.mutateAsync({ id: tarefa?.id, dados }).catch(() => null)
    if (ok) onAbertoChange(false)
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))
  const semVinculo = !form.participante_id && !form.turma_id
  const TipoIcone = TIPO_TAREFA[form.tipo].icone

  return (
    <Dialog
      aberto={aberto}
      onAbertoChange={onAbertoChange}
      titulo={tarefa ? 'Editar tarefa' : 'Nova tarefa'}
      descricao={tarefa ? undefined : 'Só o título é obrigatório. Escolha para quem é e o tipo para o sistema registrar tudo certo.'}
      largura="max-w-2xl"
    >
      <form onSubmit={enviar} className="space-y-3">
        <Campo label="Título *">
          <Input
            required
            autoFocus
            value={form.titulo}
            onChange={(e) => set('titulo', e.target.value)}
            placeholder="Ex.: Lembrete do plantão 2"
          />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <Campo
            label="Para quem"
            dica={
              form.turma_id
                ? 'Turma inteira. Mensagens privadas viram uma tarefa por participante.'
                : form.participante_id
                  ? undefined
                  : 'Busque um participante ou uma turma. Vazio = tarefa interna.'
            }
            ajuda="Vincular a um participante faz os envios e respostas contarem na pontuação dele."
          >
            <VinculoPicker
              valor={{ participante_id: form.participante_id, turma_id: form.turma_id }}
              onChange={(v) => setForm((f) => ({ ...f, ...v }))}
            />
          </Campo>
          <Campo label="Tipo" ajuda="Define os botões do card e o que é registrado na linha do tempo do participante.">
            <Select value={form.tipo} onValueChange={(v) => set('tipo', v as Form['tipo'])}>
              {TIPO_TAREFA_KEYS.map((k) => (
                <option key={k} value={k}>
                  {TIPO_TAREFA[k].label}
                </option>
              ))}
            </Select>
          </Campo>
        </div>
        {semVinculo && form.para_quem && (
          <Campo label="Para quem (texto livre, importado)">
            <Input value={form.para_quem} onChange={(e) => set('para_quem', e.target.value)} />
          </Campo>
        )}
        <p className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <TipoIcone className="mt-px size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span>
            <strong className="text-foreground">{TIPO_TAREFA[form.tipo].label}:</strong> {DICA_TIPO_TAREFA[form.tipo]}
          </span>
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          <Campo label="Data prevista" ajuda="Define quando a tarefa aparece em Hoje e a partir de quando fica atrasada.">
            <Input type="date" value={form.data_prevista} onChange={(e) => set('data_prevista', e.target.value)} />
          </Campo>
          <Campo label="Horário">
            <Input type="time" value={form.horario} onChange={(e) => set('horario', e.target.value)} />
          </Campo>
          <Campo label="Canal" ajuda="Onde o contato acontece. Escolha da lista ou digite outro.">
            <InputSugestoes
              value={form.canal}
              onValueChange={(v) => set('canal', v)}
              sugestoes={CANAIS}
              placeholder="WhatsApp privado"
            />
          </Campo>
          <Campo label="Status" ajuda={DICA_STATUS_TAREFA[form.status]}>
            <Select value={form.status} onValueChange={(v) => set('status', v as Form['status'])}>
              {STATUS_TAREFA_KEYS.map((k) => (
                <option key={k} value={k}>
                  {STATUS_TAREFA[k].label}
                </option>
              ))}
            </Select>
          </Campo>
        </div>
        {tarefa?.data && <p className="text-xs text-muted-foreground">Data original da planilha: {tarefa.data}</p>}
        <Campo label="Objetivo" ajuda="O que se espera com esta tarefa. Serve só para orientar quem for fazer.">
          <Input
            value={form.objetivo}
            onChange={(e) => set('objetivo', e.target.value)}
            placeholder="Ex.: Confirmar presença no plantão"
          />
        </Campo>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              Mensagem
              <InfoDica texto="Texto para copiar e colar no CRM. Comece por um template ou escreva do zero. [nome], [turma], [plantao_data] e [plantao_horario] são trocados pelos dados de quem recebe." />
            </span>
            <div className="flex items-center gap-2">
              <Select
                className="w-56 py-1 text-xs"
                value=""
                onValueChange={usarTemplate}
                aria-label="Usar template"
              >
                <option value="">Usar template…</option>
                {templates.data?.categorias.map((c) => (
                  <optgroup key={c.id} label={c.nome}>
                    {templates.data.templates
                      .filter((t) => t.category_id === c.id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.titulo}
                        </option>
                      ))}
                  </optgroup>
                ))}
                {templates.data?.templates
                  .filter((t) => !t.category_id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.titulo}
                    </option>
                  ))}
              </Select>
              <Button
                variante="fantasma"
                className="px-2 py-1 text-xs"
                title="Preencher [nome], [turma], [plantao_data] e [plantao_horario] com o vínculo atual"
                onClick={() => set('mensagem', preencherPlaceholders(form.mensagem, contexto))}
              >
                <Wand2 className="size-3.5" />
                Preencher
              </Button>
            </div>
          </div>
          <Textarea
            className="min-h-32"
            value={form.mensagem}
            onChange={(e) => set('mensagem', e.target.value)}
            placeholder="Oi [nome], tudo bem? …"
          />
          {form.turma_id && form.tipo === 'mensagem_privada' ? (
            <p className="text-xs text-muted-foreground">
              Tarefa de turma: mantenha [nome] no texto. Depois de salvar, use "Gerar para cada participante" no card.
            </p>
          ) : (
            <MensagemPreview texto={form.mensagem} />
          )}
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
