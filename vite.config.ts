import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  server: { port: 3000 },
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    // SPA: o Supabase é o backend; o app roda inteiro no navegador, protegido por RLS.
    tanstackStart({ spa: { enabled: true } }),
    viteReact(),
  ],
})
