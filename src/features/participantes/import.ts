import Papa from 'papaparse'
import { normalize } from '@/lib/csv'
import { normalizarTelefone } from '@/lib/telefone'

/** Campos de texto do participante que podem vir do arquivo. */
export const CAMPOS_TEXTO = {
  nome: 'Nome',
  apelido: 'Apelido',
  telefone: 'Telefone',
  empresa: 'Empresa',
  turma: 'Turma',
  responsavel: 'Responsável',
  dia_escolhido: 'Dia escolhido',
  cadastro_plataforma: 'Cadastro na plataforma',
  sistema: 'Sistema que está fazendo',
  dificuldades: 'Dificuldades',
  suporte_extra: 'Suporte extra',
  nps: 'Respondeu NPS',
  observacoes: 'Observações',
} as const

export const CAMPOS = {
  ...CAMPOS_TEXTO,
  encontro_1: 'Presença no plantão 1',
  encontro_2: 'Presença no plantão 2',
  encontro_3: 'Presença no plantão 3',
  encontro_4: 'Presença no plantão 4',
} as const

export type Campo = keyof typeof CAMPOS
type CampoTexto = keyof typeof CAMPOS_TEXTO
/** Para cada coluna do arquivo (pelo índice): campo de destino ou null (ignorar). */
export type Mapeamento = (Campo | null)[]

/** Só "Observações" aceita várias colunas (concatenadas como "Coluna: valor"). */
export const CAMPOS_UNICOS: Campo[] = (Object.keys(CAMPOS) as Campo[]).filter((c) => c !== 'observacoes')

const ENCONTROS = ['encontro_1', 'encontro_2', 'encontro_3', 'encontro_4'] as const

// Comparação sem acento, caixa ou pontuação ("1º Encontro" → "1 encontro").
const chaveColuna = (texto: string) =>
  normalize(texto)
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const ALIASES: Record<Campo, string[]> = {
  nome: ['nome', 'nome completo', 'participante', 'aluno', 'nome do participante'],
  apelido: ['apelido', 'como e chamado', 'como prefere ser chamado'],
  telefone: ['telefone', 'celular', 'whatsapp', 'fone', 'whats', 'contato'],
  empresa: ['empresa', 'negocio', 'companhia'],
  turma: ['turma'],
  responsavel: ['responsavel', 'responsavel cs', 'acompanhado por'],
  dia_escolhido: ['dia escolhido', 'horario escolhido', 'dia do plantao', 'turno escolhido'],
  cadastro_plataforma: ['fez cadastro na plataforma', 'cadastro na plataforma', 'cadastro plataforma', 'cadastro'],
  sistema: [
    'qual o sistema que ele ta fazendo',
    'qual o sistema que ele esta fazendo',
    'qual sistema esta fazendo',
    'sistema',
    'projeto',
  ],
  dificuldades: ['quais as maiores dificuldades', 'maiores dificuldades', 'dificuldades', 'dificuldade'],
  suporte_extra: ['suporte extra'],
  nps: ['respondeu nps', 'nps'],
  observacoes: ['observacoes', 'observacao', 'obs'],
  encontro_1: ['1 encontro', '1o encontro', 'encontro 1', 'plantao 1', '1 plantao'],
  encontro_2: ['2 encontro', '2o encontro', 'encontro 2', 'plantao 2', '2 plantao'],
  encontro_3: ['3 encontro', '3o encontro', 'encontro 3', 'plantao 3', '3 plantao'],
  encontro_4: ['4 encontro', '4o encontro', 'encontro 4', 'plantao 4', '4 plantao'],
}

/** Valor da coluna de encontro que conta como presença. */
export function contaComoPresenca(valor: string): boolean {
  const v = chaveColuna(valor)
  return v === 'veio' || v === 'sim' || v === 'presente' || v === 'compareceu'
}

