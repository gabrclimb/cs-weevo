import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, Outlet, createFileRoute, useNavigate } from '@tanstack/react-router'
import { CalendarCheck, CircleHelp, ListTodo, LogOut, MessageSquareText, Settings, Trophy, Users, UsersRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useRealtime } from '@/lib/realtime'
import { ThemeToggle } from '@/lib/tema'
import { DicasToggle } from '@/lib/dicas'

export const Route = createFileRoute('/cs')({
  ssr: false,
  component: AppLayout,
})

const NAV = [
  { to: '/cs', label: 'Hoje', icon: CalendarCheck },
  { to: '/cs/engajamento', label: 'Engajamento', icon: Trophy },
  { to: '/cs/tarefas', label: 'Tarefas', icon: ListTodo },
  { to: '/cs/participantes', label: 'Participantes', icon: Users },
  { to: '/cs/turmas', label: 'Turmas', icon: UsersRound },
  { to: '/cs/templates', label: 'Templates', icon: MessageSquareText },
  { to: '/cs/configuracoes', label: 'Configurações', icon: Settings },
  { to: '/cs/ajuda', label: 'Ajuda', icon: CircleHelp },
] as const

function AppLayout() {
  const { session, carregando } = useAuth()
  const navigate = useNavigate()
  useRealtime()

  useEffect(() => {
    if (!carregando && !session) navigate({ to: '/cs/login' })
  }, [carregando, session, navigate])

  // A policy de weevo_admins deixa cada usuário ver só a própria linha.
  const admin = useQuery({
    queryKey: ['admin', session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weevo_admins')
        .select('user_id')
        .eq('user_id', session!.user.id)
        .maybeSingle()
      if (error) throw error
      return !!data
    },
  })

  if (carregando || !session || admin.isLoading) {
    return <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">Carregando…</div>
  }

  if (admin.data === false) {
    return <SemPermissao />
  }

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-56 flex-col border-r bg-gradient-to-b from-primary/25 via-background/90 to-background/95 backdrop-blur [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none">
        <div className="flex items-center gap-2.5 px-5 py-5">
          {/* Duas versões da logo: a menta (para fundo escuro) e a verde-petróleo (para fundo claro). */}
          <img src="/icone-teal.svg" alt="" className="h-7 w-auto shrink-0 dark:hidden" />
          <img src="/icone-mint.svg" alt="" className="hidden h-7 w-auto shrink-0 dark:block" />
          <span className="font-semibold tracking-tight">CS Weevo</span>
        </div>
        <div className="mx-5 mb-3 h-px bg-border" />
        <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === '/cs' }}
              className="flex h-10 items-center gap-2.5 rounded-xl border border-transparent px-3 text-sm text-muted-foreground transition-all outline-none hover:border-border hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              activeProps={{ className: 'border-border bg-muted font-medium text-foreground shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06)]' }}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="space-y-1.5 border-t px-3 py-3">
          <p className="truncate px-3 pb-1 text-xs text-muted-foreground" title={session.user.email}>
            {session.user.email}
          </p>
          <div className="flex items-center gap-1.5">
            <button onClick={() => supabase.auth.signOut()} className="flex h-10 items-center gap-2.5 rounded-xl border border-transparent px-3 text-sm text-muted-foreground transition-all outline-none hover:border-border hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 flex-1">
              <LogOut className="size-4" aria-hidden="true" />
              Sair
            </button>
            <DicasToggle className="flex size-10 items-center justify-center rounded-xl border border-border text-muted-foreground transition-all outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:text-amber-500" />
            <ThemeToggle className="flex size-10 items-center justify-center rounded-xl border border-border text-muted-foreground transition-all outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50" />
          </div>
        </div>
      </aside>
      <main className="ml-56 px-8 py-8">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function SemPermissao() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 text-center text-card-foreground shadow-sm">
        <h1 className="text-lg font-semibold">Acesso não liberado</h1>
        <p className="text-sm text-muted-foreground">Seu usuário ainda não tem acesso ao CS Weevo. Fale com o responsável pelo sistema.</p>
        <button onClick={() => supabase.auth.signOut()} className="h-9 rounded-[min(var(--radius-md),12px)] border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted">
          Sair
        </button>
      </div>
    </main>
  )
}
