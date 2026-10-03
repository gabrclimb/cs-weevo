import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { MessageCircleReply, User } from 'lucide-react'
import { Badge, Select } from '@/components/ui'
import { Dica } from '@/components/dica'
import { Kanban } from '@/components/kanban'
import type { ParticipanteRow, TurmaRow } from '@/lib/database.types'
import { haQuanto } from '@/lib/utils'
import { AlertasBadges, PontuacaoBadge, type Engajamento } from '@/features/engajamento'
import { AGRUPAMENTOS, AGRUPAMENTO_KEYS, agrupar, type Agrupamento } from './agrupamentos'
import { DICA_COLUNA, DICA_STATUS_PARTICIPANTE, DICA_WEEVO_START } from '@/lib/textos-dicas'
import { StatusBadge, WeevoStartBadge } from './badges'
import { useAtualizarParticipante } from './queries'

const AJUDA_MOVER: Record<Agrupamento, string> = {
  status: 'o status (fica registrado na linha do tempo)',
  weevo_start: 'a Weevo Start (fica registrado na linha do tempo)',
  responsavel: 'o responsável',
  turma: 'a turma',
  dia_escolhido: 'o dia escolhido',
  cadastro_plataforma: 'o cadastro na plataforma',
}

/** Seletor "Agrupar por" do kanban de participantes. */
export function AgruparPor({
  valor,
  onChange,
  ocultar = [],
}: {
  valor: Agrupamento
  onChange: (a: Agrupamento) => void
  ocultar?: Agrupamento[]
}) {
  return (
    <Select className="w-56" value={valor} onValueChange={(v) => onChange(v as Agrupamento)} aria-label="Agrupar por">
      {AGRUPAMENTO_KEYS.filter((k) => !ocultar.includes(k)).map((k) => (
        <option key={k} value={k}>
          Agrupar por: {AGRUPAMENTOS[k]}
        </option>
      ))}
    </Select>
  )
}

/**
 * Participantes em colunas. Arrastar muda o campo agrupado;
 * Status e Weevo Start continuam gerando evento na linha do tempo.
 */
export function ParticipantesKanban({
  participantes,
  turmas,
  agrupamento,
  porParticipante,
  mostrarTurma = true,
  carregando,
}: {
  participantes: ParticipanteRow[]
  turmas: TurmaRow[]
  agrupamento: Agrupamento
  porParticipante: Map<string, Engajamento>
  mostrarTurma?: boolean
  carregando?: boolean
}) {
  const atualizar = useAtualizarParticipante()
  const grupos = useMemo(() => {
    const g = agrupar(agrupamento, participantes, turmas)
    const dicas: Partial<Record<Agrupamento, Record<string, string>>> = {
      status: DICA_STATUS_PARTICIPANTE,
      weevo_start: DICA_WEEVO_START,
    }
    const dicasDoGrupo = dicas[agrupamento]
    return dicasDoGrupo ? { ...g, colunas: g.colunas.map((c) => ({ ...c, dica: dicasDoGrupo[c.chave] })) } : g
  }, [agrupamento, participantes, turmas])
  const nomeTurma = useMemo(() => new Map(turmas.map((t) => [t.id, t.nome])), [turmas])

  // Dentro da coluna, quem tem mais pontuação vem primeiro.
  const ordenados = useMemo(
    () =>
      [...participantes].sort(
        (a, b) => (porParticipante.get(b.id)?.pontuacao.total ?? 0) - (porParticipante.get(a.id)?.pontuacao.total ?? 0),
      ),
    [participantes, porParticipante],
  )

  return (
    <Kanban
      colunas={grupos.colunas}
      itens={ordenados}
      colunaDe={grupos.colunaDe}
      chaveDe={(p) => p.id}
      carregando={carregando}
      vazio="Nenhum participante"
      ajudaMover={`Arraste um card para outra coluna para mudar ${AJUDA_MOVER[agrupamento]}.`}
      onMover={(p, destino) => atualizar.mutate({ atual: p, mudancas: grupos.mudancaPara(destino) })}
      renderCard={(p) => {
        const eng = porParticipante.get(p.id)
        return (
          <article className="space-y-2 rounded-lg border bg-card p-3 text-sm shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <Link
                to="/participantes/$id"
                params={{ id: p.id }}
                draggable={false}
                className="font-medium text-foreground hover:text-primary hover:underline"
              >
                {p.nome}
              </Link>
              <PontuacaoBadge pontuacao={eng?.pontuacao} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {mostrarTurma && agrupamento !== 'turma' && p.turma_id && <span>{nomeTurma.get(p.turma_id)}</span>}
              {agrupamento !== 'responsavel' && p.responsavel && (
                <span className="inline-flex items-center gap-1">
                  <User className="size-3" />
                  {p.responsavel}
                </span>
              )}
              <Dica texto={DICA_COLUNA.ultimaResposta}>
                <span className="inline-flex items-center gap-1">
                  <MessageCircleReply className="size-3" />
                  {haQuanto(p.ultima_resposta_em)}
                </span>
              </Dica>
            </div>
            <div className="flex flex-wrap gap-1">
              {agrupamento !== 'status' && (
                <StatusBadge status={p.status} />
              )}
              {agrupamento !== 'weevo_start' && p.weevo_start !== 'nao_avaliado' && (
                <WeevoStartBadge valor={p.weevo_start} />
              )}
              {p.implementou && (
                <Dica texto={DICA_COLUNA.implementou}>
                  <Badge className="bg-emerald-100 text-emerald-800">Implementou</Badge>
                </Dica>
              )}
            </div>
            <AlertasBadges alertas={eng?.alertas ?? []} />
          </article>
        )
      }}
    />
  )
}
