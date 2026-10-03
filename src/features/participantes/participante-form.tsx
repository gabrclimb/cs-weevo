import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button, Campo, Dialog, Input, InputSugestoes, Select, Textarea } from '@/components/ui'
import type { ParticipanteRow } from '@/lib/database.types'
import { formatarTelefone, normalizarTelefone } from '@/lib/telefone'
import { primeiroNome } from './constantes'
import { useAtualizarParticipante, useCriarParticipante, useParticipantes, useTurmas } from './queries'

type Props = {
  aberto: boolean
  onAbertoChange: (aberto: boolean) => void
  /** Sem participante = cadastro; com participante = edição. */
  participante?: ParticipanteRow
  onSalvo?: (p: ParticipanteRow) => void
}

/** Campos de acompanhamento (vindos da planilha de controle do suporte). */
export const CAMPOS_ACOMPANHAMENTO = [
  ['responsavel', 'Responsável', false],
  ['dia_escolhido', 'Dia escolhido', false],
  ['cadastro_plataforma', 'Cadastro na plataforma', false],
  ['nps', 'Respondeu NPS', false],
  ['sistema', 'Sistema que está fazendo', true],
  ['dificuldades', 'Maiores dificuldades', true],
  ['suporte_extra', 'Suporte extra', true],
] as const

type CampoAcomp = (typeof CAMPOS_ACOMPANHAMENTO)[number][0]

const AJUDA_ACOMPANHAMENTO: Record<CampoAcomp, { placeholder: string; ajuda?: string; dica?: string }> = {
  responsavel: {
    placeholder: 'Ex.: Ana',
    dica: 'Escolha da lista ou digite um nome novo.',
    ajuda: 'Pessoa da equipe que acompanha o participante. Escreva sempre do mesmo jeito para filtrar e agrupar o kanban.',
  },
  dia_escolhido: { placeholder: 'Ex.: Quinta', ajuda: 'Dia que o participante escolheu para os encontros. O kanban pode ser agrupado por ele.' },
  cadastro_plataforma: { placeholder: 'Ex.: Feito', ajuda: 'Situação do cadastro na plataforma. O kanban pode ser agrupado por ele.' },
  nps: { placeholder: 'Ex.: Sim, nota 9' },
  sistema: { placeholder: 'O que ele está construindo' },
  dificuldades: { placeholder: 'Onde está travando' },
  suporte_extra: { placeholder: 'Ajuda dada além dos plantões' },
}

const VAZIO = {
  nome: '',
  apelido: '',
  telefone: '',
  empresa: '',
  turma_id: '',
  observacoes: '',
  responsavel: '',
  dia_escolhido: '',
  cadastro_plataforma: '',
  nps: '',
  sistema: '',
  dificuldades: '',
  suporte_extra: '',
}

