import { useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'
import { FileUp } from 'lucide-react'
import { Button, Dialog } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { mensagemErro } from '@/lib/utils'
import { previaImportTarefas, type PreviaImportTarefas } from './import'
import { useCriarTarefas } from './queries'

export function ImportTarefasDialog({
  aberto,
  onAbertoChange,
}: {
  aberto: boolean
  onAbertoChange: (aberto: boolean) => void
}) {
  const criar = useCriarTarefas()
  const [arquivo, setArquivo] = useState<string | null>(null)
  const [previa, setPrevia] = useState<PreviaImportTarefas | null>(null)
  const [lendo, setLendo] = useState(false)

  function fechar(a: boolean) {
    if (!a) {
      setArquivo(null)
      setPrevia(null)
    }
    onAbertoChange(a)
  }

  async function lerArquivo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLendo(true)
    try {
      const [conteudo, tarefas, participantes, turmas] = await Promise.all([
        file.text(),
        supabase.from('weevo_tarefas').select('import_key').not('import_key', 'is', null),
        supabase.from('weevo_participantes').select('id, nome, apelido'),
        supabase.from('weevo_turmas').select('id, nome'),
      ])
      for (const r of [tarefas, participantes, turmas]) if (r.error) throw r.error
      setArquivo(file.name)
      setPrevia(
        previaImportTarefas(conteudo, {
          chavesExistentes: (tarefas.data ?? []).flatMap((t) => (t.import_key ? [t.import_key] : [])),
          participantes: participantes.data ?? [],
          turmas: turmas.data ?? [],
        }),
      )
    } catch (erro) {
      toast.error(mensagemErro(erro as { message?: string }))
    } finally {
      setLendo(false)
      e.target.value = ''
    }
  }

  async function importar() {
    if (!previa) return
    const ok = await criar
      .mutateAsync(previa.novas.map(({ linha: _linha, ...t }) => t))
      .catch(() => null)
    if (ok !== null) {
      toast.success(`${previa.novas.length} tarefa(s) importada(s).`)
      fechar(false)
    }
  }

  return (
    <Dialog
      aberto={aberto}
      onAbertoChange={fechar}
      titulo="Importar tarefas"
      descricao="CSV da planilha de planejamento (carga inicial). Colunas: Tarefa, Para quem, Data, Horário, Canal, Objetivo, Mensagem, Status, Tipo."
      largura="max-w-2xl"
    >
      <div className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-input px-4 py-6 text-sm text-muted-foreground hover:border-primary">
          <FileUp className="size-6 text-primary" />
          {arquivo ? <span className="font-medium">{arquivo}</span> : <span>Escolher arquivo .csv</span>}
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={lerArquivo} disabled={lendo} />
        </label>

        {previa && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Contador label="Linhas" valor={previa.total} />
              <Contador label="Novas" valor={previa.novas.length} />
              <Contador label="Já importadas" valor={previa.duplicadas} />
              <Contador label="Inválidas" valor={previa.invalidas.length} />
            </div>
            <p className="text-muted-foreground">
              Das novas: <strong>{previa.vinculadasParticipante}</strong> vinculadas a participante,{' '}
              <strong>{previa.vinculadasTurma}</strong> a turma e <strong>{previa.semVinculo}</strong> sem vínculo
              (ficam com "para quem" em texto).
            </p>
            {previa.invalidas.length > 0 && (
              <ul className="rounded-lg border bg-rose-50 p-3 text-rose-800">
                {previa.invalidas.map((i) => (
                  <li key={i.linha}>
                    Linha {i.linha}: {i.motivo}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variante="secundario" onClick={() => fechar(false)}>
            Cancelar
          </Button>
          <Button onClick={importar} disabled={!previa?.novas.length || criar.isPending}>
            Importar {previa?.novas.length ?? 0}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

function Contador({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="rounded-lg border bg-muted/50 px-3 py-2">
      <div className="text-xl font-semibold">{valor}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}
