import { useEffect, useState, type FormEvent } from 'react'
import { Button, Campo, Dialog, Input, Textarea } from '@/components/ui'
import type { MarcoRow, TipoMarco } from '@/lib/tipos'
import { useExcluirMarco, useSalvarMarco } from './queries'

export const TITULO_NPS = 'Envio do NPS'

/** Agenda ou edita uma data da turma: o envio do NPS (título fixo) ou uma data livre. */
export function MarcoForm({
  aberto,
  onAbertoChange,
  turmaId,
  tipo,
  marco,
}: {
  aberto: boolean
  onAbertoChange: (aberto: boolean) => void
  turmaId: string
  tipo: TipoMarco
  marco?: MarcoRow
}) {
  const salvar = useSalvarMarco()
  const excluir = useExcluirMarco()
  const nps = tipo === 'nps'
  const [form, setForm] = useState({ titulo: '', data: '', horario: '', observacoes: '' })

  useEffect(() => {
    if (!aberto) return
    setForm({
      titulo: marco?.titulo ?? (nps ? TITULO_NPS : ''),
      data: marco?.data ?? '',
      horario: marco?.horario?.slice(0, 5) ?? '',
      observacoes: marco?.observacoes ?? '',
    })
  }, [aberto, marco, nps])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const ok = await salvar
      .mutateAsync({
        id: marco?.id,
        turma_id: turmaId,
        tipo,
        titulo: form.titulo.trim(),
        data: form.data || null,
        horario: form.horario || null,
        observacoes: form.observacoes.trim() || null,
      })
      .catch(() => null)
    if (ok) onAbertoChange(false)
  }

  async function remover() {
    if (!marco) return
    const ok = await excluir
      .mutateAsync(marco.id)
      .then(() => true)
      .catch(() => false)
    if (ok) onAbertoChange(false)
  }

  return (
    <Dialog
      aberto={aberto}
      onAbertoChange={onAbertoChange}
      titulo={nps ? TITULO_NPS : marco ? 'Editar evento' : 'Novo evento da turma'}
      descricao="Vale para a turma toda. Datas de hoje e amanhã aparecem na tela Hoje."
    >
      <form onSubmit={enviar} className="space-y-3">
        {!nps && (
          <Campo label="Título">
            <Input
              required
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ex.: Encerramento, envio dos certificados"
            />
          </Campo>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Data">
            <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
          </Campo>
          <Campo label="Horário">
            <Input type="time" value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} />
          </Campo>
        </div>
        <Campo label="Observações">
          <Textarea
            placeholder={nps ? 'Ex.: link do formulário, quem envia' : 'Ex.: o que fazer, quem conduz'}
            value={form.observacoes}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
          />
        </Campo>
        <div className="flex justify-end gap-2 pt-2">
          {marco && (
            <Button variante="fantasma" className="mr-auto text-rose-600" onClick={remover} disabled={excluir.isPending}>
              Excluir
            </Button>
          )}
          <Button variante="secundario" onClick={() => onAbertoChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={salvar.isPending || !form.titulo.trim()}>
            Salvar
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
