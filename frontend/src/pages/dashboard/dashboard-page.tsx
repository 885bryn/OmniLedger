import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { CompleteEventRowAction } from '../../features/events/complete-event-row-action'
import { useAdminScope } from '../../features/admin-scope/admin-scope-context'
import { apiRequest } from '../../lib/api-client'
import { compareByNearestDue, compareGroupsByNearestDue } from '../../lib/date-ordering'
import { getItemDisplayName } from '../../lib/item-display'
import { lensScopeToParams, queryKeys } from '../../lib/query-keys'

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

type ItemRow = {
  id: string
  item_type: string
  attributes: Record<string, unknown>
  updated_at: string
}

type ItemsResponse = {
  items: ItemRow[]
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

function formatDateRange(values: string[]) {
  const parsed = values.map((value) => Date.parse(value)).filter((value) => !Number.isNaN(value))
  if (parsed.length === 0) {
    return null
  }

  const min = new Date(Math.min(...parsed))
  const max = new Date(Math.max(...parsed))
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  })

  if (min.toDateString() === max.toDateString()) {
    return formatter.format(min)
  }

  return `${formatter.format(min)} - ${formatter.format(max)}`
}

function groupMergedEvents(events: EventRow[]): EventGroup[] {
  const grouped = new Map<string, EventRow[]>()

  events.forEach((event) => {
    const key = new Date(event.due_date).toISOString().slice(0, 10)
    const rows = grouped.get(key) ?? []
    rows.push(event)
    grouped.set(key, rows)
  })

  return Array.from(grouped.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([due_date, rows]) => ({ due_date, events: rows.sort(compareByNearestDue) }))
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
  const { t } = useTranslation()

  return (
    <section className="rounded-2xl border border-dashed border-border bg-card/70 p-8 text-center">
      <h2 className="text-lg font-semibold">{t('dashboard.noDueEventsTitle')}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t('dashboard.noDueEventsDescription')}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link to="/items/create/wizard" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          {t('dashboard.addItem')}
        </Link>
        <Link to="/events" className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground">
          {t('dashboard.openEvents')}
        </Link>
      </div>
    </section>
  )
}

