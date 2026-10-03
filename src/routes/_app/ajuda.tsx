import type { ReactNode } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, CalendarCheck, Clock, Info, MessageCircleReply, MessagesSquare, Rocket } from 'lucide-react'
import { ALERTAS, FAIXAS_PONTUACAO, PESOS } from '@/lib/config'
import { calcularPontuacao } from '@/lib/pontuacao'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/ajuda')({
  component: AjudaPage,
})

// Exemplo calculado pela mesma função usada no sistema, para a página nunca divergir da regra.
const AGORA = new Date('2026-10-20T12:00:00')
const dia = (d: number, h = 10) => new Date(2026, 9, d, h).toISOString()
const EXEMPLO = calcularPontuacao(
  { implementou: true },
  [
    { tipo: 'plantao_presenca', ocorrido_em: dia(1) },
    { tipo: 'plantao_presenca', ocorrido_em: dia(8) },
    { tipo: 'mensagem_enviada', ocorrido_em: dia(2) },
    { tipo: 'resposta_recebida', ocorrido_em: dia(3) },
    { tipo: 'mensagem_enviada', ocorrido_em: dia(9) },
    { tipo: 'mensagem_enviada', ocorrido_em: dia(16) },
    { tipo: 'resposta_recebida', ocorrido_em: dia(17) },
    { tipo: 'interacao_grupo', ocorrido_em: dia(10) },
  ],
  AGORA,
)

const MAXIMO =
  PESOS.implementou + PESOS.tetoPlantoes + PESOS.responsividadeMax + PESOS.recencia7Dias + PESOS.tetoGrupo

