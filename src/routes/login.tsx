import { useEffect, useState, type FormEvent } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Button, Campo, Input, InputSenha } from '@/components/ui'

export const Route = createFileRoute('/login')({
  ssr: false,
  component: LoginPage,
})

function LoginPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (session) navigate({ to: '/' })
  }, [session, navigate])

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    setEnviando(false)
    if (error) toast.error('E-mail ou senha inválidos.')
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={entrar} className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">CS Weevo</h1>
          <p className="text-sm text-muted-foreground">Acompanhamento pós-imersão</p>
        </div>
        <Campo label="E-mail">
          <Input
            type="email"
            required
            autoFocus
            autoComplete="email"
            placeholder="voce@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Campo>
        <Campo label="Senha">
          <InputSenha
            required
            autoComplete="current-password"
            placeholder="Digite sua senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </Campo>
        <Button type="submit" disabled={enviando} className="h-11 w-full gap-2 px-4 text-base font-bold">
          {enviando ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </main>
  )
}
