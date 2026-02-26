type ChipUser = {
  id: string
  username?: string | null
  email?: string | null
}

type ResolveTargetUserAttributionInput = {
  isAdmin: boolean
  mode: 'all' | 'owner'
  lensUserId: string | null
  users: ChipUser[]
  actorUsername?: string | null
  actorEmail?: string | null
}

type TargetUserAttribution = {
  actorLabel: string
  lensLabel: string
}

type TargetUserChipProps = TargetUserAttribution & {
  className?: string
}

function resolveFallbackLabel(primary: string | null | undefined, secondary: string | null | undefined, fallback: string) {
  return primary || secondary || fallback
}

export function resolveTargetUserAttribution(input: ResolveTargetUserAttributionInput): TargetUserAttribution | null {
  if (!input.isAdmin) {
    return null
  }

  const actorLabel = resolveFallbackLabel(input.actorUsername, input.actorEmail, 'unknown')

  if (input.mode === 'all') {
    return {
      actorLabel,
      lensLabel: 'All users',
    }
  }

  const targetUser = input.users.find((user) => user.id === input.lensUserId)

  return {
    actorLabel,
    lensLabel: resolveFallbackLabel(targetUser?.username, targetUser?.email, input.lensUserId || 'unknown'),
  }
}

export function TargetUserChip({ actorLabel, lensLabel, className = '' }: TargetUserChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 ${className}`.trim()}
      data-testid="target-user-chip"
    >
      Actor: {actorLabel} | Lens: {lensLabel}
    </span>
  )
}