/** Lê o CSV como matriz de células, sem assumir onde está o cabeçalho. */
export function lerTabela(conteudo: string): string[][] {
  // O auto-detect do separador descarta linhas só com separadores; detecta primeiro e lê de novo com ele.
  // Linhas vazias são mantidas para a numeração bater com a planilha; só as do final saem.
  const texto = conteudo.replace(/^\uFEFF/, '')
  const { delimiter } = Papa.parse(texto, { preview: 20 }).meta
  const r = Papa.parse<string[]>(texto, { header: false, skipEmptyLines: false, delimiter })
  const tabela = r.data.map((linha) => linha.map((c) => (c ?? '').trim()))
  while (tabela.length && tabela[tabela.length - 1].every((c) => !c)) tabela.pop()
  return tabela
}

function campoPorAlias(texto: string): Campo | null {
  const n = chaveColuna(texto)
  if (!n) return null
  return (Object.keys(ALIASES) as Campo[]).find((c) => ALIASES[c].includes(n)) ?? null
}

/**
 * Linha do cabeçalho: a primeira (entre as 10 iniciais) com ao menos 2 nomes de coluna conhecidos;
 * senão, a primeira linha com mais células preenchidas.
 */
export function detectarCabecalho(tabela: string[][]): number {
  const inicio = tabela.slice(0, 10)
  const reconhecida = inicio.findIndex((l) => l.filter((c) => campoPorAlias(c)).length >= 2)
  if (reconhecida >= 0) return reconhecida
  let melhor = 0
  inicio.forEach((l, i) => {
    if (l.filter(Boolean).length > inicio[melhor].filter(Boolean).length) melhor = i
  })
  return melhor
}

/**
 * Turma sugerida a partir de uma linha de título acima do cabeçalho com uma única célula,
 * ex.: "Agosto - Imersão" → "Agosto".
 */
export function sugerirTurma(tabela: string[][], linhaCabecalho: number): string | null {
  for (const linha of tabela.slice(0, linhaCabecalho)) {
    const cheias = linha.filter(Boolean)
    if (cheias.length === 1) return cheias[0].split(/\s+-\s+/)[0].trim() || null
  }
  return null
}

/** Sugestão inicial: casa nomes conhecidos; cada campo único só uma vez. */
export function sugerirMapeamento(cabecalho: string[]): Mapeamento {
  const usados = new Set<Campo>()
  return cabecalho.map((c) => {
    const campo = campoPorAlias(c)
    if (!campo || (CAMPOS_UNICOS.includes(campo) && usados.has(campo))) return null
    usados.add(campo)
    return campo
  })
}

/** Problemas no mapeamento que impedem continuar. */
export function validarMapeamento(m: Mapeamento): string[] {
  const erros: string[] = []
  if (!m.includes('nome')) erros.push('Escolha a coluna que vai para "Nome".')
  for (const c of CAMPOS_UNICOS) {
    if (m.filter((x) => x === c).length > 1) erros.push(`Mais de uma coluna indo para "${CAMPOS[c]}".`)
  }
  return erros
}

export type LinhaParticipante = {
  linha: number
  nome: string
  telefone: string | null
  turma: string | null
  /** Campos de texto opcionais (apelido, empresa, responsável...). */
  dados: Partial<Record<Exclude<CampoTexto, 'nome' | 'telefone' | 'turma'>, string>>
  /** Números dos plantões (1 a 4) em que veio. */
  presencas: number[]
}

export type PreviaImport = {
  total: number
  novos: LinhaParticipante[]
  duplicados: (LinhaParticipante & { motivo: string })[]
  invalidas: { linha: number; motivo: string }[]
  turmasNovas: string[]
  /** Plantões com coluna mapeada: precisam existir na turma (são criados se faltarem). */
  plantoesMapeados: number[]
  /** Presenças que não serão registradas por falta de turma. */
  presencasSemTurma: number
}

/**
 * Prévia do import com o mapeamento escolhido.
 * Duplicado = telefone já cadastrado/repetido, ou (sem telefone) mesmo nome na mesma turma.
 * `turmaFixa`: turma aplicada às linhas sem turma na coluna.
 */