export function DashboardPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const { mode, lensUserId } = useAdminScope()

  const lensScope = useMemo(
    () => ({ mode, lensUserId: mode === 'owner' ? lensUserId : null }),
    [lensUserId, mode],
  )
  const lensParams = useMemo(() => lensScopeToParams(lensScope), [lensScope])

  const eventsQuery = useQuery({
    queryKey: queryKeys.dashboard.lens(lensScope),
    queryFn: async () => {
      const params = new URLSearchParams({ status: 'pending', ...lensParams })
      return apiRequest<EventsResponse>(`/events?${params.toString()}`)
    },
  })

  const assetsQuery = useQuery({
    queryKey: queryKeys.items.list({ scope: 'dashboard-assets', filter: 'assets', sort: 'recently_updated', ...lensParams }),
    queryFn: async () => {
      const params = new URLSearchParams({ filter: 'assets', sort: 'recently_updated', ...lensParams })
      return apiRequest<ItemsResponse>(`/items?${params.toString()}`)
    },
  })

  const itemLookupQuery = useQuery({
    queryKey: queryKeys.items.list({ scope: 'dashboard-lookup', filter: 'all', sort: 'recently_updated', ...lensParams }),
    queryFn: async () => {
      const params = new URLSearchParams({ filter: 'all', sort: 'recently_updated', ...lensParams })
      return apiRequest<ItemsResponse>(`/items?${params.toString()}`)
    },
  })

  const grouped = useMemo(() => {
    const groups = eventsQuery.data?.groups ?? []
    const merged = groups.flatMap((group) => group.events)
    return groupMergedEvents(merged).sort(compareGroupsByNearestDue)
  }, [eventsQuery.data])

  const allEvents = useMemo(() => grouped.flatMap((group) => group.events), [grouped])
  const itemNameById = useMemo(() => {
    const rows = itemLookupQuery.data?.items ?? []
    return new Map(rows.map((item) => [item.id, getItemDisplayName(item)]))
  }, [itemLookupQuery.data?.items])

  const assets = assetsQuery.data?.items ?? []

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
    const dueRange = formatDateRange(allEvents.map((event) => event.due_date))

    return {
      totalDue: allEvents.length,
      overdue,
      thisWeekCount,
      dueAmount,
      dueRange,
    }
  }, [allEvents])

  if (eventsQuery.isLoading || assetsQuery.isLoading || itemLookupQuery.isLoading) {
    return <DashboardSkeleton />
  }

  if (eventsQuery.isError || assetsQuery.isError || itemLookupQuery.isError) {
    return (
      <section className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
        {t('dashboard.loadError')}
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="hover-lift animate-fade-up rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('dashboard.dueEvents')}</p>
          <p className="mt-2 text-2xl font-semibold">{metrics.totalDue}</p>
        </article>
        <article className="hover-lift animate-fade-up rounded-2xl border border-border bg-card p-4 shadow-sm" style={{ animationDelay: '40ms' }}>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('dashboard.overdue')}</p>
          <p className="mt-2 text-2xl font-semibold text-destructive">{metrics.overdue}</p>
        </article>
        <article className="hover-lift animate-fade-up rounded-2xl border border-border bg-card p-4 shadow-sm" style={{ animationDelay: '80ms' }}>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('dashboard.dueInWeek')}</p>
          <p className="mt-2 text-2xl font-semibold">{metrics.thisWeekCount}</p>
        </article>
        <article className="hover-lift animate-fade-up rounded-2xl border border-border bg-card p-4 shadow-sm" style={{ animationDelay: '120ms' }}>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('dashboard.upcomingAmount')}</p>
          <p className="mt-2 text-2xl font-semibold">{formatCurrency(metrics.dueAmount)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{metrics.dueRange ? t('dashboard.upcomingRange', { range: metrics.dueRange }) : t('dashboard.upcomingRangeMissing')}</p>
        </article>
      </div>

      <section className="animate-fade-up rounded-2xl border border-border bg-card p-4 shadow-sm" style={{ animationDelay: '160ms' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t('dashboard.assetsTitle')}</h2>
          <Link to="/items?filter=assets" className="text-xs font-medium text-primary">
            {t('dashboard.viewAllItems')}
          </Link>
        </div>

        {assets.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t('dashboard.assetsEmpty')}</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {assets.map((asset) => (
              <li key={asset.id} className="hover-lift rounded-xl border border-border bg-background/80 p-3">
                <Link to={`/items/${asset.id}`} state={{ from: location.pathname + location.search }} className="text-sm font-semibold text-primary underline-offset-2 hover:underline">
                  {getItemDisplayName(asset)}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">{asset.item_type}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {grouped.length === 0 ? (
        <DashboardEmptyState />
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <section key={group.due_date} className="animate-fade-up rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-sm font-semibold">{formatDueLabel(group.due_date)}</h2>
                <Link to="/events" className="text-xs font-medium text-primary">
                  {t('dashboard.openEvents')}
                </Link>
              </div>
              <ul className="mt-3 space-y-2">
                {group.events.slice(0, 4).map((event) => (
                  <li key={event.id} className="flex flex-col gap-3 rounded-xl border border-border bg-background/80 p-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-medium">{event.type}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <Link to={`/items/${event.item_id}`} state={{ from: location.pathname + location.search }} className="text-primary underline-offset-2 hover:underline">
                          {itemNameById.get(event.item_id) ?? t('dashboard.itemLabel', { itemId: event.item_id })}
                        </Link>{' '}
                        - {event.amount === null ? t('dashboard.amountPending') : formatCurrency(Number(event.amount))}
                      </p>
                    </div>
                    <CompleteEventRowAction eventId={event.id} itemId={event.item_id} />
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
