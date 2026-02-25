import { useTranslation } from 'react-i18next'

export function SessionExpiredBanner() {
  const { t } = useTranslation()

  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border border-amber-500/50 bg-amber-100/80 px-4 py-3 text-sm text-amber-900 shadow-sm"
    >
      <p className="font-semibold">{t('auth.sessionExpired.title')}</p>
      <p className="mt-1">{t('auth.sessionExpired.body')}</p>
    </div>
  )
}
