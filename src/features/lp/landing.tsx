import './lp.css'
import { DEPOIMENTOS, urlVideo, useDepoimentosVideos } from './depoimentos'

const WHATSAPP = 'https://wa.me/558496988444'

const FATOS = [
  { valor: '213', texto: 'leitos (180 de internação e 33 de UTI)' },
  { valor: '658', texto: 'colaboradores ativos' },
  { valor: '1952', texto: 'em operação desde' },
  { valor: 'ISO 9001', texto: 'certificado desde 2013' },
]

const PROBLEMAS: { cargo: string; local?: string; texto: string }[] = [
  { cargo: 'Diretor Superintendente', texto: 'Indicadores espalhados em planilhas e na DRE, com conferência diária antes de cada decisão.' },
  { cargo: 'Gerente do Ciclo da Receita', texto: 'Análise manual de contas para retirar pendências de prontuário e aplicar as regras de cada convênio antes do faturamento.' },
  { cargo: 'Gerente Administrativo', texto: 'Relatórios do MV em PDF que dependem da TI para conversão, e cruzamento manual de receita, custo e produção.' },
  { cargo: 'Contadora', texto: 'Emissão manual de notas fiscais, transcrevendo dados do MV para o Portal Nacional.' },
  { cargo: 'Gerente de Enfermagem', texto: 'Montagem mensal e remanejamento diário da escala de plantão, com faltas e atestados.' },
  { cargo: 'Gerente Assistencial', texto: 'Busca ativa presencial de admissões e altas para medir o giro de leitos.' },
  { cargo: 'Coordenadora de Aquisição e Logística', texto: 'Estoque e insumos não atendidos espalhados entre telas e relatórios.' },
  { cargo: 'Diretor Administrativo', local: 'Hospital Vita', texto: 'Compras, recebimento, faturamento e estoque sem acompanhamento único, com conferência manual.' },
  { cargo: 'Administrador', local: 'Oncoclínica São Marcos', texto: 'Indicadores em sistemas e planilhas diferentes, consolidados à mão antes de ir aos sócios.' },
]

const ANTES_DEPOIS = [
  {
    cargo: 'Diretor Superintendente',
    ganho: '4,8 h por semana',
    antes: 'Buscar dados em várias planilhas e na DRE, consolidar à mão e conferir os números todo dia antes de decidir.',
    tempoAntes: ['12 h', 'por semana'],
    depois: 'A IA consolida planilhas e DRE e entrega a análise pronta para conferência e decisão.',
    tempoDepois: ['7,2 h', 'por semana'],
  },
  {
    cargo: 'Gerente de Enfermagem',
    ganho: '2 h por semana',
    antes: 'Montar a escala mensal em planilha e remanejar posições todo dia, com faltas e atestados.',
    tempoAntes: ['5 h', 'por semana'],
    depois: 'A IA monta a escala a partir das regras do setor e sugere as coberturas de faltas.',
    tempoDepois: ['3 h', 'por semana'],
  },
  {
    cargo: 'Gerente Assistencial',
    ganho: '48 min por dia',
    antes: 'Busca ativa a cada turno, nos setores e no sistema, para reunir admissões e altas e medir o giro de leitos.',
    tempoAntes: ['2 h', 'por dia, da equipe'],
    depois: 'A IA organiza admissões, previsões de alta e altas por turno em uma visão única.',
    tempoDepois: ['1,2 h', 'por dia, da equipe'],
  },
  {
    cargo: 'Coordenadora de Aquisição e Logística',
    ganho: '1,6 h por semana',
    antes: 'Consultar telas de estoque e relatórios de consumo para decidir o que comprar e o que falta.',
    tempoAntes: ['4 h', 'por semana'],
    depois: 'A IA cruza pedidos e estoque e aponta inconsistências e itens em baixa.',
    tempoDepois: ['2,4 h', 'por semana'],
  },
]

const TAMBEM = [
  'Triagem de e-mails por assunto e urgência',
  'Apuração de custos hospitalares',
  'Painéis a partir de planilhas',
  'Controle de ponto e férias',
]

const RAZOES = [
  { titulo: 'O problema é de todo hospital', texto: 'Leitos, escala de enfermagem, custos, estoque, faturamento e DRE existem em qualquer instituição de saúde.' },
  { titulo: 'Quem aprende é quem opera', texto: 'Cada gestor aplicou IA no próprio processo e sai sabendo repetir o método em outras rotinas do setor.' },
  { titulo: 'Sai aplicando, não só sabendo', texto: 'A Imersão ensina com o processo real na tela, e o suporte acompanha o uso da IA na rotina do setor.' },
]

