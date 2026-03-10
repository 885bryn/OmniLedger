import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { MotionPanelList } from '@/components/ui/motion-panel-list'
import { Pressable } from '@/components/ui/pressable'
import { Button } from '@/components/ui/button'
import { DataCard } from '../../features/dashboard/data-card'
import { CompleteEventRowAction } from '../../features/events/complete-event-row-action'
import { useAdminScope } from '../../features/admin-scope/admin-scope-context'
import { apiRequest } from '../../lib/api-client'
import { formatCurrency } from '../../lib/currency'
import { compareByNearestDue, compareGroupsByNearestDue } from '../../lib/date-ordering'
import { getItemDisplayName, isIncomeItem } from '../../lib/item-display'
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
  type?: string | null
  attributes: Record<string, unknown>
  updated_at: string
}

type ItemsResponse = {
  items: ItemRow[]
  total_count: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeSubtype(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function isOutflowItem(item: ItemRow | undefined) {
  if (!item) {
    return false
  }

  if (item.item_type !== 'FinancialItem') {
    return false
  }

  const attributes = isRecord(item.attributes) ? item.attributes : {}
  const subtype = normalizeSubtype(item.type) || normalizeSubtype(attributes.financialSubtype) || normalizeSubtype(attributes.type)
  return subtype === 'commitment'
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

function formatEventAmount(value: number | null, isIncome: boolean) {
  if (value === null || Number.isNaN(value)) {
    return null
  }

  const formatted = formatCurrency(Number(value))
  return isIncome ? `+${formatted}` : formatted
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
          <div key={index} className="h-32 animate-pulse rounded-xl border border-border bg-card/80 shadow-sm shadow-black/5 dark:shadow-none" />
        ))}
      </div>
      <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm shadow-black/5 dark:shadow-none">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-14 animate-pulse rounded-lg bg-muted/80" />
        ))}
      </div>
    </section>
  )
}