export function ParticipanteForm({ aberto, onAbertoChange, participante, onSalvo }: Props) {
  const turmas = useTurmas()
  const participantes = useParticipantes()
  const responsaveis = [...new Set((participantes.data ?? []).flatMap((p) => (p.responsavel ? [p.responsavel] : [])))].sort()
  const criar = useCriarParticipante()
  const atualizar = useAtualizarParticipante()
  const [form, setForm] = useState(VAZIO)
  // O apelido acompanha o primeiro nome até alguém escrever outro apelido.
  const [apelidoManual, setApelidoManual] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setApelidoManual(
      !!participante?.apelido && participante.apelido.toLowerCase() !== primeiroNome(participante.nome).toLowerCase(),
    )
    setForm(
      participante
        ? {
            nome: participante.nome,
            apelido: participante.apelido || primeiroNome(participante.nome),
            telefone: formatarTelefone(participante.telefone),
            empresa: participante.empresa ?? '',
            turma_id: participante.turma_id ?? '',
            observacoes: participante.observacoes ?? '',
            ...(Object.fromEntries(
              CAMPOS_ACOMPANHAMENTO.map(([k]) => [k, participante[k] ?? '']),
            ) as Record<CampoAcomp, string>),
          }
        : VAZIO,
    )
  }, [aberto, participante])

  const set = (campo: keyof typeof VAZIO) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [campo]: e.target.value }))

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const telefone = form.telefone.trim() ? normalizarTelefone(form.telefone) : null
    if (form.telefone.trim() && !telefone) {
      toast.error('Telefone inválido. Use DDD + número, por exemplo (11) 98765-4321.')
      return
    }
    const dados = {
      nome: form.nome.trim(),
      apelido: form.apelido.trim() || primeiroNome(form.nome) || null,
      telefone,
      empresa: form.empresa.trim() || null,
      turma_id: form.turma_id || null,
      observacoes: form.observacoes.trim() || null,
      ...(Object.fromEntries(
        CAMPOS_ACOMPANHAMENTO.map(([k]) => [k, form[k].trim() || null]),
      ) as Record<CampoAcomp, string | null>),
    }
    const salvo = participante
      ? await atualizar.mutateAsync({ atual: participante, mudancas: dados }).catch(() => null)
      : await criar.mutateAsync(dados).catch(() => null)
    if (salvo) {
      onAbertoChange(false)
      onSalvo?.(salvo)
    }
  }

  const salvando = criar.isPending || atualizar.isPending
  const telefoneInvalido = form.telefone.replace(/\D/g, '').length >= 10 && !normalizarTelefone(form.telefone)

  return (
    <Dialog
      aberto={aberto}
      onAbertoChange={onAbertoChange}
      titulo={participante ? 'Editar participante' : 'Novo participante'}
      descricao={participante ? undefined : 'Só o nome é obrigatório. O resto pode ser preenchido depois, pela ficha.'}
      largura="max-w-2xl"
    >
      <form onSubmit={salvar} className="space-y-3">
        <Campo label="Nome *">
          <Input
            required
            value={form.nome}
            onChange={(e) => {
              const nome = e.target.value
              setForm((f) => ({ ...f, nome, ...(apelidoManual ? {} : { apelido: primeiroNome(nome) }) }))
            }}
            autoFocus
            placeholder="Nome completo"
          />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            label="Apelido"
            dica="Já vem com o primeiro nome. Mude se ele prefere outro."
            ajuda="Vai no lugar de [nome] nas mensagens dos templates."
          >
            <Input
              value={form.apelido}
              onChange={(e) => {
                setApelidoManual(true)
                set('apelido')(e)
              }}
              placeholder="Ex.: Zé"
            />
          </Campo>
          <Campo
            label="Telefone"
            dica={
              telefoneInvalido ? (
                <span className="text-destructive">Telefone inválido. Use DDD + número.</span>
              ) : (
                'Com DDD. Cada telefone só pode estar em um participante.'
              )
            }
            ajuda="Usado para achar o participante na busca e para reconhecê-lo ao importar planilhas."
          >
            <Input
              value={form.telefone}
              onChange={set('telefone')}
              placeholder="(11) 98765-4321"
              inputMode="tel"
              aria-invalid={telefoneInvalido || undefined}
            />
          </Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Empresa">
            <Input value={form.empresa} onChange={set('empresa')} placeholder="Onde trabalha" />
          </Campo>
          <Campo
            label="Turma"
            dica={turmas.data?.length === 0 ? 'Nenhuma turma cadastrada ainda. Crie em Turmas.' : undefined}
            ajuda="Liga o participante aos plantões da turma (presença soma pontos) e às tarefas enviadas para a turma toda."
          >
            <Select value={form.turma_id} onValueChange={(v) => setForm((f) => ({ ...f, turma_id: v }))}>
              <option value="">Sem turma</option>
              {turmas.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </Select>
          </Campo>
        </div>
        <fieldset className="space-y-3 rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium text-foreground">Acompanhamento</legend>
          <p className="-mt-1 text-xs text-muted-foreground">
            Campos da planilha de controle do suporte. Todos opcionais e nenhum altera a pontuação.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {CAMPOS_ACOMPANHAMENTO.filter(([, , longo]) => !longo).map(([k, label]) => (
              <Campo key={k} label={label} dica={AJUDA_ACOMPANHAMENTO[k].dica} ajuda={AJUDA_ACOMPANHAMENTO[k].ajuda}>
                {k === 'responsavel' ? (
                  <InputSugestoes
                    value={form[k]}
                    onValueChange={(v) => setForm((f) => ({ ...f, [k]: v }))}
                    sugestoes={responsaveis}
                    placeholder={AJUDA_ACOMPANHAMENTO[k].placeholder}
                  />
                ) : (
                  <Input value={form[k]} onChange={set(k)} placeholder={AJUDA_ACOMPANHAMENTO[k].placeholder} />
                )}
              </Campo>
            ))}
          </div>
          {CAMPOS_ACOMPANHAMENTO.filter(([, , longo]) => longo).map(([k, label]) => (
            <Campo key={k} label={label}>
              <Textarea className="min-h-14" value={form[k]} onChange={set(k)} placeholder={AJUDA_ACOMPANHAMENTO[k].placeholder} />
            </Campo>
          ))}
        </fieldset>
        <Campo label="Observações" ajuda="Aparece em destaque na ficha. Para registrar algo com data, use uma Nota na linha do tempo.">
          <Textarea value={form.observacoes} onChange={set('observacoes')} placeholder="Algo que a equipe precisa saber sobre ele" />
        </Campo>
        <div className="flex items-center justify-end gap-2 pt-2">
          <span className="mr-auto text-xs text-muted-foreground">* obrigatório</span>
          <Button variante="secundario" onClick={() => onAbertoChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
