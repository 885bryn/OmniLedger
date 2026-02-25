import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { apiRequest } from '../../lib/api-client'
import { queryKeys } from '../../lib/query-keys'

type ActivityRow = {
  id: string
  user_id: string
  action: string
  entity: string
  timestamp: string
}

type ActivityResponse = {
  item_id: string
  activity: ActivityRow[]
}

type ItemActivityTimelineProps = {
  itemId: string
}

function formatTimestamp(value: string) {
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed)
}

export function ItemActivityTimeline({ itemId }: ItemActivityTimelineProps) {
  const { t } = useTranslation()
  const activityQuery = useQuery({
    queryKey: queryKeys.items.activity(itemId),
    queryFn: async () => apiRequest<ActivityResponse>(`/items/${itemId}/activity?limit=25`),
  })

  if (activityQuery.isLoading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm" aria-label="Loading activity">
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-10 animate-pulse rounded-xl bg-muted/80" />
          ))}
        </div>
      </section>
    )
  }

  if (activityQuery.isError) {
    return (
      <section className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {t('items.activity.loadError')}
      </section>
    )
  }

  const rows = activityQuery.data?.activity ?? []
  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card/60 p-5 text-sm text-muted-foreground">
        {t('items.activity.empty')}
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-border bg-background/80 px-3 py-2">
            <p className="text-sm font-medium">{row.action}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {row.entity} - {formatTimestamp(row.timestamp)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