const CONTATOS = [
  { rotulo: 'Site', texto: 'weevoedu.com', href: 'https://weevoedu.com' },
  { rotulo: 'Instagram', texto: '@weevo_edu', href: 'https://instagram.com/weevo_edu' },
  { rotulo: 'E-mail', texto: 'contato@weevoedu.com', href: 'mailto:contato@weevoedu.com' },
  { rotulo: 'WhatsApp', texto: '+55 84 9698-8444', href: WHATSAPP },
]

function Cabecalho({ eyebrow, titulo, texto }: { eyebrow: string; titulo: string; texto: string }) {
  return (
    <div className="head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{titulo}</h2>
      </div>
      <p>{texto}</p>
    </div>
  )
}

export function Landing() {
  return (
    <div className="lp">
      <Topo />
      <Hero />
      <Numeros />
      <Cliente />
      <Desafio />
      <Jornada />
      <AntesDepois />
      <Avaliacao />
      <Depoimentos />
      <Desdobramento />
      <Contato />
      <footer>
        <div className="wrap">
          <span>Weevo · Maturidade tecnológica para quem lidera negócios</span>
          <span>Grupo SB · Natal/RN</span>
        </div>
      </footer>
    </div>
  )
}

function Topo() {
  return (
    <nav className="nav">
      <div className="wrap">
        <a className="logo" href="https://weevoedu.com" aria-label="Weevo">
          <svg viewBox="0 0 285 219" fill="currentColor" aria-hidden="true">
            <path d="M36.1383 0C56.097 0 72.2767 16.1797 72.2767 36.1383V132.267C72.9523 141.188 77.6434 144.542 91.6845 145.718H93.6512C113.753 145.718 130.049 162.014 130.049 182.116C130.048 202.218 113.753 218.514 93.6512 218.514C73.5498 218.513 57.2542 202.217 57.2538 182.116V163.425C56.1795 151.027 52.8842 146.701 41.5146 145.786L57.2538 145.785H36.1383C16.1797 145.785 3.40683e-07 129.606 0 109.647V0H36.1383ZM142.911 0C162.869 0 179.049 16.1797 179.049 36.1383V132.267C179.725 141.188 184.416 144.542 198.457 145.718H200.424C220.525 145.718 236.821 162.014 236.821 182.116C236.821 202.218 220.525 218.514 200.424 218.514C180.322 218.513 164.027 202.217 164.026 182.116V163.425C162.952 151.027 159.657 146.701 148.287 145.786L164.026 145.785H142.911C122.952 145.785 106.772 129.606 106.772 109.647V0H142.911ZM248.862 0C268.82 0 285 16.1797 285 36.1383V145.785H248.862C228.903 145.785 212.723 129.606 212.723 109.647V0H248.862Z" />
          </svg>
          weevo
        </a>
        <span className="tag">Case · Saúde</span>
      </div>
    </nav>
  )
}

function Hero() {
  return (
    <header className="hero">
      <svg className="arcs" viewBox="0 0 620 520" fill="none" stroke="#E4EAE9" strokeWidth="2" aria-hidden="true">
        <path d="M0 0v300a120 120 0 0 0 120 120h40a60 60 0 0 1 60 60v40" />
        <path d="M180 0v300a120 120 0 0 0 120 120h40a60 60 0 0 1 60 60v40" />
        <path d="M360 0v300a120 120 0 0 0 120 120h140" />
      </svg>
      <div className="coords">
        5° 45' 36" S<br />
        36° 48' 18" O
      </div>
      <div className="wrap">
        <div className="eyebrow">Case · Casa de Saúde São Lucas</div>
        <h1>
          A gestão de um hospital aprendendo a usar IA. <span>Em um dia.</span>
        </h1>
        <p className="lead">
          Na Imersão Weevo, diretores e gerentes da Casa de Saúde São Lucas aprenderam a aplicar IA nas rotinas do próprio setor, da gestão de leitos à escala de enfermagem, e saíram com os processos mais rápidos.
        </p>
      </div>
    </header>
  )
}

