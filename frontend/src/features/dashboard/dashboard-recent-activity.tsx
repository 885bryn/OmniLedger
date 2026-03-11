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
    <ul className="space-y-3" aria-label="Recent Activity list">
      {events.map((event) => {
        const item = itemById.get(event.item_id)
        const amount = formatEventAmount(event.amount, isIncomeItem(item ?? { item_type: 'Unknown' }))
        const completedOn = formatDateLabel(event.completed_at || event.updated_at || event.due_date)
        const manualOverride = event.is_manual_override === true

        return (
          <li key={event.id} data-recent-activity-row-id={event.id} data-manual-override={manualOverride ? 'true' : 'false'}>
            <article
              className={[
                'rounded-2xl border px-4 py-4 shadow-sm',
                manualOverride
                  ? 'border-amber-300 bg-[linear-gradient(135deg,rgba(255,251,235,0.98),rgba(255,255,255,0.98))]'
                  : 'border-border/70 bg-card/95',
              ].join(' ')}
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{event.type}</h3>
                  <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                    {labels.completed}
                  </span>
                  {manualOverride ? (
                    <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-amber-900">
                      {labels.manualOverride}
                    </span>
                  ) : null}
                </div>

                <p className="text-xs text-muted-foreground sm:text-sm">{labels.paidOn(completedOn)}</p>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground sm:text-sm">
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
