import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { Moon, Sun } from 'lucide-react'

const CHAVE = 'tema'

/** Roda antes da hidratação para aplicar o tema salvo sem piscar. Dark é o padrão. */
export const SCRIPT_TEMA = `try{if(localStorage.getItem('${CHAVE}')==='claro')document.documentElement.classList.remove('dark')}catch(e){}`

export function ThemeToggle({ className }: { className?: string }) {
  const [escuro, setEscuro] = useState(true)

  useEffect(() => {
    setEscuro(document.documentElement.classList.contains('dark'))
  }, [])

  function alternar() {
    const proximo = !escuro
    const raiz = document.documentElement
    const aplicar = () => {
      raiz.classList.toggle('dark', proximo)
      setEscuro(proximo)
    }
    try {
      localStorage.setItem(CHAVE, proximo ? 'escuro' : 'claro')
    } catch {}

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return aplicar()

    // Fade entre a tela antes e depois: anima até o gradiente de fundo, que o CSS não consegue transicionar.
    if (typeof document.startViewTransition === 'function') {
      document.startViewTransition(() => flushSync(aplicar))
      return
    }

    // Sem a API (navegadores antigos): transição de cores, ligada só durante a troca para não pesar no resto.
    raiz.classList.add('trocando-tema')
    aplicar()
    window.setTimeout(() => raiz.classList.remove('trocando-tema'), 400)
  }

  return (
    <button
      type="button"
      onClick={alternar}
      className={className}
      aria-label={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
      title={escuro ? 'Tema claro' : 'Tema escuro'}
    >
      {escuro ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
    </button>
  )
}
