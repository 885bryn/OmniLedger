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

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function DashboardSkeleton() {
  return (
    <section className="space-y-5" aria-label="Loading dashboard">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl border border-border bg-card/70" />
        ))}
      </div>
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-14 animate-pulse rounded-xl bg-muted/80" />
        ))}
      </div>
    </section>
  )
}

function DashboardEmptyState() {
  return (
    <section className="rounded-2xl border border-dashed border-border bg-card/70 p-8 text-center">
      <h2 className="text-lg font-semibold">No due events yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">Add your first asset or commitment to unlock due-first planning on this dashboard.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link to="/items/create/wizard" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Add an item
        </Link>
        <Link to="/events" className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground">
          Open events view
        </Link>
      </div>
    </section>
  )
}

export function DashboardPage() {
  const eventsQuery = useQuery({
    queryKey: queryKeys.dashboard.all,
    queryFn: async () => apiRequest<EventsResponse>('/events?status=pending'),
  })

  const grouped = useMemo(() => {
    const groups = eventsQuery.data?.groups ?? []
    return [...groups]
      .sort(compareGroupsByNearestDue)
      .map((group) => ({
        ...group,
        events: [...group.events].sort(compareByNearestDue),
      }))
  }, [eventsQuery.data])

  const allEvents = useMemo(() => grouped.flatMap((group) => group.events), [grouped])

  const metrics = useMemo(() => {
    const now = Date.now()
    const overdue = allEvents.filter((event) => Date.parse(event.due_date) < now).length
    const thisWeekCount = allEvents.filter((event) => {
      const due = Date.parse(event.due_date)
      if (Number.isNaN(due)) {
        return false
      }

      return due - now <= 7 * 24 * 60 * 60 * 1000 && due >= now
    }).length
    const dueAmount = allEvents.reduce((total, event) => total + Number(event.amount ?? 0), 0)

    return {
      totalDue: allEvents.length,
      overdue,
      thisWeekCount,
      dueAmount,
    }
  }, [allEvents])

  if (eventsQuery.isLoading) {
    return <DashboardSkeleton />
  }

  if (eventsQuery.isError) {
    return (
      <section className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
        Dashboard data could not be loaded. Please refresh and try again.
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Due events</p>
          <p className="mt-2 text-2xl font-semibold">{metrics.totalDue}</p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Overdue</p>
          <p className="mt-2 text-2xl font-semibold text-destructive">{metrics.overdue}</p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Due in 7 days</p>
          <p className="mt-2 text-2xl font-semibold">{metrics.thisWeekCount}</p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Upcoming amount</p>
          <p className="mt-2 text-2xl font-semibold">{formatCurrency(metrics.dueAmount)}</p>
        </article>
      </div>

      {grouped.length === 0 ? (
        <DashboardEmptyState />
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <section key={group.due_date} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-sm font-semibold">{formatDueLabel(group.due_date)}</h2>
                <Link to="/events" className="text-xs font-medium text-primary">
                  Open events
                </Link>
              </div>
              <ul className="mt-3 space-y-2">
                {group.events.slice(0, 4).map((event) => (
                  <li key={event.id} className="rounded-xl border border-border bg-background/80 p-3">
                    <p className="text-sm font-medium">{event.type}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Item {event.item_id} - {event.amount ? formatCurrency(Number(event.amount)) : 'Amount pending'}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}
