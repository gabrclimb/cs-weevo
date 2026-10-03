import { createContext, useContext, useState, type ReactNode } from 'react'
import { Lightbulb, LightbulbOff } from 'lucide-react'

const CHAVE = 'dicas'

type Contexto = { ativas: boolean; alternar: () => void }

const DicasContext = createContext<Contexto>({ ativas: true, alternar: () => {} })

/** Liga/desliga as dicas (tooltips explicativos) do sistema. Ligadas por padrão, salvo no navegador. */
export function DicasProvider({ children }: { children: ReactNode }) {
  const [ativas, setAtivas] = useState(() => {
    try {
      return typeof window === 'undefined' || localStorage.getItem(CHAVE) !== 'desligadas'
    } catch {
      return true
    }
  })

  function alternar() {
    setAtivas((atual) => {
      const proximo = !atual
      try {
        localStorage.setItem(CHAVE, proximo ? 'ligadas' : 'desligadas')
      } catch {}
      return proximo
    })
  }

  return <DicasContext.Provider value={{ ativas, alternar }}>{children}</DicasContext.Provider>
}

export function useDicas() {
  return useContext(DicasContext)
}

export function DicasToggle({ className }: { className?: string }) {
  const { ativas, alternar } = useDicas()
  return (
    <button
      type="button"
      onClick={alternar}
      className={className}
      aria-pressed={ativas}
      aria-label={ativas ? 'Desligar dicas' : 'Ligar dicas'}
      title={ativas ? 'Dicas ligadas: clique para desligar' : 'Dicas desligadas: clique para ligar'}
    >
      {ativas ? <Lightbulb className="size-4" aria-hidden="true" /> : <LightbulbOff className="size-4" aria-hidden="true" />}
    </button>
  )
}
