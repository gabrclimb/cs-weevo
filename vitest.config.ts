import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'

// Dois projetos: `unit` (regras puras e componentes, em src/) e `db` (RLS, RPCs e imutabilidade, em tests/db/).
// Os testes de banco rodam no PGlite por padrão; DB_TEST_TARGET=supabase aponta para o Supabase local do CI.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [viteReact()],
  test: {
    projects: [
      { extends: true, test: { name: 'unit', include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'] } },
      { extends: true, test: { name: 'db', include: ['tests/db/**/*.test.ts'], testTimeout: 30_000, hookTimeout: 60_000 } },
    ],
  },
})
