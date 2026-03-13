import { Link } from 'react-router-dom'
import { formatCurrency } from '../../lib/currency'
import { isIncomeItem } from '../../lib/item-display'

type DashboardRecentActivityEvent = {
  id: string
  item_id: string
  type: string
  amount: number | null
  due_date: string
  status: string
  updated_at: string
  completed_at?: string | null
  is_manual_override?: boolean
}

type DashboardRecentActivityItem = {
  id: string
  item_type: string
  type?: string | null
  attributes: Record<string, unknown>
  updated_at: string
}

type DashboardRecentActivityProps = {
  events: DashboardRecentActivityEvent[]
  itemById: Map<string, DashboardRecentActivityItem>
  itemNameById: Map<string, string>
  returnTo: string
  labels: {
    completed: string
    manualOverride: string
    paidOn: (date: string) => string
    amountPending: string
    itemLabel: (itemId: string) => string
  }
}

function formatDateLabel(value: string) {
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

export function DashboardRecentActivity({
  events,
  itemById,
  itemNameById,
  returnTo,
  labels,
}: DashboardRecentActivityProps) {
  return (
    <ul
      className="space-y-2"
      aria-label="Recent Activity list"
      data-testid="dashboard-recent-activity-list"
      data-recent-activity-density="compact"
      data-recent-activity-style="audit-log"
    >
      {events.map((event) => {
        const item = itemById.get(event.item_id)
        const amount = formatEventAmount(event.amount, isIncomeItem(item ?? { item_type: 'Unknown' }))
        const completedOn = formatDateLabel(event.completed_at || event.updated_at || event.due_date)
        const manualOverride = event.is_manual_override === true

        return (
          <li
            key={event.id}
            data-recent-activity-row-id={event.id}
            data-manual-override={manualOverride ? 'true' : 'false'}
            data-recent-activity-variant="audit-log-row"
          >
            <article
              className={[
                'rounded-xl border px-3 py-2.5',
                manualOverride
                  ? 'border-amber-300/80 bg-[linear-gradient(135deg,rgba(255,251,235,0.94),rgba(255,255,255,0.96))]'
                  : 'border-border/60 bg-muted/20',
              ].join(' ')}
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-medium text-foreground">{event.type}</h3>
                    <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                      {labels.completed}
                    </span>
                    {manualOverride ? (
                      <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-amber-900">
                        {labels.manualOverride}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{labels.paidOn(completedOn)}</p>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <Link
                    to={`/items/${event.item_id}`}
                    state={{ from: returnTo }}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {itemNameById.get(event.item_id) ?? labels.itemLabel(event.item_id)}
                  </Link>
                  <span aria-hidden="true">•</span>
                  <span>{amount ?? labels.amountPending}</span>
                </div>
              </div>
            </article>
          </li>
        )
      })}
    </ul>
  )
}