function Numeros() {
  const itens = [
    ['1 dia', 'de Imersão presencial'],
    ['~40%', 'menos tempo nas rotinas, estimado'],
    ['10', 'nota dos facilitadores, unânime'],
    ['2ª', 'turma contratada pelo hospital'],
  ]
  return (
    <div className="stats">
      <div className="wrap grid">
        {itens.map(([valor, texto]) => (
          <div className="stat" key={valor}>
            <b>{valor}</b>
            <span>{texto}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Cliente() {
  return (
    <section className="light" id="cliente">
      <div className="wrap">
        <Cabecalho eyebrow="O cliente" titulo="Um hospital de referência em Natal." texto="Fundado em 1945 e em operação desde 1952, com certificação ISO 9001 desde 2013." />
        <div className="client">
          <div>
            <p>A Casa de Saúde São Lucas é um hospital privado no Tirol, em Natal/RN. A estrutura inclui pronto-socorro 24h, centro cirúrgico com 7 salas, ressonância, tomografia, hemodinâmica, clínica hiperbárica, raio X e ultrassom.</p>
            <p>A turma reuniu o Diretor Superintendente, diretores e gerentes das áreas assistencial, de enfermagem, financeira, de suprimentos e administrativa, além de gestores convidados do Hospital Vita e da Oncoclínica São Marcos.</p>
          </div>
          <div>
            <div className="facts">
              {FATOS.map((f) => (
                <div className="fact" key={f.valor}>
                  <b>{f.valor}</b>
                  <span>{f.texto}</span>
                </div>
              ))}
            </div>
            <p className="source">
              Fontes: <a href="https://www.saolucasnatal.com.br/infraestrutura">Infraestrutura</a>, <a href="https://www.saolucasnatal.com.br/historia">História</a> e{' '}
              <a href="https://www.saolucasnatal.com.br/wp-content/uploads/2026/09/RelatorioIgualdadeSalarialLote_2026_2_08319329000121.pdf">Relatório de Transparência Salarial</a> (colaboradores em 30/06/2026).
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function Desafio() {
  return (
    <section id="desafio">
      <div className="wrap">
        <Cabecalho eyebrow="O desafio" titulo="Processos críticos rodando no manual." texto="Antes da Imersão, cada gestor mapeou a rotina que mais consome tempo no seu setor. O padrão se repete: dado espalhado, conferência à mão e decisão atrasada." />
        <div className="problems">
          {PROBLEMAS.map((p, i) => (
            <div className="problem" key={p.cargo}>
              <span className="n">{String(i + 1).padStart(2, '0')}</span>
              <h3>
                {p.cargo}
                {p.local && <small>{p.local}</small>}
              </h3>
              <p>{p.texto}</p>
            </div>
          ))}
        </div>
        <p className="fonte">Fonte: diagnóstico pré-Imersão Weevo, setembro de 2026.</p>
      </div>
    </section>
  )
}

function Jornada() {
  return (
    <section className="deep" id="jornada">
      <div className="wrap">
        <Cabecalho eyebrow="O que a Weevo fez" titulo="Aprender no dia. Aplicar na rotina." texto="Notebook aberto da primeira à última hora, facilitador ao lado e o caso real de cada setor. Exemplo genérico não entra." />
        <div className="steps">
          <div className="step">
            <span className="tag">Imersão</span>
            <h3>1 dia, mão na massa</h3>
            <p>Cada gestor aprendeu a usar IA no problema do próprio setor, passando por Claude, Claude Cowork e Claude Code, sempre com o processo real na tela.</p>
            <div className="date">12 de setembro de 2026</div>
          </div>
          <div className="step">
            <span className="tag">Suporte</span>
            <h3>1 encontro semanal</h3>
            <p>Encontros online em horário fixo para tirar dúvidas e levar o uso da IA para a rotina do hospital, com facilitador responsável por participante.</p>
            <div className="date">23 de setembro a 15 de outubro de 2026</div>
          </div>
        </div>
      </div>
    </section>
  )
}

function AntesDepois() {
  return (
    <section className="light" id="antes-depois">
      <div className="wrap">
        <Cabecalho eyebrow="Antes e depois" titulo="Onde a IA entrou na rotina." texto="Quatro processos do hospital, como eram feitos e como passam a ser com IA. O tempo de antes foi declarado pelos próprios gestores." />
        <div className="ba">
          {ANTES_DEPOIS.map((c) => (
            <div className="bacard" key={c.cargo}>
              <div className="bahead">
                <h3>{c.cargo}</h3>
                <span className="gain">
                  Ganho estimado <b>{c.ganho}</b>
                </span>
              </div>
              <div className="bacols">
                <div className="bacol before">
                  <span className="lbl">Antes</span>
                  <p>{c.antes}</p>
                  <div className="bar"><i style={{ width: '100%' }} /></div>
                  <div className="time">{c.tempoAntes[0]}<small>{c.tempoAntes[1]}</small></div>
                </div>
                <div className="arrow" aria-hidden="true">→</div>
                <div className="bacol after">
                  <span className="lbl">Com IA</span>
                  <p>{c.depois}</p>
                  <div className="bar"><i style={{ width: '60%' }} /></div>
                  <div className="time">{c.tempoDepois[0]}<small>{c.tempoDepois[1]}</small></div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="batotal">
          <b>8,4 h</b>
          <p>por semana devolvidas à gestão em três processos, mais 48 minutos por dia na medição do giro de leitos. Estimativa.</p>
        </div>
        <p className="method">
          Antes: tempo declarado pelos gestores no diagnóstico pré-Imersão Weevo, setembro de 2026. Com IA: estimativa aplicando a redução média de 40% no tempo de tarefas com IA generativa medida em estudo experimental de Noy e Zhang (
          <a href="https://news.mit.edu/2023/study-finds-chatgpt-boosts-worker-productivity-writing-0714">Science, 2023</a>).
        </p>
        <div className="chips">
          <span className="t">A IA também entrou em:</span>
          {TAMBEM.map((t) => (
            <span className="chip" key={t}>{t}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

function Avaliacao() {
  const frases = [
    'Uma excelente didática e acompanhamento prático. O conteúdo é totalmente aplicável.',
    'Além do conhecimento adquirido, o empenho de toda a equipe da Weevo em fazer acontecer.',
  ]
  return (
    <section id="avaliacao">
      <div className="wrap">
        <Cabecalho eyebrow="Avaliação da Imersão" titulo="O que a turma disse." texto="Avaliação respondida ao fim da Imersão." />
        <div className="eval">
          <div className="score"><b className="t">10</b><span>Suporte dos facilitadores, nota unânime</span></div>
          <div className="score"><b>9,6</b><span>Nota geral média da Imersão</span></div>
        </div>
        <div className="quotes">
          {frases.map((f) => (
            <div className="quote" key={f}>
              <span className="mark">“</span>
              <blockquote>{f}</blockquote>
              <cite>Participante, avaliação da Imersão</cite>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Depoimentos() {
  const videos = useDepoimentosVideos()
  return (
    <section className="light" id="depoimentos">
      <div className="wrap">
        <Cabecalho eyebrow="Depoimentos" titulo="Na voz de quem decide." texto="Gravados durante a Imersão, em 12 de setembro de 2026." />
        <div
          className="vquotes"
          // Só um vídeo toca por vez: ao dar play em um, pausa os demais.
          onPlayCapture={(e) => {
            e.currentTarget.querySelectorAll('video').forEach((v) => {
              if (v !== e.target) v.pause()
            })
          }}
        >
          {DEPOIMENTOS.map((d) => {
            const src = urlVideo(videos.data?.[d.chave])
            return (
              <div className={'vcard' + ('destaque' in d && d.destaque ? ' featured' : '')} key={d.chave}>
                {src ? (
                  <video src={src} controls playsInline preload="metadata" aria-label={`Depoimento: ${d.cargo}`} />
                ) : (
                  <div className="sem-video">Vídeo em breve</div>
                )}
                <div>
                  <blockquote>“{d.frase}”</blockquote>
                  <cite>
                    <b>{d.cargo}</b>
                    <span>{d.local}</span>
                  </cite>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function Desdobramento() {
  return (
    <section className="next" id="desdobramento">
      <div className="wrap">
        <div className="eyebrow">Desdobramento</div>
        <h2>
          Depois da primeira turma, o hospital contratou a segunda. <span>O resultado falou antes da proposta.</span>
        </h2>
        <div className="reasons">
          {RAZOES.map((r, i) => (
            <div className="reason" key={r.titulo}>
              <span className="n">{String(i + 1).padStart(2, '0')}</span>
              <h3>{r.titulo}</h3>
              <p>{r.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Contato() {
  return (
    <section className="cta" id="contato">
      <div className="wrap">
        <div>
          <div className="eyebrow">Imersão in company</div>
          <h2>Qual é a melhor data para levar isso à sua gestão?</h2>
          <a className="btn" href={WHATSAPP}>Conversar com a Weevo</a>
        </div>
        <div className="contacts">
          {CONTATOS.map((c) => (
            <div key={c.rotulo}>
              <span>{c.rotulo}</span>
              <a href={c.href}>{c.texto}</a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
