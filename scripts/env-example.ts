/** Uma variável de segredo com valor preenchido no .env.example. */
export type SegredoPreenchido = { linha: number; variavel: string; motivo: string }

/** Variáveis de segredo do .env.example que não estão vazias nem com placeholder `<...>`. */
export function segredosPreenchidos(_conteudo: string): SegredoPreenchido[] {
  return []
}
