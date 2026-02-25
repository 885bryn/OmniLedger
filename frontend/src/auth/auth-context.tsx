import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ApiClientError, SESSION_EXPIRED_EVENT, apiRequest } from '../lib/api-client'

const DEFAULT_AUTH_REDIRECT = '/dashboard'
const RETURN_TO_STORAGE_KEY = 'hact.auth.return-to'
const SESSION_EXPIRED_NOTICE_KEY = 'hact.auth.session-expired'

type SessionPayload = {
  user: {
    id: string
    username: string
    email: string
  } | null
  session: {
    authenticated: boolean
  }
}

type LoginInput = {
  email: string
  password: string
  returnTo?: string | null
}

type RegisterInput = {
  email: string
  password: string
  returnTo?: string | null
}

type AuthContextValue = {
  session: SessionPayload['user']
  loading: boolean
  sessionExpired: boolean
  sessionExpiredReturnTo: string | null
  login: (input: LoginInput) => Promise<{ redirectTo: string }>
  register: (input: RegisterInput) => Promise<{ redirectTo: string }>
  logout: () => Promise<void>
  storeReturnTo: (value: string | null | undefined) => string | null
  consumeReturnTo: (preferred?: string | null) => string
  completeSessionExpiredRedirect: () => void
  clearSessionExpired: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function isSafeReturnTo(value: string | null | undefined): value is string {
  if (!value || typeof value !== 'string') {
    return false
  }

  if (!value.startsWith('/')) {
    return false
  }

  if (value.startsWith('//')) {
    return false
  }

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value)) {
    return false
  }

  return true
}

function persistReturnTo(value: string | null) {
  if (typeof window === 'undefined') {
    return
  }

  if (!value) {
    window.sessionStorage.removeItem(RETURN_TO_STORAGE_KEY)
    return
  }

  window.sessionStorage.setItem(RETURN_TO_STORAGE_KEY, value)
}

function readStoredReturnTo() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.sessionStorage.getItem(RETURN_TO_STORAGE_KEY)
}

function persistSessionExpiredNotice(value: boolean) {
  if (typeof window === 'undefined') {
    return
  }

  if (!value) {
    window.sessionStorage.removeItem(SESSION_EXPIRED_NOTICE_KEY)
    return
  }

  window.sessionStorage.setItem(SESSION_EXPIRED_NOTICE_KEY, '1')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionPayload['user']>(null)
  const [loading, setLoading] = useState(true)
  const [sessionExpiredReturnTo, setSessionExpiredReturnTo] = useState<string | null>(null)

  const clearSessionExpired = useCallback(() => {
    setSessionExpiredReturnTo(null)
  }, [])

  const completeSessionExpiredRedirect = useCallback(() => {
    setSession(null)
    setSessionExpiredReturnTo(null)
  }, [])

  const refreshSession = useCallback(async () => {
    try {
      const response = await apiRequest<SessionPayload>('/auth/session')
      setSession(response.session.authenticated ? response.user : null)
    } catch {
      setSession(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshSession()
  }, [refreshSession])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    function onSessionExpired() {
      if (window.location.pathname === '/login' || window.location.pathname === '/register') {
        return
      }

      setSessionExpiredReturnTo((current) => {
        if (current) {
          return current
        }

        const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`
        const sanitized = isSafeReturnTo(returnTo) ? returnTo : DEFAULT_AUTH_REDIRECT
        persistReturnTo(sanitized)
        persistSessionExpiredNotice(true)
        return sanitized
      })

      setSession(null)

    }

    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired)
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired)
    }
  }, [])

  const storeReturnTo = useCallback((value: string | null | undefined) => {
    const sanitized = isSafeReturnTo(value) ? value : null
    persistReturnTo(sanitized)
    return sanitized
  }, [])

  const consumeReturnTo = useCallback(
    (preferred?: string | null) => {
      const sanitizedPreferred = isSafeReturnTo(preferred) ? preferred : null
      const stored = readStoredReturnTo()
      const sanitizedStored = isSafeReturnTo(stored) ? stored : null
      const resolved = sanitizedPreferred || sanitizedStored || DEFAULT_AUTH_REDIRECT
      persistReturnTo(null)
      return resolved
    },
    [],
  )

  const login = useCallback(
    async ({ email, password, returnTo }: LoginInput) => {
      const payload = await apiRequest<SessionPayload>('/auth/login', {
        method: 'POST',
        body: {
          email,
          password,
        },
      })

      setSession(payload.user)
      clearSessionExpired()
      persistSessionExpiredNotice(false)
      return { redirectTo: consumeReturnTo(returnTo) }
    },
    [clearSessionExpired, consumeReturnTo],
  )

  const register = useCallback(
    async ({ email, password, returnTo }: RegisterInput) => {
      const payload = await apiRequest<SessionPayload>('/auth/register', {
        method: 'POST',
        body: {
          email,
          password,
        },
      })

      setSession(payload.user)
      clearSessionExpired()
      persistSessionExpiredNotice(false)
      return { redirectTo: consumeReturnTo(returnTo) }
    },
    [clearSessionExpired, consumeReturnTo],
  )

  const logout = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
      })
    } catch (error) {
      if (!(error instanceof ApiClientError) || error.status !== 401) {
        throw error
      }
    } finally {
      persistReturnTo(null)
      clearSessionExpired()
      persistSessionExpiredNotice(false)
      setSession(null)
    }
  }, [clearSessionExpired])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      sessionExpired: Boolean(sessionExpiredReturnTo),
      sessionExpiredReturnTo,
      login,
      register,
      logout,
      storeReturnTo,
      consumeReturnTo,
      completeSessionExpiredRedirect,
      clearSessionExpired,
    }),
    [clearSessionExpired, completeSessionExpiredRedirect, consumeReturnTo, loading, login, logout, register, session, sessionExpiredReturnTo, storeReturnTo],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('Auth context is missing. Wrap app with AuthProvider.')
  }

  return context
}

export function sanitizeReturnTo(value: string | null | undefined) {
  return isSafeReturnTo(value) ? value : null
}

export { DEFAULT_AUTH_REDIRECT }
