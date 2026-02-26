import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/auth-context'
import { useAdminScope } from '../../features/admin-scope/admin-scope-context'

export function UserSwitcher() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session, logout } = useAuth()
  const { isAdmin, mode, lensUserId, users, isLoadingUsers, isUpdatingScope, updateError, setAllUsers, setLensUser } = useAdminScope()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const identity = session?.username || session?.email || '—'

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
      <span>{t('shell.identityLabel')}</span>
      <span className="max-w-36 truncate font-medium text-foreground" title={session?.email || identity}>
        {identity}
      </span>
      {isAdmin ? (
        <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <span>Lens</span>
          <select
            aria-label="Admin lens"
            disabled={isLoadingUsers || isUpdatingScope}
            className="min-w-28 rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
            value={mode === 'all' ? 'all' : lensUserId ?? 'all'}
            onChange={async (event) => {
              if (event.target.value === 'all') {
                await setAllUsers()
                return
              }

              await setLensUser(event.target.value)
            }}
          >
            <option value="all">All users</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.username || user.email}
              </option>
            ))}
          </select>
        </label>
      ) : null}
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
      {updateError ? <span role="alert" className="max-w-48 truncate text-[11px] text-destructive">{updateError}</span> : null}
    </div>
  )
}
