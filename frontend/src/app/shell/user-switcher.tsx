import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/auth-context'

export function UserSwitcher() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session, logout } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const identity = session?.username || session?.email || '—'

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
      <span>{t('shell.identityLabel')}</span>
      <span className="max-w-36 truncate font-medium text-foreground" title={session?.email || identity}>
        {identity}
      </span>
      <button
        type="button"
        disabled={isLoggingOut}
        onClick={async () => {
          setIsLoggingOut(true)

          try {
            await logout()
            queryClient.clear()
            navigate('/login', { replace: true })
          } finally {
            setIsLoggingOut(false)
          }
        }}
        className="rounded border border-border px-2 py-1 text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoggingOut ? t('shell.loggingOut') : t('shell.logoutAction')}
      </button>
    </div>
  )
}
