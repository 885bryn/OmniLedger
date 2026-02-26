import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth, type SessionScope } from '../../auth/auth-context'
import { apiRequest, fetchUsers, type TransportUser } from '../../lib/api-client'
import { queryKeys } from '../../lib/query-keys'

type ScopeMode = 'all' | 'owner'

type SessionPayload = {
  session: {
    authenticated: boolean
    scope?: SessionScope | null
  }
}

type AdminScopeContextValue = {
  isAdmin: boolean
  mode: ScopeMode
  lensUserId: string | null
  users: TransportUser[]
  isLoadingUsers: boolean
  isUpdatingScope: boolean
  updateError: string | null
  setAllUsers: () => Promise<void>
  setLensUser: (lensUserId: string) => Promise<void>
}

const AdminScopeContext = createContext<AdminScopeContextValue | null>(null)

const FALLBACK_CONTEXT: AdminScopeContextValue = {
  isAdmin: false,
  mode: 'owner',
  lensUserId: null,
  users: [],
  isLoadingUsers: false,
  isUpdatingScope: false,
  updateError: null,
  setAllUsers: async () => undefined,
  setLensUser: async () => undefined,
}

function deriveScope(isAdmin: boolean, sessionUserId: string | undefined, scope: SessionScope | null): Pick<AdminScopeContextValue, 'mode' | 'lensUserId'> {
  if (!isAdmin) {
    return {
      mode: 'owner',
      lensUserId: sessionUserId ?? null,
    }
  }

  if (!scope) {
    return {
      mode: 'all',
      lensUserId: null,
    }
  }

  return {
    mode: scope.mode === 'owner' ? 'owner' : 'all',
    lensUserId: scope.mode === 'owner' ? scope.lensUserId : null,
  }
}

export function AdminScopeProvider({ children }: { children: ReactNode }) {
  const { session, sessionScope } = useAuth()
  const [mode, setMode] = useState<ScopeMode>('owner')
  const [lensUserId, setLensUserId] = useState<string | null>(session?.id ?? null)
  const [isUpdatingScope, setIsUpdatingScope] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const isAdmin = session?.role === 'admin'

  useEffect(() => {
    const next = deriveScope(isAdmin, session?.id, sessionScope)
    setMode(next.mode)
    setLensUserId(next.lensUserId)
    setUpdateError(null)
  }, [isAdmin, session?.id, sessionScope])

  const usersQuery = useQuery({
    queryKey: queryKeys.users.all,
    queryFn: fetchUsers,
    enabled: Boolean(session?.id),
    staleTime: 30_000,
  })

  const applySessionScope = useCallback((scope: SessionScope | null | undefined) => {
    const next = deriveScope(Boolean(isAdmin), session?.id, scope ?? null)
    setMode(next.mode)
    setLensUserId(next.lensUserId)
  }, [isAdmin, session?.id])

  const updateScope = useCallback(async (payload: { mode: ScopeMode; lens_user_id?: string }) => {
    if (!isAdmin) {
      return
    }

    setIsUpdatingScope(true)
    setUpdateError(null)

    try {
      const response = await apiRequest<SessionPayload>('/auth/admin-scope', {
        method: 'PATCH',
        body: payload,
      })

      applySessionScope(response.session.scope)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update admin scope.'
      setUpdateError(message)
      throw error
    } finally {
      setIsUpdatingScope(false)
    }
  }, [applySessionScope, isAdmin])

  const value = useMemo<AdminScopeContextValue>(() => ({
    isAdmin,
    mode,
    lensUserId,
    users: usersQuery.data?.users ?? [],
    isLoadingUsers: usersQuery.isLoading,
    isUpdatingScope,
    updateError,
    setAllUsers: () => updateScope({ mode: 'all' }),
    setLensUser: (nextLensUserId: string) => updateScope({ mode: 'owner', lens_user_id: nextLensUserId }),
  }), [isAdmin, isUpdatingScope, lensUserId, mode, updateError, updateScope, usersQuery.data?.users, usersQuery.isLoading])

  return <AdminScopeContext.Provider value={value}>{children}</AdminScopeContext.Provider>
}

export function useAdminScope() {
  return useContext(AdminScopeContext) ?? FALLBACK_CONTEXT
}
