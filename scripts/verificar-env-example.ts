// Pre-commit: barra o commit se a versão em stage do .env.example tiver segredo preenchido.
import { execFileSync } from 'node:child_process'
import { segredosPreenchidos } from './env-example.ts'

let conteudo: string
try {
  conteudo = execFileSync('git', ['show', ':.env.example'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
} catch {
  process.exit(0) // .env.example fora do índice: nada a conferir
}

const achados = segredosPreenchidos(conteudo)
if (achados.length) {
  console.error('Commit bloqueado: o .env.example só aceita valores vazios ou placeholders <...> em segredos.')
  for (const { linha, variavel, motivo } of achados) console.error(`  linha ${linha}: ${variavel} (${motivo})`)
  console.error('Coloque o valor real só no .env e deixe o .env.example vazio.')
  process.exit(1)
}
