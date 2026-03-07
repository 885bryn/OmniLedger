import { createContext, type ReactNode, useContext, useLayoutEffect, useMemo, useState } from 'react'

type Theme = 'light' | 'dark'

type ThemeContextValue = {
  theme: Theme
  isDark: boolean
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const THEME_STORAGE_KEY = 'omniledger-theme'

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark'
}

function readStoredTheme(): Theme | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(storedTheme) ? storedTheme : null
  } catch {
    return null
  }
}

function applyDocumentTheme(theme: Theme) {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.dataset.theme = theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme() ?? 'light')

  useLayoutEffect(() => {
    applyDocumentTheme(theme)
  }, [theme])

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    isDark: theme === 'dark',
    setTheme: (nextTheme: Theme) => {
      setThemeState(nextTheme)

      if (typeof window === 'undefined') {
        return
      }

      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
      } catch {
        return
      }
    },
    toggleTheme: () => {
      const nextTheme = theme === 'light' ? 'dark' : 'light'
      setThemeState(nextTheme)

      if (typeof window === 'undefined') {
        return
      }

      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
      } catch {
        return
      }
    },
  }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }

  return context
}
