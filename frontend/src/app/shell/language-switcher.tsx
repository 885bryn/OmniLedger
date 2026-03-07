import { useTranslation } from 'react-i18next'

import { Pressable } from '@/components/ui/pressable'

const SUPPORTED_LANGUAGES = [
  { code: 'en', labelKey: 'language.english' },
  { code: 'zh', labelKey: 'language.chinese' },
] as const

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()

  return (
    <div className="inline-flex rounded-md border border-border bg-background p-1 text-xs text-muted-foreground">
      {SUPPORTED_LANGUAGES.map((option) => (
        <Pressable key={option.code}>
          <button
            type="button"
            onClick={() => {
              void i18n.changeLanguage(option.code)
            }}
            className={[
              'rounded px-2 py-1 transition-colors',
              i18n.language.startsWith(option.code)
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-secondary hover:text-foreground',
            ].join(' ')}
          >
            {t(option.labelKey)}
          </button>
        </Pressable>
      ))}
    </div>
  )
}
