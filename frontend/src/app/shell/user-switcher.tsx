import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/auth-context'
import { useAdminScope } from '../../features/admin-scope/admin-scope-context'
import { useExportBackup } from '../../features/export/use-export-backup'
import { ConfirmationDialog } from '../../features/ui/confirmation-dialog'
import { actorSensitiveQueryRoots } from '../../lib/query-keys'

export function UserSwitcher() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { session, logout } = useAuth()
  const { isAdmin, mode, lensUserId, users, isLoadingUsers, isUpdatingScope, updateError, setAllUsers, setLensUser } = useAdminScope()
  const exportBackup = useExportBackup()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [pendingExitLensUserId, setPendingExitLensUserId] = useState<string | null>(null)

  const identity = session?.username || session?.email || '—'

  const hardResetAndRefetch = async () => {
    queryClient.clear()
    await Promise.all(actorSensitiveQueryRoots.map((root) => queryClient.invalidateQueries({ queryKey: root, refetchType: 'active' })))
    navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true })
  }

  const resolveLensLabel = (userId: string) => {
    const matchedUser = users.find((user) => user.id === userId)
    return matchedUser?.username || matchedUser?.email || userId
  }

  const confirmAdminExit = async () => {
    if (!pendingExitLensUserId) {
      return
    }

    await setLensUser(pendingExitLensUserId)
    await hardResetAndRefetch()
    setPendingExitLensUserId(null)
  }

  return (
    <>
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
                  await hardResetAndRefetch()
                  return
                }

                if (mode === 'all') {
                  setPendingExitLensUserId(event.target.value)
                  return
                }

                await setLensUser(event.target.value)
                await hardResetAndRefetch()
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
          disabled={exportBackup.isPending}
          onClick={async () => {
            try {
              await exportBackup.triggerExport()
            } catch {
              return
            }
          }}
          className="rounded border border-border px-2 py-1 text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {exportBackup.isPending ? t('shell.exportingBackup') : t('shell.exportBackupAction')}
        </button>
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
        {exportBackup.isSuccess ? <span role="status" className="max-w-48 truncate text-[11px] text-emerald-700">{t('shell.exportBackupSuccess')}</span> : null}
        {exportBackup.isError ? (
          <span role="alert" className="max-w-48 truncate text-[11px] text-destructive">
            {exportBackup.error?.message || t('shell.exportBackupError')}
          </span>
        ) : null}
        {updateError ? <span role="alert" className="max-w-48 truncate text-[11px] text-destructive">{updateError}</span> : null}
      </div>
      <ConfirmationDialog
        open={Boolean(pendingExitLensUserId)}
        title="Exit admin all-data mode?"
        description={`Confirm exit before changing lens to ${pendingExitLensUserId ? resolveLensLabel(pendingExitLensUserId) : 'selected user'}. Actor: ${identity} | Lens: All users`}
        confirmLabel="Confirm exit"
        cancelLabel="Stay in admin mode"
        pending={isUpdatingScope}
        onConfirm={() => {
          void confirmAdminExit()
        }}
        onCancel={() => {
          setPendingExitLensUserId(null)
        }}
      />
    </>
  )
}
