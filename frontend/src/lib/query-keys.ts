export type LensScope = {
  mode: 'all' | 'owner'
  lensUserId: string | null
}

export function lensScopeToParams(scope: LensScope) {
  if (scope.mode === 'owner' && scope.lensUserId) {
    return {
      scope_mode: 'owner',
      lens_user_id: scope.lensUserId,
    }
  }

  return {
    scope_mode: 'all',
  }
}

export function eventListParams(scope: LensScope, status: 'all' | 'pending' | 'completed' = 'all') {
  return {
    status,
    ...lensScopeToParams(scope),
  }
}

export const queryKeys = {
  users: {
    all: ['users'] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    lens: (scope: LensScope) => ['dashboard', 'lens', scope.mode, scope.lensUserId ?? 'all'] as const,
  },
  items: {
    all: ['items'] as const,
    list: (params: Record<string, string | number | boolean | undefined>) =>
      ['items', 'list', params] as const,
    detail: (itemId: string) => ['items', 'detail', itemId] as const,
    activity: (itemId: string) => ['items', 'activity', itemId] as const,
  },
  events: {
    all: ['events'] as const,
    list: (params: Record<string, string | number | boolean | undefined>) =>
      ['events', 'list', params] as const,
  },
} as const

export const actorSensitiveQueryRoots = [queryKeys.dashboard.all, queryKeys.events.all, queryKeys.items.all] as const