function AjudaPage() {
  const presencasParaTeto = Math.ceil(PESOS.tetoPlantoes / PESOS.porPresenca)
  const interacoesParaTeto = Math.ceil(PESOS.tetoGrupo / PESOS.porInteracaoGrupo)

  return (
    <article className="mx-auto max-w-3xl space-y-10 pb-16">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Como funciona a pontuação</h1>
        <p className="text-muted-foreground">
          Cada participante tem uma pontuação de engajamento de <strong className="text-foreground">0 a {MAXIMO}</strong>.
          Ela serve para montar o ranking de quem está mais engajado e mais propenso a assinar a Weevo Start, para
          repassar ao comercial.
        </p>
        <p className="text-muted-foreground">
          Ninguém digita a pontuação: ela é calculada sozinha a partir do que fica registrado na{' '}
          <strong className="text-foreground">linha do tempo</strong> de cada participante (envios, respostas,
          presenças, interações). Registrou algo, a pontuação muda na hora. Excluiu um registro da linha do tempo, ela
          volta.
        </p>
      </header>

      <Dica>
        Em todo o sistema, títulos com <span className="underline decoration-dotted underline-offset-4">sublinhado pontilhado</span>,
        selos e ícones <strong>?</strong> mostram uma explicação ao passar o mouse. Para esconder ou mostrar essas dicas,
        use o botão de lâmpada no fim do menu lateral.
      </Dica>

      <Aviso>
        Os pesos abaixo são um ponto de partida, sem estudo por trás. A ideia é revisá-los depois que os primeiros
        participantes assinarem ou recusarem, comparando a pontuação de quem assinou com a de quem não assinou.
      </Aviso>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Resumo</h2>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">Componente</th>
                <th className="px-4 py-2.5 font-medium">Regra</th>
                <th className="px-4 py-2.5 text-right font-medium">Máximo</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <Linha nome="Implementou" regra={`${PESOS.implementou} pontos se implementou, 0 se não`} max={PESOS.implementou} />
              <Linha nome="Plantões" regra={`${PESOS.porPresenca} pontos por presença`} max={PESOS.tetoPlantoes} />
              <Linha
                nome="Responsividade"
                regra={`% das mensagens respondidas em até ${PESOS.janelaRespostaHoras}h`}
                max={PESOS.responsividadeMax}
              />
              <Linha nome="Recência" regra="Quão recente foi a última resposta" max={PESOS.recencia7Dias} />
              <Linha nome="Grupo" regra={`${PESOS.porInteracaoGrupo} pontos por interação no grupo`} max={PESOS.tetoGrupo} />
              <tr className="bg-muted/30 font-semibold">
                <td className="px-4 py-2.5">Total</td>
                <td className="px-4 py-2.5" />
                <td className="px-4 py-2.5 text-right tabular-nums">{MAXIMO}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted-foreground">
          Em qualquer lugar onde a pontuação aparece, passe o mouse sobre ela para ver quanto cada componente somou.
        </p>
      </section>

      <section className="space-y-6">
        <h2 className="text-lg font-semibold">Cada regra em detalhe</h2>

        <Regra icone={Rocket} titulo="Implementou" pontos={`0 ou ${PESOS.implementou}`}>
          <p>
            Vale <strong>{PESOS.implementou} pontos</strong>, o maior peso, porque quem já colocou algo em uso é quem
            mais tende a continuar. Não existe meio-termo: ou implementou, ou não.
          </p>
          <ComoRegistrar>
            <li>
              Na ficha do participante, botão <strong>Implementou</strong>, descrevendo a evidência.
            </li>
            <li>
              Ou ao registrar uma resposta com a categoria <strong>"Mandou evidência de implementação"</strong>: o
              sistema pergunta se deve marcar como implementou.
            </li>
          </ComoRegistrar>
          <p className="text-muted-foreground">
            Para desfazer, exclua o registro "Implementou" na linha do tempo.
          </p>
        </Regra>

        <Regra icone={CalendarCheck} titulo="Plantões" pontos={`0 a ${PESOS.tetoPlantoes}`}>
          <p>
            <strong>{PESOS.porPresenca} pontos por presença</strong> em plantão, com teto de{' '}
            <strong>{PESOS.tetoPlantoes}</strong>. Com {presencasParaTeto} presenças o participante já atinge o teto (
            {presencasParaTeto} × {PESOS.porPresenca} = {presencasParaTeto * PESOS.porPresenca}, limitado a{' '}
            {PESOS.tetoPlantoes}).
          </p>
          <Tabela
            cabecalho={['Presenças', 'Pontos']}
            linhas={[0, 1, 2, 3, 4].map((n) => [String(n), String(Math.min(n * PESOS.porPresenca, PESOS.tetoPlantoes))])}
          />
          <ComoRegistrar>
            <li>
              Em <strong>Turmas → turma → Presença</strong> do plantão, marcando quem veio.
            </li>
            <li>
              No import de participantes, as colunas de encontro com <strong>"Veio"</strong> viram presença. "Não veio",
              "Não respondeu" e "Confirmou e não veio" não contam.
            </li>
          </ComoRegistrar>
          <p className="text-muted-foreground">Faltar não tira pontos; só deixa de somar.</p>
        </Regra>

        <Regra icone={MessageCircleReply} titulo="Responsividade" pontos={`0 a ${PESOS.responsividadeMax}`}>
          <p>
            Mede se o participante costuma responder quando recebe mensagem. É a porcentagem das mensagens enviadas a ele
            que tiveram resposta em até <strong>{PESOS.janelaRespostaHoras} horas</strong>, multiplicada por{' '}
            {PESOS.responsividadeMax} e arredondada.
          </p>
          <Formula>
            pontos = (mensagens respondidas em até {PESOS.janelaRespostaHoras}h ÷ mensagens enviadas) ×{' '}
            {PESOS.responsividadeMax}
          </Formula>
          <Tabela
            cabecalho={['Enviadas', 'Respondidas a tempo', 'Pontos']}
            linhas={[
              [1, 1],
              [2, 1],
              [3, 2],
              [4, 1],
              [3, 0],
            ].map(([env, resp]) => [String(env), String(resp), String(Math.round((resp / env) * PESOS.responsividadeMax))])}
          />
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Conta como <strong>mensagem enviada</strong> quando você clica em <strong>"Enviei"</strong> ou{' '}
              <strong>"Enviei e concluí"</strong> numa tarefa de mensagem privada do participante.
            </li>
            <li>
              Conta como <strong>resposta</strong> quando você clica em <strong>"Respondeu"</strong> (no card da tarefa
              ou em "Registrar resposta" na ficha).
            </li>
            <li>
              Uma mensagem conta como respondida se houver qualquer resposta registrada nas {PESOS.janelaRespostaHoras}h
              seguintes a ela. Uma única resposta pode cobrir duas mensagens enviadas em sequência.
            </li>
            <li>Sem nenhuma mensagem enviada, este componente fica em 0.</li>
            <li>
              Ligações, conteúdos enviados no grupo da turma e notas <strong>não</strong> entram nesta conta.
            </li>
          </ul>
          <Dica>
            Registre o envio e a resposta com a data em que aconteceram. Se marcar "Respondeu" dias depois da resposta
            real, a resposta pode cair fora das {PESOS.janelaRespostaHoras}h e o participante perde pontos que mereceria.
          </Dica>
        </Regra>

        <Regra icone={Clock} titulo="Recência" pontos={`0, ${PESOS.recencia14Dias} ou ${PESOS.recencia7Dias}`}>
          <p>Valoriza quem respondeu recentemente. Olha só a data da última resposta registrada:</p>
          <Tabela
            cabecalho={['Última resposta', 'Pontos']}
            linhas={[
              ['Até 7 dias atrás', String(PESOS.recencia7Dias)],
              ['De 8 a 14 dias atrás', String(PESOS.recencia14Dias)],
              ['Há mais de 14 dias', '0'],
              ['Nunca respondeu', '0'],
            ]}
          />
          <p className="text-muted-foreground">
            Contam só dias completos. Esta é a única parte da pontuação que cai sozinha com o tempo: um participante que
            para de responder perde estes pontos mesmo sem ninguém registrar nada.
          </p>
        </Regra>

        <Regra icone={MessagesSquare} titulo="Grupo" pontos={`0 a ${PESOS.tetoGrupo}`}>
          <p>
            <strong>{PESOS.porInteracaoGrupo} pontos por interação</strong> no grupo da turma, com teto de{' '}
            <strong>{PESOS.tetoGrupo}</strong> (atingido com {interacoesParaTeto} interações).
          </p>
          <ComoRegistrar>
            <li>
              Na ficha do participante, botão <strong>Interação no grupo</strong>. Ex.: tirou dúvida no grupo, compartilhou
              o que construiu, comentou um conteúdo.
            </li>
          </ComoRegistrar>
          <p className="text-muted-foreground">
            Concluir uma tarefa de conteúdo no grupo (da turma) não dá pontos a ninguém: só conta a interação registrada
            na ficha de cada participante.
          </p>
        </Regra>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Exemplo completo</h2>
        <p className="text-muted-foreground">Participante fictício, olhando a pontuação no dia 20/10:</p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Implementou: sim.</li>
          <li>Veio a 2 plantões.</li>
          <li>
            Recebeu 3 mensagens (02/10, 09/10 e 16/10). Respondeu a primeira no dia seguinte, não respondeu a segunda e
            respondeu a terceira no dia seguinte (17/10).
          </li>
          <li>Interagiu 1 vez no grupo.</li>
        </ul>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <tbody className="divide-y">
              <LinhaExemplo nome="Implementou" calculo="sim" pontos={EXEMPLO.implementou} />
              <LinhaExemplo
                nome="Plantões"
                calculo={`${EXEMPLO.detalhe.presencas} × ${PESOS.porPresenca}`}
                pontos={EXEMPLO.plantoes}
              />
              <LinhaExemplo
                nome="Responsividade"
                calculo={`${EXEMPLO.detalhe.enviosRespondidos} de ${EXEMPLO.detalhe.envios} respondidas → ${EXEMPLO.detalhe.enviosRespondidos}/${EXEMPLO.detalhe.envios} × ${PESOS.responsividadeMax}`}
                pontos={EXEMPLO.responsividade}
              />
              <LinhaExemplo
                nome="Recência"
                calculo={`última resposta há ${EXEMPLO.detalhe.diasDesdeResposta} dias`}
                pontos={EXEMPLO.recencia}
              />
              <LinhaExemplo
                nome="Grupo"
                calculo={`${EXEMPLO.detalhe.interacoesGrupo} × ${PESOS.porInteracaoGrupo}`}
                pontos={EXEMPLO.grupo}
              />
              <tr className="bg-muted/30 font-semibold">
                <td className="px-4 py-2.5">Total</td>
                <td className="px-4 py-2.5" />
                <td className="px-4 py-2.5 text-right tabular-nums">{EXEMPLO.total}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Cores da pontuação</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <Faixa classe="bg-emerald-100 text-emerald-800" texto={`${FAIXAS_PONTUACAO.alta} ou mais`} descricao="engajamento alto" />
          <Faixa
            classe="bg-amber-100 text-amber-800"
            texto={`${FAIXAS_PONTUACAO.media} a ${FAIXAS_PONTUACAO.alta - 1}`}
            descricao="engajamento médio"
          />
          <Faixa classe="bg-muted text-muted-foreground" texto={`abaixo de ${FAIXAS_PONTUACAO.media}`} descricao="engajamento baixo" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Quem aparece em Engajamento</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>A página Engajamento ordena pela pontuação, do maior para o menor. Em empate, vem antes quem respondeu mais recentemente.</li>
          <li>
            Por padrão ficam de fora: participantes com status <strong>Inativo</strong> e quem já está como{' '}
            <strong>Assinante</strong> ou <strong>Recusou</strong> na Weevo Start. Marque "Incluir inativos, assinantes e
            quem recusou" para ver todos.
          </li>
          <li>
            <strong>Repassar ao comercial</strong> muda a Weevo Start para "Repassado ao comercial" e registra o repasse na
            linha do tempo. Isso não altera a pontuação.
          </li>
          <li>Status, Weevo Start, notas e mudanças de responsável não somam nem tiram pontos.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Alertas</h2>
        <p className="text-sm text-muted-foreground">
          Os alertas não mexem na pontuação. Eles indicam quem precisa de atenção e aparecem na tela Hoje, na lista de
          participantes e na ficha.
        </p>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">Alerta</th>
                <th className="px-4 py-2.5 font-medium">Quando aparece</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <LinhaAlerta
                nome="Aguardando resposta"
                regra={`Tarefa em "Aguardando resposta" há mais de ${ALERTAS.aguardandoHoras}h desde o "Enviei".`}
              />
              <LinhaAlerta
                nome="Sem contato"
                regra={`Nenhuma mensagem enviada ao participante há mais de ${ALERTAS.semContatoDias} dias. Se nunca recebeu mensagem, conta a partir do cadastro.`}
              />
              <LinhaAlerta
                nome="Sem resposta"
                regra={`Há mensagem enviada depois da última resposta dele, e já se passaram mais de ${ALERTAS.semRespostaDias} dias sem resposta.`}
              />
              <LinhaAlerta nome="Tarefa atrasada" regra="Data prevista anterior a hoje e tarefa ainda não concluída." />
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted-foreground">
          Participantes com status Inativo não geram alertas. O alerta "Sem resposta" sugere mudar o status para "Sem
          resposta", mas a mudança é sempre feita por você.
        </p>
      </section>
    </article>
  )
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  )
}

