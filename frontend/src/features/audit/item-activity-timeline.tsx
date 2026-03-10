import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ApiClientError, apiRequest, type TransportItemActivityResponse, type TransportItemActivityRow } from '../../lib/api-client'
import { formatNullableCurrency } from '../../lib/currency'
import { queryKeys } from '../../lib/query-keys'

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

function formatDate(value: string | null) {
  if (!value) {
    return null
  }

  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed)
}

function formatCurrency(value: string | null) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? formatNullableCurrency(parsed) : null
}

export function ItemActivityTimeline({ itemId }: ItemActivityTimelineProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const getActorLabel = (row: TransportItemActivityRow) =>
    row.actor_label || row.actor_user_id || row.user_id || t('items.activity.attribution.unknownActor')
  const getLensLabel = (row: TransportItemActivityRow) => {
    if (row.lens_label) {
      return row.lens_label
    }

    if (row.lens_attribution_state === 'all_data') {
      return 'All users'
    }

    return row.lens_user_id || (row.lens_attribution_state === 'legacy_missing'
      ? t('items.activity.attribution.legacyLens')
      : t('items.activity.attribution.unknownActor'))
  }

  const getStableActorId = (row: TransportItemActivityRow) => row.actor_user_id || row.user_id || 'unknown'

  const getStableLensId = (row: TransportItemActivityRow) => {
    if (row.lens_user_id) {
      return row.lens_user_id
    }

    if (row.lens_attribution_state === 'all_data') {
      return 'null (all-data)'
    }

    return 'null (legacy)'
  }

  const activityQuery = useQuery({
    queryKey: queryKeys.items.activity(itemId),
    queryFn: async () => apiRequest<TransportItemActivityResponse>(`/items/${itemId}/activity?limit=25`),
  })

  const undoMutation = useMutation({
    mutationFn: async (eventId: string) =>
      apiRequest(`/events/${eventId}/undo-complete`, {
        method: 'PATCH',
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.items.activity(itemId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(itemId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.events.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ])
    },
  })

  const rows = activityQuery.data?.activity ?? []
  const undoableEventIds = useMemo(() => {
    const undone = new Set<string>()
    const ids = new Set<string>()

    rows.forEach((row) => {
      if (!row.entity_id || row.entity_type !== 'event') {
        return
      }

      if (row.action === 'event.reopened') {
        undone.add(row.entity_id)
        return
      }

      if (row.action === 'event.completed' && row.event_status === 'Completed' && !undone.has(row.entity_id)) {
        ids.add(row.entity_id)
      }
    })

    return ids
  }, [rows])

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
            <p className="text-sm font-medium">
              {row.action === 'event.completed'
                ? t('items.activity.actions.eventCompleted')
                : row.action === 'event.reopened'
                  ? t('items.activity.actions.eventCompletionUndone')
                  : row.action === 'item.deleted'
                      ? t('items.activity.actions.itemDeleted')
                      : row.action === 'item.updated'
                        ? t('items.activity.actions.itemUpdated')
                        : row.action === 'item.created'
                          ? t('items.activity.actions.itemCreated')
                          : row.action === 'item.restored'
                            ? t('items.activity.actions.itemRestored')
                        : row.action === 'export.backup.succeeded'
                          ? 'Export backup succeeded'
                          : row.action === 'export.backup.failed'
                            ? 'Export backup failed'
                        : row.action}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('items.activity.attribution.tuple', {
                actor: getActorLabel(row),
                lens: getLensLabel(row),
              })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {row.entity_type === 'event'
                ? t('items.activity.eventMeta', {
                    type: row.event_type || t('items.activity.unknownEventType'),
                    amount: formatCurrency(row.event_amount) || t('events.amountPending'),
                    dueDate: formatDate(row.event_due_date) || '-',
                    at: formatTimestamp(row.timestamp),
                  })
                : row.entity_type === 'export'
                  ? `Export outcome: ${row.action === 'export.backup.failed' ? 'Failed' : 'Succeeded'} - ${formatTimestamp(row.timestamp)}`
                : t('items.activity.itemMeta', { at: formatTimestamp(row.timestamp) })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {`Actor ID: ${getStableActorId(row)} | Lens ID: ${getStableLensId(row)}`}
            </p>

            {row.entity_type === 'event' && row.entity_id && undoableEventIds.has(row.entity_id) ? (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  disabled={undoMutation.isPending}
                  onClick={() => {
                    undoMutation.mutate(row.entity_id as string)
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {undoMutation.isPending ? t('items.activity.undoPending') : t('items.activity.undoAction')}
                </button>
              </div>
            ) : null}

            {undoMutation.isError && row.entity_type === 'event' ? (
              <p className="mt-2 text-xs text-destructive">
                {undoMutation.error instanceof ApiClientError ? undoMutation.error.message : t('items.activity.undoError')}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
