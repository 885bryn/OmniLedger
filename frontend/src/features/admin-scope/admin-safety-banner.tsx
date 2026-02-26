import { useAuth } from '../../auth/auth-context'
import { useAdminScope } from './admin-scope-context'
import { resolveTargetUserAttribution } from './target-user-chip'

function resolveActorLabel(username: string | undefined, email: string | undefined) {
  return username || email || 'unknown'
}

export function AdminSafetyBanner() {
  const { session } = useAuth()
  const { isAdmin, mode, lensUserId, users } = useAdminScope()

  if (!isAdmin || mode !== 'all') {
    return null
  }

  const attribution = resolveTargetUserAttribution({
    isAdmin,
    mode,
    lensUserId,
    users,
    actorUsername: session?.username,
    actorEmail: session?.email,
  })
  const actorLabel = attribution?.actorLabel || resolveActorLabel(session?.username, session?.email)
  const lensLabel = attribution?.lensLabel || 'All users'

  return (
    <section className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-900 md:px-6" role="status" aria-live="polite">
      Admin mode active - Actor: {actorLabel} | Lens: {lensLabel}
    </section>
  )
}
