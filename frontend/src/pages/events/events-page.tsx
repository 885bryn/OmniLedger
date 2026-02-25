import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiRequest } from '../../lib/api-client'
import { compareByNearestDue, compareGroupsByNearestDue } from '../../lib/date-ordering'
import { queryKeys } from '../../lib/query-keys'

type EventRow = {
  id: string
  item_id: string
  type: string
  amount: number | null
  due_date: string
  status: string
  updated_at: string
}

type EventGroup = {
  due_date: string
  events: EventRow[]
}

type EventsResponse = {
  groups: EventGroup[]
  total_count: number
}

function formatDueLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatCurrency(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return 'Amount pending'
  }

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function EventsSkeleton() {
  return (
    <section className="space-y-4" aria-label="Loading events">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-border bg-card p-4">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 2 }).map((__, row) => (
              <div key={row} className="h-12 animate-pulse rounded-xl bg-muted/80" />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

function EventsEmptyState() {
  return (
    <section className="rounded-2xl border border-dashed border-border bg-card/70 p-8 text-center">
      <h1 className="text-lg font-semibold">No pending events</h1>
      <p className="mt-2 text-sm text-muted-foreground">You are caught up. Add a new item to generate upcoming timeline obligations.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link to="/items/create/wizard" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Create item
        </Link>
        <Link to="/dashboard" className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground">
          Return to dashboard
        </Link>
      </div>
    </section>
  )
}

export function EventsPage() {
  const eventsQuery = useQuery({
    queryKey: queryKeys.events.list({ status: 'pending' }),
    queryFn: async () => apiRequest<EventsResponse>('/events?status=pending'),
  })

  const groups = useMemo(() => {
    const source = eventsQuery.data?.groups ?? []

    return [...source]
      .sort(compareGroupsByNearestDue)
      .map((group) => ({
        ...group,
        events: [...group.events].sort(compareByNearestDue),
      }))
  }, [eventsQuery.data])

  if (eventsQuery.isLoading) {
    return <EventsSkeleton />
  }

  if (eventsQuery.isError) {
    return (
      <section className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
        Events could not be loaded. Please refresh and try again.
      </section>
    )
  }

  if (groups.length === 0) {
    return <EventsEmptyState />
  }

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h1 className="text-xl font-semibold">Due events</h1>
        <p className="mt-1 text-sm text-muted-foreground">Nearest due groups are shown first so completion actions stay focused on what needs attention now.</p>
      </header>

      {groups.map((group) => (
        <section key={group.due_date} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">{formatDueLabel(group.due_date)}</h2>
          <ul className="mt-3 space-y-2">
            {group.events.map((event) => (
              <li key={event.id} className="flex flex-col gap-3 rounded-xl border border-border bg-background/80 p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium">{event.type}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Item {event.item_id}</p>
                </div>
                <div className="text-sm font-medium">{formatCurrency(event.amount)}</div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  )
}
