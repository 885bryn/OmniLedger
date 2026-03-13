import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { MotionPanelList } from '@/components/ui/motion-panel-list'
import { Pressable } from '@/components/ui/pressable'
import { Button } from '@/components/ui/button'
import { DashboardActionQueue } from '../../features/dashboard/dashboard-action-queue'
import { DashboardActivityTrendStrip } from '../../features/dashboard/dashboard-activity-trend-strip'
import { DashboardExceptionNotices, type DashboardExceptionNotice } from '../../features/dashboard/dashboard-exception-notices'
import { DataCard } from '../../features/dashboard/data-card'
import { DashboardBody, DashboardDescription, DashboardEyebrow, DashboardHeader, DashboardLayout, DashboardSection, DashboardTitle } from '../../features/dashboard/dashboard-layout'
import { DashboardRecentActivity } from '../../features/dashboard/dashboard-recent-activity'
import { DashboardSummaryCard } from '../../features/dashboard/dashboard-summary-card'
import { useAdminScope } from '../../features/admin-scope/admin-scope-context'
import { apiRequest } from '../../lib/api-client'
import { formatCurrency } from '../../lib/currency'
import { compareByNearestDue } from '../../lib/date-ordering'
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
  completed_at?: string | null
  is_manual_override?: boolean
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
  linked_asset_item_id?: string | null
  parent_item_id?: string | null
  attributes: Record<string, unknown>
  updated_at: string
}

type ItemsResponse = {
  items: ItemRow[]
  total_count: number
}

function formatDateRange(values: string[]) {
  const parsed = values.map((value) => parseCalendarDate(value)).filter((value): value is Date => value !== null)
  if (parsed.length === 0) {
    return null
  }

  const sorted = [...parsed].sort((left, right) => left.getTime() - right.getTime())
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  })

  if (min.toDateString() === max.toDateString()) {
    return formatter.format(min)
  }

  return `${formatter.format(min)} - ${formatter.format(max)}`
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

function parseCalendarDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toCalendarDayKey(value: string) {
  const parsed = parseCalendarDate(value) ?? new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.getFullYear() * 10000 + (parsed.getMonth() + 1) * 100 + parsed.getDate()
}

function resolveLinkedAssetId(item: ItemRow | undefined) {
  if (!item) {
    return null
  }

  if (item.parent_item_id) {
    return item.parent_item_id
  }

  if (item.linked_asset_item_id) {
    return item.linked_asset_item_id
  }

  const attrParent = item.attributes?.parentItemId
  if (typeof attrParent === 'string' && attrParent.length > 0) {
    return attrParent
  }

  const attrLinked = item.attributes?.linkedAssetItemId
  return typeof attrLinked === 'string' && attrLinked.length > 0 ? attrLinked : null
}

function eventSignedAmount(event: EventRow, item: ItemRow | undefined) {
  if (event.amount === null || Number.isNaN(event.amount)) {
    return 0
  }

  const magnitude = Math.abs(Number(event.amount))
  return item && isIncomeItem(item) ? magnitude : -magnitude
}

function compareActivityByLatest(left: EventRow, right: EventRow) {
  const leftTime = Date.parse(left.completed_at || left.updated_at || left.due_date)
  const rightTime = Date.parse(right.completed_at || right.updated_at || right.due_date)
  if (leftTime !== rightTime) {
    return rightTime - leftTime
  }

  return left.id.localeCompare(right.id)
}

function DashboardSkeleton() {
  return (
    <DashboardLayout aria-label="Loading dashboard">
      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded bg-muted/70" />
        <div className="h-8 w-64 animate-pulse rounded bg-muted/70" />
        <div className="h-5 w-full max-w-2xl animate-pulse rounded bg-muted/60" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-xl border border-border bg-card/80 shadow-sm shadow-black/5 dark:shadow-none" />
        ))}
      </div>
      <DashboardBody>
        <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm shadow-black/5 dark:shadow-none">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-lg bg-muted/80" />
          ))}
        </div>
        <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm shadow-black/5 dark:shadow-none">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-lg bg-muted/80" />
          ))}
        </div>
      </DashboardBody>
    </DashboardLayout>
  )
}

