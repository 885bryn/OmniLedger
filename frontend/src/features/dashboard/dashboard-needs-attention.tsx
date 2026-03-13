import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CompleteEventRowAction } from '../events/complete-event-row-action'
import { formatCurrency } from '../../lib/currency'
import { isIncomeItem } from '../../lib/item-display'

type DashboardAttentionEvent = {
  id: string
  item_id: string
  type: string
  amount: number | null
  due_date: string
  status: string
  updated_at: string
}

type DashboardAttentionItem = {
  id: string
  item_type: string
  type?: string | null
  attributes: Record<string, unknown>
  updated_at: string
}

type DashboardNeedsAttentionProps = {
  events: DashboardAttentionEvent[]
  itemById: Map<string, DashboardAttentionItem>
  itemNameById: Map<string, string>
  returnTo: string
  previewLimit?: number
  labels: {
    overdue: string
    dueSoon: string
    dueDate: string
    amount: string
    linkedItem: string
    amountPending: string
    itemLabel: (itemId: string) => string
    openEvents: string
    filterAll: string
    filterOverdue: string
    filterDueSoon: string
    totalRows: string
    emptyForFilter: string
    previewHint: (shown: number, total: number) => string
  }
}

type AttentionFilter = 'all' | 'overdue' | 'dueSoon'

function formatDueLabel(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatEventAmount(value: number | null, isIncome: boolean) {
  if (value === null || Number.isNaN(value)) {
    return null
  }

  const formatted = formatCurrency(Number(value))
  return isIncome ? `+${formatted}` : formatted
}

export function DashboardNeedsAttention({
  events,
  itemById,
  itemNameById,
  returnTo,
  previewLimit,
  labels,
}: DashboardNeedsAttentionProps) {
  const today = Date.now()
  const [activeFilter, setActiveFilter] = useState<AttentionFilter>('all')

  const overdueEvents = useMemo(
    () => events.filter((event) => Date.parse(event.due_date) < today),
    [events, today],
  )

  const dueSoonEvents = useMemo(
    () => events.filter((event) => Date.parse(event.due_date) >= today),
    [events, today],
  )

  const filteredEvents = useMemo(() => {
    if (activeFilter === 'overdue') {
      return overdueEvents
    }

    if (activeFilter === 'dueSoon') {
      return dueSoonEvents
    }

    return events
  }, [activeFilter, dueSoonEvents, events, overdueEvents])

  const maxRows = Number.isFinite(previewLimit) && Number(previewLimit) > 0
    ? Math.floor(Number(previewLimit))
    : filteredEvents.length

  const visibleEvents = filteredEvents.slice(0, maxRows)
  const hiddenCount = filteredEvents.length - visibleEvents.length

  const filterButtons: Array<{ key: AttentionFilter; label: string; count: number }> = [
    { key: 'all', label: labels.filterAll, count: events.length },
    { key: 'overdue', label: labels.filterOverdue, count: overdueEvents.length },
    { key: 'dueSoon', label: labels.filterDueSoon, count: dueSoonEvents.length },
  ]

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{labels.totalRows}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{labels.overdue}: {overdueEvents.length}</span>
            <span aria-hidden="true">•</span>
            <span>{labels.dueSoon}: {dueSoonEvents.length}</span>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2" role="tablist" aria-label="Needs Attention filters">
          {filterButtons.map((filter) => {
            const isActive = filter.key === activeFilter

            return (
              <button
                key={filter.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-attention-filter={filter.key}
                onClick={() => setActiveFilter(filter.key)}
                className={[
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  isActive
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                <span>{filter.label}</span>
                <span className="rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] leading-none">{filter.count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {visibleEvents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.emptyForFilter}</p>
      ) : (
        <ul className="space-y-3" aria-label="Needs Attention list">
          {visibleEvents.map((event) => {
            const overdue = Date.parse(event.due_date) < today
            const item = itemById.get(event.item_id)
            const amount = formatEventAmount(event.amount, isIncomeItem(item ?? { item_type: 'Unknown' }))

            return (
              <li key={event.id} data-attention-row-id={event.id} data-overdue={overdue ? 'true' : 'false'}>
                <article
                  className={[
                    'rounded-2xl border px-4 py-4 shadow-sm',
                    overdue
                      ? 'border-red-200 bg-[linear-gradient(135deg,rgba(254,242,242,0.98),rgba(255,255,255,0.98))]'
                      : 'border-border/70 bg-card/95',
                  ].join(' ')}
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground md:text-base">{event.type}</h3>
                        <span
                          className={[
                            'rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em]',
                            overdue
                              ? 'border-red-300 bg-red-50 text-red-700'
                              : 'border-sky-300 bg-sky-50 text-sky-700',
                          ].join(' ')}
                        >
                          {overdue ? labels.overdue : labels.dueSoon}
                        </span>
                      </div>

                      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3 sm:gap-3 sm:text-sm">
                        <div>
                          <p className="font-semibold uppercase tracking-[0.16em] text-muted-foreground/90">{labels.dueDate}</p>
                          <p className="mt-1 text-foreground">{formatDueLabel(event.due_date)}</p>
                        </div>
                        <div>
                          <p className="font-semibold uppercase tracking-[0.16em] text-muted-foreground/90">{labels.amount}</p>
                          <p className="mt-1 text-foreground">{amount ?? labels.amountPending}</p>
                        </div>
                        <div>
                          <p className="font-semibold uppercase tracking-[0.16em] text-muted-foreground/90">{labels.linkedItem}</p>
                          <Link
                            to={`/items/${event.item_id}`}
                            state={{ from: returnTo }}
                            className="mt-1 inline-flex text-foreground underline-offset-2 hover:text-primary hover:underline"
                          >
                            {itemNameById.get(event.item_id) ?? labels.itemLabel(event.item_id)}
                          </Link>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-start xl:pt-0.5">
                      <CompleteEventRowAction eventId={event.id} itemId={event.item_id} />
                    </div>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}

      {hiddenCount > 0 ? (
        <p className="text-xs text-muted-foreground" data-dashboard-attention-truncated="true">
          {labels.previewHint(visibleEvents.length, filteredEvents.length)}{' '}
          <Link
            to="/events"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            {labels.openEvents}
          </Link>
        </p>
      ) : null}
    </div>
  )
}
