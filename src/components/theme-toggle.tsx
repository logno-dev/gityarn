import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

function resolveTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const stored = window.localStorage.getItem('gityarn-theme') as Theme | null
  if (stored === 'dark' || stored === 'light') {
    return stored
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  window.localStorage.setItem('gityarn-theme', theme)
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => resolveTheme())

  useEffect(() => {
    const initialTheme = resolveTheme()
    setTheme(initialTheme)
    applyTheme(initialTheme)

    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'gityarn-theme') {
        return
      }
      const nextTheme = resolveTheme()
      setTheme(nextTheme)
      document.documentElement.dataset.theme = nextTheme
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toggleTheme = () => {
    const currentTheme = (document.documentElement.dataset.theme as Theme | undefined) ?? resolveTheme()
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light'
    setTheme(nextTheme)
    applyTheme(nextTheme)
  }

  return (
    <button aria-label="Toggle light or dark mode" className="icon-button" onClick={toggleTheme} type="button">
      {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
      <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
    </button>
  )
}
