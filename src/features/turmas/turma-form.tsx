import { useEffect, useState, type FormEvent } from 'react'
import { Button, Campo, Dialog, Input, Select } from '@/components/ui'
import type { TurmaRow } from '@/lib/tipos'
import { DICA_TIPO_TURMA } from '@/lib/textos-dicas'
import { useSalvarTurma } from './queries'

const VAZIO = { nome: '', tipo: 'aberta' as TurmaRow['tipo'], data_imersao: '', link_grupo: '', ativa: true }

export function TurmaForm({
  aberto,
  onAbertoChange,
  turma,
  onSalva,
}: {
  aberto: boolean
  onAbertoChange: (aberto: boolean) => void
  turma?: TurmaRow
  onSalva?: (t: TurmaRow) => void
}) {
  const salvar = useSalvarTurma()
  const [form, setForm] = useState(VAZIO)

  useEffect(() => {
    if (!aberto) return
    setForm(
      turma
        ? {
            nome: turma.nome,
            tipo: turma.tipo,
            data_imersao: turma.data_imersao ?? '',
            link_grupo: turma.link_grupo ?? '',
            ativa: turma.ativa,
          }
        : VAZIO,
    )
  }, [aberto, turma])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const salva = await salvar
      .mutateAsync({
        id: turma?.id,
        dados: {
          nome: form.nome.trim(),
          tipo: form.tipo,
          data_imersao: form.data_imersao || null,
          link_grupo: form.link_grupo.trim() || null,
          ativa: form.ativa,
        },
      })
      .catch(() => null)
    if (salva) {
      onAbertoChange(false)
      onSalva?.(salva)
    }
  }

  return (
    <Dialog
      aberto={aberto}
      onAbertoChange={onAbertoChange}
      titulo={turma ? 'Editar turma' : 'Nova turma'}
      descricao={turma ? undefined : 'Depois de criar, agende os 4 plantões e vincule os participantes à turma.'}
    >
      <form onSubmit={enviar} className="space-y-3">
        <Campo label="Nome *" dica="Aparece como “Turma Outubro” nas telas e no [turma] dos templates.">
          <Input required autoFocus value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Outubro" />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Tipo" dica={DICA_TIPO_TURMA[form.tipo]}>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as TurmaRow['tipo'] })}>
              <option value="aberta">Aberta</option>
              <option value="in_company">In company</option>
            </Select>
          </Campo>
          <Campo label="Data da imersão" ajuda="Data do encontro presencial que deu origem à turma. Ordena a lista de turmas.">
            <Input type="date" value={form.data_imersao} onChange={(e) => setForm({ ...form, data_imersao: e.target.value })} />
          </Campo>
        </div>
        <Campo label="Link do grupo de WhatsApp" dica="Vira um atalho na página da turma.">
          <Input value={form.link_grupo} onChange={(e) => setForm({ ...form, link_grupo: e.target.value })} placeholder="https://chat.whatsapp.com/…" />
        </Campo>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={form.ativa}
            onChange={(e) => setForm({ ...form, ativa: e.target.checked })}
          />
          <span>
            Turma em período de suporte
            <span className="block text-xs text-muted-foreground">
              Desmarque quando o suporte terminar. A turma continua no histórico, como “Suporte encerrado”.
            </span>
          </span>
        </label>
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
