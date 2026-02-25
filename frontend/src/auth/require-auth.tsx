import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth-context'

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { session, loading, storeReturnTo } = useAuth()

  if (loading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6 text-sm text-muted-foreground">
        Loading session...
      </div>
    )
  }

  if (!session) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`
    const sanitized = storeReturnTo(returnTo)
    const query = sanitized ? `?returnTo=${encodeURIComponent(sanitized)}` : ''
    return <Navigate to={`/login${query}`} replace />
  }

  return <>{children}</>
}