function DashboardEmptyState() {
  const { t } = useTranslation()

  return (
    <DataCard
      as="section"
      contentClassName="pt-0"
      description={t('dashboard.noDueEventsDescription')}
      title={t('dashboard.noDueEventsTitle')}
    >
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/items/create/wizard">{t('dashboard.addItem')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/events">{t('dashboard.openEvents')}</Link>
        </Button>
      </div>
    </DataCard>
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
  const itemById = useMemo(() => {
    const rows = itemLookupQuery.data?.items ?? []
    return new Map(rows.map((item) => [item.id, item]))
  }, [itemLookupQuery.data?.items])
  const itemNameById = useMemo(() => {
    const rows = itemLookupQuery.data?.items ?? []
    return new Map(rows.map((item) => [item.id, getItemDisplayName(item)]))
  }, [itemLookupQuery.data?.items])

  const assets = assetsQuery.data?.items ?? []

  const assetGridClassName = useMemo(() => {
    if (assets.length <= 1) {
      return 'grid gap-3 grid-cols-1'
    }

    if (assets.length === 2) {
      return 'grid gap-3 grid-cols-1 sm:grid-cols-2'
    }

    if (assets.length === 3) {
      return 'grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
    }

    return 'grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
  }, [assets.length])

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
    const dueAmount = allEvents.reduce((total, event) => {
      if (!isOutflowItem(itemById.get(event.item_id))) {
        return total
      }

      return total + Number(event.amount ?? 0)
    }, 0)
    const dueRange = formatDateRange(allEvents.map((event) => event.due_date))

    return {
      totalDue: allEvents.length,
      overdue,
      thisWeekCount,
      dueAmount,
      dueRange,
    }
  }, [allEvents, itemById])

  const metricCards = [
    { key: 'totalDue', label: t('dashboard.dueEvents'), value: metrics.totalDue },
    { key: 'overdue', label: t('dashboard.overdue'), value: metrics.overdue, valueClassName: 'text-destructive' },
    { key: 'thisWeekCount', label: t('dashboard.dueInWeek'), value: metrics.thisWeekCount },
    {
      key: 'dueAmount',
      label: t('dashboard.upcomingAmount'),
      value: formatCurrency(metrics.dueAmount),
      description: metrics.dueRange ? t('dashboard.upcomingRange', { range: metrics.dueRange }) : t('dashboard.upcomingRangeMissing'),
    },
  ]

  if (eventsQuery.isLoading || assetsQuery.isLoading || itemLookupQuery.isLoading) {
    return <DashboardSkeleton />
  }

  if (eventsQuery.isError || assetsQuery.isError || itemLookupQuery.isError) {
    return (
      <DataCard as="section" title={t('dashboard.loadError')}>
        <p className="text-sm text-destructive">{t('dashboard.loadError')}</p>
      </DataCard>
    )
  }

  return (
    <section className="space-y-5">
      <MotionPanelList
        items={metricCards}
        getItemKey={(metric) => metric.key}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        itemClassName="h-full"
        highlightOnMount
        renderItem={(metric) => (
          <DataCard
            as="article"
            cardClassName="hover-lift"
            className="h-full"
            data-dashboard-metric-card="true"
            description={metric.description}
            eyebrow={metric.label}
            value={<span className={metric.valueClassName}>{metric.value}</span>}
          />
        )}
      />

      <DataCard
        as="section"
        action={
          <Button asChild size="sm" variant="ghost">
            <Link to="/items?filter=assets">{t('dashboard.viewAllItems')}</Link>
          </Button>
        }
        eyebrow={t('dashboard.assetsTitle')}
      >
        {assets.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.assetsEmpty')}</p>
        ) : (
          <MotionPanelList
            items={assets}
            getItemKey={(asset) => asset.id}
            className={assetGridClassName}
            itemClassName="h-full w-full min-w-0"
            renderItem={(asset) => (
              <Pressable className="!flex h-full !w-full min-w-0">
                <Link
                  to={`/items/${asset.id}`}
                  state={{ from: location.pathname + location.search }}
                  className="hover-lift flex h-full w-full flex-col rounded-xl border border-border bg-background/80 p-4 shadow-sm shadow-black/5 dark:shadow-none"
                >
                  <span className="text-sm font-semibold text-primary underline-offset-2 hover:underline">{getItemDisplayName(asset)}</span>
                  <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{asset.item_type}</p>
                </Link>
              </Pressable>
            )}
          />
        )}
      </DataCard>

      {grouped.length === 0 ? (
        <DashboardEmptyState />
      ) : (
        <MotionPanelList
          items={grouped}
          getItemKey={(group) => group.due_date}
          className="space-y-4"
          renderItem={(group) => (
            <DataCard
              as="section"
              action={
                <Button asChild size="sm" variant="ghost">
                  <Link to="/events">{t('dashboard.openEvents')}</Link>
                </Button>
              }
              contentClassName="pt-0"
              eyebrow={formatDueLabel(group.due_date)}
            >
              <MotionPanelList
                items={group.events.slice(0, 4)}
                getItemKey={(event) => event.id}
                className="space-y-2"
                renderItem={(event) => (
                  <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/80 p-3.5 shadow-sm shadow-black/5 dark:shadow-none md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-medium">{event.type}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <Link to={`/items/${event.item_id}`} state={{ from: location.pathname + location.search }} className="text-primary underline-offset-2 hover:underline">
                          {itemNameById.get(event.item_id) ?? t('dashboard.itemLabel', { itemId: event.item_id })}
                        </Link>{' '}
                        - {formatEventAmount(event.amount, isIncomeItem(itemById.get(event.item_id) ?? { item_type: 'Unknown' })) ?? t('dashboard.amountPending')}
                      </p>
                    </div>
                    <CompleteEventRowAction eventId={event.id} itemId={event.item_id} />
                  </div>
                )}
              />
            </DataCard>
          )}
        />
      )}
    </section>
  )
}
