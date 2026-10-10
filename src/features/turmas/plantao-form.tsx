import { useEffect, useState, type FormEvent } from 'react'
import { Button, Campo, Dialog, Input, Select, Textarea } from '@/components/ui'
import type { PlantaoRow } from '@/lib/tipos'
import { DICA_FORMATO_PLANTAO } from '@/lib/textos-dicas'
import { useSalvarPlantao } from './queries'

export function PlantaoForm({
  aberto,
  onAbertoChange,
  turmaId,
  numero,
  plantao,
}: {
  aberto: boolean
  onAbertoChange: (aberto: boolean) => void
  turmaId: string
  numero: number
  plantao?: PlantaoRow
}) {
  const salvar = useSalvarPlantao()
  const [form, setForm] = useState({ data: '', horario: '', formato: 'online' as PlantaoRow['formato'], link: '', observacoes: '' })

  useEffect(() => {
    if (!aberto) return
    setForm({
      data: plantao?.data ?? '',
      horario: plantao?.horario?.slice(0, 5) ?? '',
      formato: plantao?.formato ?? 'online',
      link: plantao?.link ?? '',
      observacoes: plantao?.observacoes ?? '',
    })
  }, [aberto, plantao])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const ok = await salvar
      .mutateAsync({
        turma_id: turmaId,
        numero,
        data: form.data || null,
        horario: form.horario || null,
        formato: form.formato,
        link: form.formato === 'online' ? form.link.trim() || null : null,
        observacoes: form.observacoes.trim() || null,
      })
      .catch(() => null)
    if (ok) onAbertoChange(false)
  }

  return (
    <Dialog
      aberto={aberto}
      onAbertoChange={onAbertoChange}
      titulo={`Plantão ${numero}`}
      descricao="A data e o horário entram no [plantao_data] e no [plantao_horario] das mensagens. Depois do plantão, marque a presença."
    >
      <form onSubmit={enviar} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo label="Data" ajuda="Plantões de hoje e amanhã aparecem na tela Hoje.">
            <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
          </Campo>
          <Campo label="Horário">
            <Input type="time" value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} />
          </Campo>
          <Campo label="Formato" ajuda={DICA_FORMATO_PLANTAO[form.formato]}>
            <Select value={form.formato} onValueChange={(v) => setForm({ ...form, formato: v as PlantaoRow['formato'] })}>
              <option value="online">Online</option>
              <option value="presencial">Presencial</option>
            </Select>
          </Campo>
        </div>
        {form.formato === 'online' && (
          <Campo label="Link do Meet">
            <Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://meet.google.com/…" />
          </Campo>
        )}
        <Campo label="Observações">
          <Textarea placeholder="Ex.: pauta, local, quem conduz" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
        </Campo>
        <div className="flex justify-end gap-2 pt-2">
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