export function previaImportParticipantes(
  tabela: string[][],
  linhaCabecalho: number,
  mapeamento: Mapeamento,
  existentes: { telefones: Iterable<string>; turmas: Iterable<string>; nomesPorTurma?: Iterable<string> },
  turmaFixa: string | null = null,
): PreviaImport {
  const cabecalho = tabela[linhaCabecalho] ?? []
  const dados = tabela.slice(linhaCabecalho + 1)
  const vazia = (l: string[]) => l.every((c) => !c)
  const indice = (c: Campo) => mapeamento.indexOf(c)
  const colsObs = mapeamento.flatMap((c, i) => (c === 'observacoes' ? [i] : []))
  const opcionais = (Object.keys(CAMPOS_TEXTO) as CampoTexto[]).filter(
    (c): c is Exclude<CampoTexto, 'nome' | 'telefone' | 'turma'> =>
      !['nome', 'telefone', 'turma', 'observacoes'].includes(c),
  )
  const plantoesMapeados = ENCONTROS.flatMap((e, i) => (mapeamento.includes(e) ? [i + 1] : []))

  const telefonesVistos = new Set(existentes.telefones)
  const nomesVistos = new Set(existentes.nomesPorTurma ?? [])
  const turmasConhecidas = new Map<string, string>()
  for (const t of existentes.turmas) turmasConhecidas.set(normalize(t), t)
  const turmasNovas = new Map<string, string>()

  const previa: PreviaImport = {
    total: dados.filter((l) => !vazia(l)).length,
    novos: [],
    duplicados: [],
    invalidas: [],
    turmasNovas: [],
    plantoesMapeados,
    presencasSemTurma: 0,
  }
  const valor = (linha: string[], c: Campo) => (indice(c) >= 0 ? linha[indice(c)]?.trim() || '' : '')

  dados.forEach((cels, i) => {
    if (vazia(cels)) return
    const linha = linhaCabecalho + i + 2 // numeração como no editor de planilha
    const nome = valor(cels, 'nome')
    if (!nome) {
      previa.invalidas.push({ linha, motivo: 'Nome vazio' })
      return
    }

    const telefoneBruto = valor(cels, 'telefone')
    const telefone = telefoneBruto ? normalizarTelefone(telefoneBruto) : null
    if (telefoneBruto && !telefone) {
      previa.invalidas.push({ linha, motivo: `Telefone inválido: ${telefoneBruto}` })
      return
    }

    const turmaBruta = valor(cels, 'turma') || turmaFixa || ''
    let turma: string | null = null
    if (turmaBruta) {
      const chave = normalize(turmaBruta)
      turma = turmasConhecidas.get(chave) ?? turmasNovas.get(chave) ?? turmaBruta
      if (!turmasConhecidas.has(chave) && !turmasNovas.has(chave)) turmasNovas.set(chave, turmaBruta)
    }

    const extras: LinhaParticipante['dados'] = {}
    for (const c of opcionais) {
      const v = valor(cels, c)
      if (v) extras[c] = v
    }
    const obs = colsObs
      .map((ci) => (cels[ci]?.trim() ? `${cabecalho[ci] || `Coluna ${ci + 1}`}: ${cels[ci].trim()}` : ''))
      .filter(Boolean)
      .join('\n')
    if (obs) extras.observacoes = obs
    // Sem apelido no arquivo, o apelido é o primeiro nome.
    if (!extras.apelido) extras.apelido = nome.trim().split(/\s+/)[0]

    const presencas = ENCONTROS.flatMap((e, n) => (contaComoPresenca(valor(cels, e)) ? [n + 1] : []))
    if (presencas.length && !turma) previa.presencasSemTurma += presencas.length

    const item: LinhaParticipante = { linha, nome, telefone, turma, dados: extras, presencas }

    if (telefone && telefonesVistos.has(telefone)) {
      previa.duplicados.push({ ...item, motivo: 'telefone já cadastrado' })
      return
    }
    const chaveNome = `${normalize(nome)}|${normalize(turma)}`
    if (!telefone && nomesVistos.has(chaveNome)) {
      previa.duplicados.push({ ...item, motivo: 'mesmo nome já cadastrado nesta turma' })
      return
    }
    if (telefone) telefonesVistos.add(telefone)
    nomesVistos.add(chaveNome)
    previa.novos.push(item)
  })

  previa.turmasNovas = [...turmasNovas.values()]
  return previa
}

/** Chave usada em `nomesPorTurma`: nome e turma normalizados. */
export function chaveNomeTurma(nome: string, turma: string | null): string {
  return `${normalize(nome)}|${normalize(turma)}`
}
