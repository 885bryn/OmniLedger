import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/button'
import { formatCurrency } from '../../lib/currency'
import { isIncomeItem } from '../../lib/item-display'

type DashboardActionEvent = {
  id: string
  item_id: string
  type: string
  amount: number | null
  due_date: string
}

type DashboardActionItem = {
  id: string
  item_type: string
  type?: string | null
  attributes: Record<string, unknown>
  updated_at: string
}

type DashboardActionQueueProps = {
  events: DashboardActionEvent[]
  itemById: Map<string, DashboardActionItem>
  itemNameById: Map<string, string>
  returnTo: string
  labels: {
    overdue: string
    upcoming: string
    dueDate: string
    amount: string
    linkedItem: string
    amountPending: string
    openEvents: string
    upcomingPreview: (values: { shown: number; total: number }) => string
    showAllUpcoming: (values: { total: number }) => string
    showFewerUpcoming: string
    itemLabel: (itemId: string) => string
    ageBucket: (bucket: '1-7d' | '8-30d' | '30+d') => string
  }
}

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_UPCOMING_VISIBLE_ROWS = 6

function parseCalendarDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function dueOffsetInDays(dueDate: string, today: Date) {
  const due = parseCalendarDate(dueDate)
  if (!due) {
    return null
  }

  const diff = startOfDay(due).getTime() - startOfDay(today).getTime()
  return Math.round(diff / DAY_MS)
}

function formatDateLabel(value: string) {
  const parsed = parseCalendarDate(value)
  if (!parsed) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed)
}

function formatEventAmount(value: number | null, isIncome: boolean) {
  if (value === null || Number.isNaN(value)) {
    return null
  }

  const formatted = formatCurrency(Number(value))
  return isIncome ? `+${formatted}` : formatted
}

function resolveOverdueAgeBucket(daysOverdue: number) {
  if (daysOverdue <= 7) {
    return '1-7d' as const
  }

  if (daysOverdue <= 30) {
    return '8-30d' as const
  }

  return '30+d' as const
}

export function DashboardActionQueue({
  events,
  itemById,
  itemNameById,
  returnTo,
  labels,
}: DashboardActionQueueProps) {
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)
  const today = new Date(Date.now())
  const queueRows = events
    .map((event) => ({ event, dayOffset: dueOffsetInDays(event.due_date, today) }))
    .filter((row) => row.dayOffset !== null)

  const overdueRows = queueRows
    .filter((row) => row.dayOffset < 0)
    .sort((left, right) => left.dayOffset - right.dayOffset)

  const upcomingRows = queueRows
    .filter((row) => row.dayOffset >= 0 && row.dayOffset <= 14)
    .sort((left, right) => left.dayOffset - right.dayOffset)
  const visibleUpcomingRows = showAllUpcoming ? upcomingRows : upcomingRows.slice(0, DEFAULT_UPCOMING_VISIBLE_ROWS)
  const isUpcomingCapped = upcomingRows.length > DEFAULT_UPCOMING_VISIBLE_ROWS

  return (
    <div className="space-y-4" data-dashboard-action-queue="true">
      <section data-testid="dashboard-action-queue-overdue" className="space-y-3">
        <header className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-destructive">{labels.overdue}</h3>
          <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
            {overdueRows.length}
          </span>
        </header>

        {overdueRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">0</p>
        ) : (
          <ul className="space-y-2" aria-label={`${labels.overdue} queue`}>
            {overdueRows.map((row) => {
              const item = itemById.get(row.event.item_id)
              const amount = formatEventAmount(row.event.amount, isIncomeItem(item ?? { item_type: 'Unknown' }))
              const ageBucket = resolveOverdueAgeBucket(Math.abs(row.dayOffset))

              return (
                <li key={row.event.id} data-testid="dashboard-action-queue-row" data-action-queue-row="overdue">
                  <article className="rounded-xl border border-red-200 bg-red-50/40 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{row.event.type}</p>
                      <span className="rounded-full border border-red-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-red-700">
                        {labels.ageBucket(ageBucket)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{labels.dueDate}: {formatDateLabel(row.event.due_date)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                      <span>{labels.amount}: {amount ?? labels.amountPending}</span>
                      <span>{labels.linkedItem}:</span>
                      <Link to={`/items/${row.event.item_id}`} state={{ from: returnTo }} className="font-medium text-primary underline-offset-2 hover:underline">
                        {itemNameById.get(row.event.item_id) ?? labels.itemLabel(row.event.item_id)}
                      </Link>
                      <Link to="/events" state={{ from: returnTo }} className="font-medium text-primary underline-offset-2 hover:underline">
                        {labels.openEvents}
                      </Link>
                    </div>
                  </article>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section data-testid="dashboard-action-queue-upcoming" className="space-y-3">
        <header className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">{labels.upcoming}</h3>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            {upcomingRows.length}
          </span>
        </header>

        {upcomingRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">0</p>
        ) : (
          <div className="space-y-3" data-dashboard-upcoming-cap={isUpcomingCapped ? 'true' : 'false'}>
            {isUpcomingCapped ? (
              <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/15 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {labels.upcomingPreview({ shown: visibleUpcomingRows.length, total: upcomingRows.length })}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-expanded={showAllUpcoming}
                  className="h-auto justify-start px-0 py-0 text-xs font-semibold sm:justify-end"
                  onClick={() => setShowAllUpcoming((current) => !current)}
                >
                  {showAllUpcoming ? labels.showFewerUpcoming : labels.showAllUpcoming({ total: upcomingRows.length })}
                </Button>
              </div>
            ) : null}

            <ul className="space-y-2" aria-label={`${labels.upcoming} queue`}>
              {visibleUpcomingRows.map((row) => {
                const item = itemById.get(row.event.item_id)
                const amount = formatEventAmount(row.event.amount, isIncomeItem(item ?? { item_type: 'Unknown' }))

                return (
                  <li key={row.event.id} data-testid="dashboard-action-queue-row" data-action-queue-row="upcoming">
                    <article className="rounded-xl border border-border/70 bg-card p-3">
                      <p className="text-sm font-semibold text-foreground">{row.event.type}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{labels.dueDate}: {formatDateLabel(row.event.due_date)}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                        <span>{labels.amount}: {amount ?? labels.amountPending}</span>
                        <span>{labels.linkedItem}:</span>
                        <Link to={`/items/${row.event.item_id}`} state={{ from: returnTo }} className="font-medium text-primary underline-offset-2 hover:underline">
                          {itemNameById.get(row.event.item_id) ?? labels.itemLabel(row.event.item_id)}
                        </Link>
                        <Link to="/events" state={{ from: returnTo }} className="font-medium text-primary underline-offset-2 hover:underline">
                          {labels.openEvents}
                        </Link>
                      </div>
                    </article>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
