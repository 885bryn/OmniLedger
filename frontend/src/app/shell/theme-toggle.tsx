import { Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../features/theme/theme-provider'

export function ThemeToggle() {
  const { t } = useTranslation()
  const { theme, isDark, toggleTheme } = useTheme()

  const label = isDark ? t('shell.themeSwitchToLight') : t('shell.themeSwitchToDark')
  const Icon = isDark ? Moon : Sun

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      aria-pressed={isDark}
      data-active-theme={theme}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shadow-sm transition-colors duration-150 hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      <Icon className="h-4 w-4 transition-transform duration-150" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </button>
  )
}
