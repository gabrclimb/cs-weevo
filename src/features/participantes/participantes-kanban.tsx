import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { Building2, CalendarCheck, MessageCircleReply, Phone, Send, User, Users } from 'lucide-react'
import { Badge } from '@/components/ui'
import { SeletorAgrupar } from '@/components/agrupar-por'
import { Dica } from '@/components/dica'
import { Kanban } from '@/components/kanban'
import type { ParticipanteRow, TurmaRow } from '@/lib/database.types'
import { formatarTelefone } from '@/lib/telefone'
import { haQuanto } from '@/lib/utils'
import { AlertasBadges, PontuacaoBadge, type Engajamento } from '@/features/engajamento'
import { AGRUPAMENTOS, agrupar, type Agrupamento } from './agrupamentos'
import { DICA_COLUNA, DICA_STATUS_PARTICIPANTE, DICA_WEEVO_START } from '@/lib/textos-dicas'
import { StatusBadge, WeevoStartBadge } from './badges'
import { apelidoDistinto } from './constantes'
import { useAtualizarParticipante } from './queries'
import { useRepassar } from '@/features/pontuacao/repassar'

const AJUDA_MOVER: Record<Agrupamento, string> = {
  faixa: '',
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
    <SeletorAgrupar
      valor={valor}
      onChange={(a) => a && onChange(a)}
      opcoes={AGRUPAMENTOS}
      ocultar={ocultar}
    />
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
  const repassar = useRepassar()
  const grupos = useMemo(() => {
    const g = agrupar(agrupamento, participantes, turmas, (p) => porParticipante.get(p.id)?.pontuacao.total ?? 0)
    const dicas: Partial<Record<Agrupamento, Record<string, string>>> = {
      status: DICA_STATUS_PARTICIPANTE,
      weevo_start: DICA_WEEVO_START,
    }
    const dicasDoGrupo = dicas[agrupamento]
    return dicasDoGrupo ? { ...g, colunas: g.colunas.map((c) => ({ ...c, dica: dicasDoGrupo[c.chave] })) } : g
  }, [agrupamento, participantes, turmas, porParticipante])
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
      ajudaMover={
        grupos.mudancaPara
          ? `Arraste um card para outra coluna para mudar ${AJUDA_MOVER[agrupamento]}.`
          : 'A faixa vem da pontuação: para mudar de coluna, registre presenças, respostas ou interações.'
      }
      onMover={
        grupos.mudancaPara
          ? (p, destino) => {
              // Arrastar para "Repassado ao comercial" é um repasse: registra o evento próprio, como o botão Repassar.
              if (agrupamento === 'weevo_start' && destino === 'repassado_comercial') repassar.mutate([p])
              else atualizar.mutate({ atual: p, mudancas: grupos.mudancaPara!(destino) })
            }
          : undefined
      }
      renderCard={(p) => {
        const eng = porParticipante.get(p.id)
        // O campo pelo qual o quadro está agrupado já aparece no título da coluna.
        const mostrarDia = !!p.dia_escolhido && agrupamento !== 'dia_escolhido'
        const mostrarCadastro = !!p.cadastro_plataforma && agrupamento !== 'cadastro_plataforma'
        return (
          <article className="space-y-2 rounded-lg border bg-card p-3 text-sm shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  to="/cs/participantes/$id"
                  params={{ id: p.id }}
                  draggable={false}
                  className="font-medium text-foreground hover:text-primary hover:underline"
                >
                  {p.nome}
                </Link>
                {apelidoDistinto(p) && <span className="ml-1.5 text-xs text-muted-foreground">“{apelidoDistinto(p)}”</span>}
              </div>
              <PontuacaoBadge pontuacao={eng?.pontuacao} />
            </div>

            {(p.empresa || p.telefone) && (
              <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                {p.empresa && (
                  <Dica texto={DICA_COLUNA.empresa}>
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <Building2 className="size-3 shrink-0" />
                      <span className="truncate">{p.empresa}</span>
                    </span>
                  </Dica>
                )}
                {p.telefone && (
                  <Dica texto={DICA_COLUNA.telefone}>
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <Phone className="size-3 shrink-0" />
                      {formatarTelefone(p.telefone)}
                    </span>
                  </Dica>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {mostrarTurma && agrupamento !== 'turma' && p.turma_id && (
                <Dica texto={DICA_COLUNA.turma}>
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3" />
                    {nomeTurma.get(p.turma_id)}
                  </span>
                </Dica>
              )}
              {agrupamento !== 'responsavel' && p.responsavel && (
                <Dica texto={DICA_COLUNA.responsavel}>
                  <span className="inline-flex items-center gap-1">
                    <User className="size-3" />
                    {p.responsavel}
                  </span>
                </Dica>
              )}
              <Dica texto={DICA_COLUNA.presencas}>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <CalendarCheck className="size-3" />
                  {eng?.pontuacao.detalhe.presencas ?? 0}/4 plantões
                </span>
              </Dica>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <Dica texto={DICA_COLUNA.ultimoContato}>
                <span className="inline-flex items-center gap-1">
                  <Send className="size-3" />
                  Contato {haQuanto(p.ultimo_contato_em)}
                </span>
              </Dica>
              <Dica texto={DICA_COLUNA.ultimaResposta}>
                <span className="inline-flex items-center gap-1">
                  <MessageCircleReply className="size-3" />
                  Resposta {haQuanto(p.ultima_resposta_em)}
                </span>
              </Dica>
            </div>

            {(mostrarDia || mostrarCadastro || p.nps || p.sistema || p.dificuldades) && (
              <dl className="space-y-1 border-t pt-2 text-xs">
                {(mostrarDia || mostrarCadastro || p.nps) && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {mostrarDia && <CampoCard rotulo="Dia" valor={p.dia_escolhido!} dica={DICA_COLUNA.diaEscolhido} />}
                    {mostrarCadastro && (
                      <CampoCard rotulo="Cadastro" valor={p.cadastro_plataforma!} dica={DICA_COLUNA.cadastroPlataforma} />
                    )}
                    {p.nps && <CampoCard rotulo="NPS" valor={p.nps} dica={DICA_COLUNA.nps} />}
                  </div>
                )}
                {p.sistema && <CampoCard rotulo="Sistema" valor={p.sistema} dica={DICA_COLUNA.sistema} linhas />}
                {p.dificuldades && (
                  <CampoCard rotulo="Dificuldade" valor={p.dificuldades} dica={DICA_COLUNA.dificuldades} linhas />
                )}
              </dl>
            )}
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

/** Par rótulo/valor de uma informação do participante dentro do card. `linhas` limita o texto longo a 2 linhas. */
function CampoCard({ rotulo, valor, dica, linhas }: { rotulo: string; valor: string; dica: string; linhas?: boolean }) {
  return (
    <Dica texto={linhas ? <span className="whitespace-pre-wrap">{valor}</span> : dica} className="min-w-0">
      <div className="min-w-0">
        <dt className={linhas ? 'text-muted-foreground' : 'inline text-muted-foreground'}>{linhas ? rotulo : `${rotulo}: `}</dt>
        <dd className={linhas ? 'line-clamp-2 text-foreground' : 'inline text-foreground'}>{valor}</dd>
      </div>
    </Dica>
  )
}
