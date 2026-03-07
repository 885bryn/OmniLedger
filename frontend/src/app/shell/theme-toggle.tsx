import { Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Pressable } from '@/components/ui/pressable'
import { useTheme } from '../../features/theme/theme-provider'

export function ThemeToggle() {
  const { t } = useTranslation()
  const { theme, isDark, toggleTheme } = useTheme()

  const label = isDark ? t('shell.themeSwitchToLight') : t('shell.themeSwitchToDark')
  const Icon = isDark ? Moon : Sun

  return (
    <Pressable>
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        onClick={toggleTheme}
        aria-label={label}
        title={label}
        aria-pressed={isDark}
        data-active-theme={theme}
        className="h-9 w-9 rounded-lg border-border bg-card text-muted-foreground shadow-sm hover:bg-secondary hover:text-foreground dark:bg-card dark:shadow-none"
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </Button>
    </Pressable>
  )
}