function DashboardEmptyState() {
  const { t } = useTranslation()

  return (
    <DataCard
      as="section"
      cardClassName="border-dashed bg-muted/20"
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

  const recentActivityQuery = useQuery({
    queryKey: [...queryKeys.dashboard.lens(lensScope), 'recent-activity'],
    queryFn: async () => {
      const params = new URLSearchParams({ status: 'completed', ...lensParams })
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

  const attentionEvents = useMemo(() => {
    const groups = eventsQuery.data?.groups ?? []
    return groups.flatMap((group) => group.events).sort(compareByNearestDue)
  }, [eventsQuery.data])
  const completedEvents = useMemo(() => {
    const groups = recentActivityQuery.data?.groups ?? []
    return groups.flatMap((group) => group.events).sort(compareActivityByLatest)
  }, [recentActivityQuery.data])
  const itemById = useMemo(() => {
    const rows = itemLookupQuery.data?.items ?? []
    return new Map(rows.map((item) => [item.id, item]))
  }, [itemLookupQuery.data?.items])
  const itemNameById = useMemo(() => {
    const rows = itemLookupQuery.data?.items ?? []
    return new Map(rows.map((item) => [item.id, getItemDisplayName(item)]))
  }, [itemLookupQuery.data?.items])
  const currentDayKey = useMemo(() => {
    const today = new Date(Date.now())
    return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
  }, [])

  const assets = assetsQuery.data?.items ?? []

  const assetGridClassName = useMemo(() => {
    if (assets.length <= 1) {
      return 'grid gap-3 grid-cols-1'
    }

    if (assets.length === 2) {
      return 'grid gap-3 grid-cols-1 2xl:grid-cols-2'
    }

    if (assets.length === 3) {
      return 'grid gap-3 grid-cols-1 xl:grid-cols-2'
    }

    return 'grid gap-3 grid-cols-1 xl:grid-cols-2'
  }, [assets.length])

  const metrics = useMemo(() => {
    const now = Date.now()
    const nowDate = new Date(now)
    const monthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1)
    const monthEnd = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0)
    const monthStartDayKey = monthStart.getFullYear() * 10000 + (monthStart.getMonth() + 1) * 100 + monthStart.getDate()
    const monthEndDayKey = monthEnd.getFullYear() * 10000 + (monthEnd.getMonth() + 1) * 100 + monthEnd.getDate()
    const monthPeriodLabel = formatDateRange([
      `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}-${String(monthStart.getDate()).padStart(2, '0')}`,
      `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, '0')}-${String(monthEnd.getDate()).padStart(2, '0')}`,
    ]) ?? t('dashboard.currentMonthFallback')

    const monthlyPendingEvents = attentionEvents.filter((event) => {
      const dueDayKey = toCalendarDayKey(event.due_date)
      if (dueDayKey === null) {
        return false
      }

      return dueDayKey >= monthStartDayKey && dueDayKey <= monthEndDayKey
    })

    const overdueEvents = monthlyPendingEvents.filter((event) => {
      const dueDayKey = toCalendarDayKey(event.due_date)
      return dueDayKey !== null && dueDayKey < currentDayKey
    })

    const upcomingEvents = monthlyPendingEvents.filter((event) => {
      const dueDayKey = toCalendarDayKey(event.due_date)
      return dueDayKey !== null && dueDayKey >= currentDayKey
    })

    const upcomingAmount = upcomingEvents.reduce((total, event) => {
      const item = itemById.get(event.item_id)
      if (item && isIncomeItem(item)) {
        return total
      }

      return total + Number(event.amount ?? 0)
    }, 0)
    const oldestOverdueEvent = [...overdueEvents].sort(compareByNearestDue)[0] ?? null
    const nextUpcomingEvent = [...upcomingEvents].sort(compareByNearestDue)[0] ?? null
    const monthlyCompletedEvents = completedEvents.filter((event) => {
      const dueDayKey = toCalendarDayKey(event.due_date)
      if (dueDayKey === null) {
        return false
      }

      return dueDayKey >= monthStartDayKey && dueDayKey <= monthEndDayKey
    })

    const activityRows = monthlyCompletedEvents.slice(0, 5)
    const latestCompletedEvent = monthlyCompletedEvents[0] ?? null
    const manualOverrideCount = activityRows.filter((event) => event.is_manual_override).length
    const monthlyLedgerById = new Map<string, EventRow>()

    for (const event of [...monthlyPendingEvents, ...monthlyCompletedEvents]) {
      monthlyLedgerById.set(event.id, event)
    }

    const netCashflow = Array.from(monthlyLedgerById.values()).reduce(
      (total, event) => total + eventSignedAmount(event, itemById.get(event.item_id)),
      0,
    )

    return {
      netCashflow,
      netPeriodLabel: monthPeriodLabel,
      totalDue: upcomingEvents.length,
      overdue: overdueEvents.length,
      upcomingAmount,
      completedActivity: monthlyCompletedEvents.length,
      activityRows: activityRows.length,
      manualOverrideCount,
      oldestOverdueDateLabel: oldestOverdueEvent ? formatDateLabel(oldestOverdueEvent.due_date) : null,
      nextUpcomingDateLabel: nextUpcomingEvent ? formatDateLabel(nextUpcomingEvent.due_date) : null,
      latestCompletedDateLabel: latestCompletedEvent
        ? formatDateLabel(latestCompletedEvent.completed_at || latestCompletedEvent.updated_at || latestCompletedEvent.due_date)
        : null,
    }
  }, [attentionEvents, completedEvents, currentDayKey, itemById, t])

  const metricCards = [
    {
      key: 'netCashflow',
      label: t('dashboard.summaryCards.netCashflow.label'),
      value: formatCurrency(metrics.netCashflow),
      description: t('dashboard.summaryCards.netCashflow.support', { period: metrics.netPeriodLabel }),
      to: '/items?filter=assets',
      linkLabel: t('dashboard.viewAllItems'),
      linkState: { from: location.pathname + location.search },
      valueClassName: metrics.netCashflow < 0 ? 'text-destructive' : undefined,
    },
    {
      key: 'upcomingDue',
      label: t('dashboard.summaryCards.upcomingDue.label'),
      value: formatCurrency(metrics.upcomingAmount),
      description: t('dashboard.summaryCards.upcomingDue.support', {
        count: metrics.totalDue,
        period: metrics.netPeriodLabel,
      }),
      to: '/events',
      linkLabel: t('dashboard.openEvents'),
      linkState: { from: location.pathname + location.search },
    },
    {
      key: 'overdue',
      label: t('dashboard.summaryCards.overdue.label'),
      value: metrics.overdue,
      description: t('dashboard.summaryCards.overdue.support', { count: metrics.overdue, period: metrics.netPeriodLabel }),
      to: '/events',
      linkLabel: t('dashboard.openEvents'),
      linkState: { from: location.pathname + location.search },
      valueClassName: 'text-destructive',
    },
    {
      key: 'completedActivity',
      label: t('dashboard.summaryCards.completedActivity.label'),
      value: metrics.completedActivity,
      description: t('dashboard.summaryCards.completedActivity.support', {
        count: metrics.activityRows,
        manualCount: metrics.manualOverrideCount,
        period: metrics.netPeriodLabel,
      }),
      to: '/events',
      linkLabel: t('events.historyTitle'),
      linkState: { from: location.pathname + location.search },
    },
  ]

  const overdueLinkedCountsByAssetId = useMemo(() => {
    const counts = new Map<string, number>()

    for (const event of attentionEvents) {
      const dueDayKey = toCalendarDayKey(event.due_date)
      if (dueDayKey === null || dueDayKey >= currentDayKey) {
        continue
      }

      const linkedAssetId = resolveLinkedAssetId(itemById.get(event.item_id))
      if (!linkedAssetId) {
        continue
      }

      counts.set(linkedAssetId, (counts.get(linkedAssetId) ?? 0) + 1)
    }

    return counts
  }, [attentionEvents, currentDayKey, itemById])

  const exceptionNotices = useMemo<DashboardExceptionNotice[]>(() => {
    const notices: DashboardExceptionNotice[] = []
    const overdueAssetCount = Array.from(overdueLinkedCountsByAssetId.values()).filter((count) => count > 0).length

    if (metrics.overdue > 0) {
      notices.push({
        id: 'overdue-linked-rows',
        eyebrow: t('dashboard.exceptionNotices.overdue.eyebrow'),
        title: t('dashboard.exceptionNotices.overdue.title', { count: metrics.overdue }),
        description: t('dashboard.exceptionNotices.overdue.description', {
          count: metrics.overdue,
          assetCount: overdueAssetCount,
          period: metrics.netPeriodLabel,
        }),
        tone: 'warning',
      })
    }

    if (metrics.manualOverrideCount > 0) {
      notices.push({
        id: 'manual-overrides',
        eyebrow: t('dashboard.exceptionNotices.manualOverride.eyebrow'),
        title: t('dashboard.exceptionNotices.manualOverride.title'),
        description: t('dashboard.exceptionNotices.manualOverride.description', {
          count: metrics.manualOverrideCount,
          period: metrics.netPeriodLabel,
        }),
        tone: 'neutral',
      })
    }

    if (notices.length === 0) {
      notices.push({
        id: 'all-clear',
        eyebrow: t('dashboard.exceptionNotices.clear.eyebrow'),
        title: t('dashboard.exceptionNotices.clear.title'),
        description: t('dashboard.exceptionNotices.clear.description', { period: metrics.netPeriodLabel }),
        tone: 'clear',
      })
    }

    return notices
  }, [metrics.manualOverrideCount, metrics.netPeriodLabel, metrics.overdue, overdueLinkedCountsByAssetId, t])

  if (eventsQuery.isLoading || recentActivityQuery.isLoading || assetsQuery.isLoading || itemLookupQuery.isLoading) {
    return <DashboardSkeleton />
  }

  if (eventsQuery.isError || recentActivityQuery.isError || assetsQuery.isError || itemLookupQuery.isError) {
    return (
      <DataCard as="section" title={t('dashboard.loadError')}>
        <p className="text-sm text-destructive">{t('dashboard.loadError')}</p>
      </DataCard>
    )
  }

  return (
    <DashboardLayout>
      <DashboardHeader>
        <DashboardEyebrow>{t('dashboard.eyebrow')}</DashboardEyebrow>
        <DashboardTitle>{t('dashboard.title')}</DashboardTitle>
        <DashboardDescription>
          {t('dashboard.description')}
        </DashboardDescription>
      </DashboardHeader>

      <DashboardSection
        title={t('dashboard.sections.currentPosition.title')}
        description={t('dashboard.sections.currentPosition.description')}
        data-dashboard-section="summary"
      >
        <div data-dashboard-summary-band="true">
          <MotionPanelList
            items={metricCards}
            getItemKey={(metric) => metric.key}
            className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-4"
            itemClassName="h-full"
            highlightOnMount
            renderItem={(metric) => (
              <DashboardSummaryCard
                label={metric.label}
                linkState={metric.linkState}
                linkLabel={metric.linkLabel}
                supportingText={metric.description}
                to={metric.to}
                value={metric.value}
                valueClassName={metric.valueClassName}
              />
            )}
          />
        </div>
      </DashboardSection>

      <DashboardBody>
        <div data-dashboard-body-column="primary" className="space-y-6">
          <DashboardSection
            title={t('dashboard.sections.needsAttention.title')}
            description={t('dashboard.sections.needsAttention.description')}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild size="sm" variant="ghost">
                  <Link to="/events">{t('dashboard.openEvents')}</Link>
                </Button>
              </div>
            }
            data-dashboard-section="needs-attention"
          >
            {attentionEvents.length === 0 ? (
              <DashboardEmptyState />
            ) : (
              <DashboardActionQueue
                events={attentionEvents}
                itemById={itemById}
                itemNameById={itemNameById}
                returnTo={location.pathname + location.search}
                labels={{
                  overdue: t('dashboard.attention.overdue'),
                  upcoming: t('dashboard.actionQueue.upcoming'),
                  dueDate: t('dashboard.attention.dueDate'),
                  amount: t('dashboard.attention.amount'),
                  amountPending: t('dashboard.amountPending'),
                  itemLabel: (itemId) => t('dashboard.itemLabel', { itemId }),
                  openEvents: t('dashboard.openEvents'),
                  linkedItem: t('dashboard.attention.linkedItem'),
                  upcomingPreview: ({ shown, total }) => t('dashboard.actionQueue.previewHint', { shown, total }),
                  showAllUpcoming: ({ total }) => t('dashboard.actionQueue.showAllRows', { total }),
                  showFewerUpcoming: t('dashboard.actionQueue.showFewerRows'),
                  ageBucket: (bucket) => t(`dashboard.actionQueue.ageBuckets.${bucket}`),
                }}
              />
            )}
          </DashboardSection>
        </div>

        <div data-dashboard-body-column="secondary" className="space-y-6">
          <DashboardSection
            title={t('dashboard.assetsTitle')}
            description={t('dashboard.sections.portfolio.description')}
            action={
              <Button asChild size="sm" variant="ghost">
                <Link to="/items?filter=assets">{t('dashboard.viewAllItems')}</Link>
              </Button>
            }
            data-dashboard-section="portfolio-snapshot"
          >
            <DataCard as="section" cardClassName="bg-card" contentClassName="pt-0">
              {assets.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('dashboard.assetsEmpty')}</p>
              ) : (
                <MotionPanelList
                  items={assets}
                  getItemKey={(asset) => asset.id}
                  className={assetGridClassName}
                  itemClassName="h-full w-full min-w-0"
                  renderItem={(asset) => {
                    const overdueLinkedCount = overdueLinkedCountsByAssetId.get(asset.id) ?? 0
                    const hasOverdueLinkedRows = overdueLinkedCount > 0

                    return (
                      <Pressable className="!flex h-full !w-full min-w-0" data-testid={`dashboard-asset-card-${asset.id}`} data-dashboard-asset-alert={hasOverdueLinkedRows ? 'overdue' : 'clear'}>
                        <Link
                          to={`/items/${asset.id}`}
                          state={{ from: location.pathname + location.search }}
                          aria-label={getItemDisplayName(asset)}
                          className={[
                            'hover-lift flex h-full w-full flex-col rounded-xl border bg-background/80 p-4 shadow-sm shadow-black/5 dark:shadow-none',
                            hasOverdueLinkedRows
                              ? 'border-destructive/70 bg-[linear-gradient(180deg,rgba(254,242,242,0.96),rgba(255,255,255,0.98))]'
                              : 'border-border',
                          ].join(' ')}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <span className="text-sm font-semibold text-primary underline-offset-2 hover:underline">{getItemDisplayName(asset)}</span>
                              <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{asset.item_type}</p>
                            </div>
                            {hasOverdueLinkedRows ? (
                              <span className="inline-flex rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-destructive">
                                {t('dashboard.portfolio.needsAttentionBadge')}
                              </span>
                            ) : null}
                          </div>

                          <p className="mt-3 text-xs leading-5 text-muted-foreground">
                            {hasOverdueLinkedRows
                              ? t('dashboard.portfolio.overdueLinkedRows', { count: overdueLinkedCount })
                              : t('dashboard.portfolio.clearLinkedRows')}
                          </p>
                        </Link>
                      </Pressable>
                    )
                  }}
                />
              )}
            </DataCard>
          </DashboardSection>

          <DashboardSection
            title={t('dashboard.sections.exceptionNotices.title')}
            description={t('dashboard.sections.exceptionNotices.description')}
            data-dashboard-section="exception-notices"
          >
            <DashboardExceptionNotices notices={exceptionNotices} />
          </DashboardSection>
        </div>
      </DashboardBody>

      <DashboardSection
        title={t('dashboard.sections.recentActivity.title')}
        description={t('dashboard.sections.recentActivity.description')}
        data-dashboard-section="recent-activity"
      >
        <DataCard as="section" cardClassName="bg-card/90" contentClassName="space-y-4 pt-0">
          <DashboardActivityTrendStrip
            title={t('dashboard.activityTrendStrip.title')}
            description={t('dashboard.activityTrendStrip.description', { period: metrics.netPeriodLabel })}
            items={[
              {
                id: 'overdue',
                label: t('dashboard.activityTrendStrip.overdue.label'),
                value: String(metrics.overdue),
                detail: t('dashboard.activityTrendStrip.overdue.detail', { count: metrics.overdue }),
                hint: metrics.oldestOverdueDateLabel
                  ? t('dashboard.activityTrendStrip.overdue.hint', { date: metrics.oldestOverdueDateLabel })
                  : t('dashboard.activityTrendStrip.overdue.hintClear', { period: metrics.netPeriodLabel }),
                tone: metrics.overdue > 0 ? 'warning' : 'neutral',
              },
              {
                id: 'upcoming',
                label: t('dashboard.activityTrendStrip.upcoming.label'),
                value: String(metrics.totalDue),
                detail: t('dashboard.activityTrendStrip.upcoming.detail', { count: metrics.totalDue }),
                hint: metrics.nextUpcomingDateLabel
                  ? t('dashboard.activityTrendStrip.upcoming.hint', { date: metrics.nextUpcomingDateLabel })
                  : t('dashboard.activityTrendStrip.upcoming.hintClear', { period: metrics.netPeriodLabel }),
                tone: 'neutral',
              },
              {
                id: 'completed',
                label: t('dashboard.activityTrendStrip.completed.label'),
                value: String(metrics.completedActivity),
                detail: t('dashboard.activityTrendStrip.completed.detail', {
                  count: metrics.completedActivity,
                  period: metrics.netPeriodLabel,
                }),
                hint: metrics.latestCompletedDateLabel
                  ? t('dashboard.activityTrendStrip.completed.hint', { date: metrics.latestCompletedDateLabel })
                  : t('dashboard.activityTrendStrip.completed.hintClear', { period: metrics.netPeriodLabel }),
                tone: metrics.completedActivity > 0 ? 'positive' : 'neutral',
              },
            ]}
          />

          {completedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('dashboard.recentActivity.empty')}</p>
          ) : (
            <DashboardRecentActivity
              events={completedEvents.slice(0, 5)}
              itemById={itemById}
              itemNameById={itemNameById}
              returnTo={location.pathname + location.search}
              labels={{
                completed: t('dashboard.recentActivity.completedBadge'),
                manualOverride: t('events.manualOverride.badge'),
                paidOn: (date) => t('dashboard.recentActivity.paidOn', { date }),
                amountPending: t('dashboard.amountPending'),
                itemLabel: (itemId) => t('dashboard.itemLabel', { itemId }),
              }}
            />
          )}
        </DataCard>
      </DashboardSection>
    </DashboardLayout>
  )
}
