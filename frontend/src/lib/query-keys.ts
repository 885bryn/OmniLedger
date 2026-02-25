export const queryKeys = {
  users: {
    all: ['users'] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
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
