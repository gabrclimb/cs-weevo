import { useEffect, useState } from 'react'
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
    document.documentElement.classList.toggle('dark', proximo)
    try {
      localStorage.setItem(CHAVE, proximo ? 'escuro' : 'claro')
    } catch {}
    setEscuro(proximo)
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
