import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { fetchUsers, getActiveActorUserId, setActiveActorUserId } from '../../lib/api-client'
import { actorSensitiveQueryRoots, queryKeys } from '../../lib/query-keys'

const ACTIVE_USER_STORAGE_KEY = 'hact.active-user-id'

function readStoredActorId() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem(ACTIVE_USER_STORAGE_KEY)
}

function persistActorId(userId: string | null) {
  if (typeof window === 'undefined') {
    return
  }

  if (!userId) {
    window.localStorage.removeItem(ACTIVE_USER_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(ACTIVE_USER_STORAGE_KEY, userId)
}

export function UserSwitcher() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [activeUserId, setActiveUserId] = useState<string | null>(() => getActiveActorUserId())

  const applyActorSelection = useCallback(async (nextUserId: string | null) => {
    const previousUserId = getActiveActorUserId()

    setActiveUserId(nextUserId)

    if (previousUserId === nextUserId) {
      setActiveActorUserId(nextUserId)
      persistActorId(nextUserId)
      return
    }

    await Promise.all(
      actorSensitiveQueryRoots.map(async (queryKey) => {
        await queryClient.cancelQueries({ queryKey })
        queryClient.removeQueries({ queryKey })
      }),
    )

    setActiveActorUserId(nextUserId)
    persistActorId(nextUserId)

    await Promise.all(
      actorSensitiveQueryRoots.map((queryKey) =>
        queryClient.refetchQueries({
          queryKey,
          type: 'active',
        }),
      ),
    )
  }, [queryClient])

  const usersQuery = useQuery({
    queryKey: queryKeys.users.all,
    queryFn: async () => {
      const result = await fetchUsers()
      return result.users
    },
  })

  const users = usersQuery.data ?? []

  const validActorIds = useMemo(() => new Set(users.map((user) => user.id)), [users])

  useEffect(() => {
    if (usersQuery.isLoading) {
      return
    }

    if (!users.length) {
      void applyActorSelection(null)
      return
    }

    const storedActorId = readStoredActorId()
    const currentActor = getActiveActorUserId()

    if (currentActor && validActorIds.has(currentActor)) {
      setActiveUserId(currentActor)
      setActiveActorUserId(currentActor)
      persistActorId(currentActor)
      return
    }

    if (storedActorId && validActorIds.has(storedActorId)) {
      void applyActorSelection(storedActorId)
      return
    }

    const fallbackActorId = users[0]?.id ?? null
    void applyActorSelection(fallbackActorId)
  }, [applyActorSelection, users, usersQuery.isLoading, validActorIds])

  const isDisabled = usersQuery.isLoading || users.length === 0

  return (
    <label className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
      <span>{t('userSwitcher.actorLabel')}</span>
      <select
        value={activeUserId ?? ''}
        disabled={isDisabled}
        onChange={(event) => {
          const nextUserId = event.target.value || null
          void applyActorSelection(nextUserId)
        }}
        className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-70"
      >
        {usersQuery.isLoading ? <option value="">{t('userSwitcher.loading')}</option> : null}
        {!usersQuery.isLoading && users.length === 0 ? <option value="">{t('userSwitcher.noUsers')}</option> : null}
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.username}
          </option>
        ))}
      </select>
    </label>
  )
}