function Dica({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
      <Info className="mt-0.5 size-4 shrink-0 text-primary" />
      <p>{children}</p>
    </div>
  )
}

function Regra({
  icone: Icone,
  titulo,
  pontos,
  children,
}: {
  icone: typeof Rocket
  titulo: string
  pontos: string
  children: ReactNode
}) {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-5 text-sm leading-relaxed">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icone className="size-4" />
        </span>
        {titulo}
        <span className="ml-auto rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
          {pontos} pontos
        </span>
      </h3>
      {children}
    </div>
  )
}

function ComoRegistrar({ children }: { children: ReactNode }) {
  return (
    <div>
      <p className="font-medium">Como registrar:</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">{children}</ul>
    </div>
  )
}

function Formula({ children }: { children: ReactNode }) {
  return <p className="rounded-md bg-muted px-3 py-2 font-mono text-xs">{children}</p>
}

function Tabela({ cabecalho, linhas }: { cabecalho: string[]; linhas: string[][] }) {
  return (
    <table className="w-auto overflow-hidden rounded-md border text-xs">
      <thead className="bg-muted/50 text-muted-foreground">
        <tr>
          {cabecalho.map((c, i) => (
            <th key={c} className={cn('px-3 py-1.5 font-medium', i === cabecalho.length - 1 ? 'text-right' : 'text-left')}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y">
        {linhas.map((l, i) => (
          <tr key={i}>
            {l.map((c, j) => (
              <td key={j} className={cn('px-3 py-1.5 tabular-nums', j === l.length - 1 ? 'text-right font-medium' : '')}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Linha({ nome, regra, max }: { nome: string; regra: string; max: number }) {
  return (
    <tr>
      <td className="px-4 py-2.5 font-medium">{nome}</td>
      <td className="px-4 py-2.5 text-muted-foreground">{regra}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{max}</td>
    </tr>
  )
}

function LinhaExemplo({ nome, calculo, pontos }: { nome: string; calculo: string; pontos: number }) {
  return (
    <tr>
      <td className="px-4 py-2.5 font-medium">{nome}</td>
      <td className="px-4 py-2.5 text-muted-foreground">{calculo}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{pontos}</td>
    </tr>
  )
}

function LinhaAlerta({ nome, regra }: { nome: string; regra: string }) {
  return (
    <tr>
      <td className="px-4 py-2.5 font-medium whitespace-nowrap">{nome}</td>
      <td className="px-4 py-2.5 text-muted-foreground">{regra}</td>
    </tr>
  )
}

function Faixa({ classe, texto, descricao }: { classe: string; texto: string; descricao: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('rounded-md px-2 py-0.5 font-semibold tabular-nums', classe)}>{texto}</span>
      <span className="text-muted-foreground">{descricao}</span>
    </span>
  )
}
