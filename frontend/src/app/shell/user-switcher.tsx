import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Pressable } from '@/components/ui/pressable'
import { useAuth } from '../../auth/auth-context'
import { useAdminScope } from '../../features/admin-scope/admin-scope-context'
import { useExportBackup } from '../../features/export/use-export-backup'
import { ConfirmationDialog } from '../../features/ui/confirmation-dialog'
import { useToast } from '../../features/ui/toast-provider'
import { actorSensitiveQueryRoots } from '../../lib/query-keys'

export function UserSwitcher() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { session, logout } = useAuth()
  const { isAdmin, mode, lensUserId, users, isLoadingUsers, isUpdatingScope, updateError, setAllUsers, setLensUser } = useAdminScope()
  const exportBackup = useExportBackup()
  const { push } = useToast()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [pendingExitLensUserId, setPendingExitLensUserId] = useState<string | null>(null)
  const feedbackTimerRef = useRef<number | null>(null)
  const didToastForSuccessRef = useRef(false)

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

  const exportSuccessMessage = useMemo(() => {
    if (isAdmin && mode === 'all') {
      return t('shell.exportBackupSuccessAdminAll', { actor: identity })
    }

    if (isAdmin && lensUserId) {
      return t('shell.exportBackupSuccessAdminLens', { actor: identity, lens: resolveLensLabel(lensUserId) })
    }

    return t('shell.exportBackupSuccessInline')
  }, [identity, isAdmin, lensUserId, mode, t, users])

  const exportErrorMessage = useMemo(() => {
    if (exportBackup.attemptCount >= 2) {
      return t('shell.exportBackupErrorEscalated')
    }

    if (exportBackup.errorKind === 'session') {
      return t('shell.exportBackupErrorSession')
    }

    if (exportBackup.errorKind === 'server') {
      return t('shell.exportBackupErrorServer')
    }

    return t('shell.exportBackupErrorNetwork')
  }, [exportBackup.attemptCount, exportBackup.errorKind, t])

  const handleExportClick = async () => {
    try {
      await exportBackup.triggerExport()
    } catch {
      return
    }
  }

  useEffect(() => {
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = null
    }

    if (exportBackup.phase === 'success') {
      if (!didToastForSuccessRef.current) {
        push({
          message: t('shell.exportBackupSuccessToast'),
          tone: 'success',
          dedupeKey: 'export-success',
          durationMs: 4200,
        })
        didToastForSuccessRef.current = true
      }

      feedbackTimerRef.current = window.setTimeout(() => {
        exportBackup.reset()
      }, 4200)
      return
    }

    if (exportBackup.phase === 'error') {
      feedbackTimerRef.current = window.setTimeout(() => {
        exportBackup.reset()
      }, 4200)
      return
    }

    if (exportBackup.phase === 'idle' || exportBackup.phase === 'pending') {
      didToastForSuccessRef.current = false
    }

    return undefined
  }, [exportBackup, push, t])

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current)
      }
    }
  }, [])

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
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/80 bg-card/90 px-3 py-2 text-xs text-muted-foreground shadow-sm shadow-black/5 dark:shadow-none">
        <span className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t('shell.identityLabel')}</span>
        <span className="max-w-36 truncate font-medium text-foreground" title={session?.email || identity}>
          {identity}
        </span>
        {isAdmin ? (
          <label className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/80 px-2.5 py-1.5 text-[11px] text-muted-foreground">
            <span>Lens</span>
            <select
              aria-label="Admin lens"
              disabled={isLoadingUsers || isUpdatingScope}
              className="min-w-28 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
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
        <Pressable whileTap={exportBackup.isPending ? { scale: 1 } : undefined}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={exportBackup.isPending}
            onClick={() => {
              void handleExportClick()
            }}
          >
            {exportBackup.isPending ? t('shell.exportingBackup') : t('shell.exportBackupAction')}
          </Button>
        </Pressable>
        <Pressable whileTap={isLoggingOut ? { scale: 1 } : undefined}>
          <Button
            type="button"
            variant="outline"
            size="sm"
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
          >
            {isLoggingOut ? t('shell.loggingOut') : t('shell.logoutAction')}
          </Button>
        </Pressable>
        {exportBackup.phase === 'success' ? <span role="status" className="max-w-80 text-[11px] text-emerald-700">{exportSuccessMessage}</span> : null}
        {exportBackup.phase === 'pending' && exportBackup.isLongRunning ? (
          <span role="status" className="max-w-80 text-[11px] text-muted-foreground">
            {t('shell.exportBackupLongRunning')}
          </span>
        ) : null}
        {exportBackup.phase === 'error' ? (
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-2.5 py-1.5 text-[11px] text-destructive">
            <span className="max-w-80">{exportErrorMessage}</span>
            <Pressable>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  void handleExportClick()
                }}
              >
                {t('shell.exportBackupRetryAction')}
              </Button>
            </Pressable>
          </div>
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
