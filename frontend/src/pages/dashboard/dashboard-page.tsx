import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { MotionPanelList } from '@/components/ui/motion-panel-list'
import { Pressable } from '@/components/ui/pressable'
import { Button } from '@/components/ui/button'
import { DataCard } from '../../features/dashboard/data-card'
import { DashboardNeedsAttention } from '../../features/dashboard/dashboard-needs-attention'
import { DashboardBody, DashboardDescription, DashboardEyebrow, DashboardHeader, DashboardLayout, DashboardSection, DashboardTitle } from '../../features/dashboard/dashboard-layout'
import { DashboardRecentActivity } from '../../features/dashboard/dashboard-recent-activity'
import { DashboardSummaryCard } from '../../features/dashboard/dashboard-summary-card'
import { useAdminScope } from '../../features/admin-scope/admin-scope-context'
import { apiRequest } from '../../lib/api-client'
import { formatCurrency } from '../../lib/currency'
import { compareByNearestDue } from '../../lib/date-ordering'
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
  attributes: Record<string, unknown>
  updated_at: string
}

type ItemsResponse = {
  items: ItemRow[]
  total_count: number
}

type NetStatusResponse = {
  id: string
  summary: {
    net_monthly_cashflow: number
    active_period?: {
      cadence?: string
      start_date?: string
      end_date?: string
      label?: string
    }
    cadence_totals?: {
      total?: {
        net_cashflow?: {
          weekly?: number
          monthly?: number
          yearly?: number
        }
        active_periods?: {
          weekly?: {
            start_date?: string
            end_date?: string
            label?: string
          }
          monthly?: {
            start_date?: string
            end_date?: string
            label?: string
          }
          yearly?: {
            start_date?: string
            end_date?: string
            label?: string
          }
        }
      }
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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

function parseCalendarDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatPeriodLabel(period: { start_date?: string; end_date?: string; label?: string } | undefined, fallback: string) {
  if (period?.label && period.label.trim().length > 0) {
    return period.label
  }

  if (period?.start_date && period.end_date) {
    return formatDateRange([period.start_date, period.end_date]) ?? fallback
  }

  return fallback
}

function resolveNetSummary(summary: NetStatusResponse['summary']) {
  const cadence = summary.active_period?.cadence
  const cadencePeriods = summary.cadence_totals?.total?.active_periods
  const cadenceNet = summary.cadence_totals?.total?.net_cashflow

  if (cadence === 'weekly' || cadence === 'monthly' || cadence === 'yearly') {
    const value = cadenceNet?.[cadence]
    if (Number.isFinite(value)) {
      return {
        net: Number(value),
        periodLabel: formatPeriodLabel(cadencePeriods?.[cadence], formatPeriodLabel(summary.active_period, 'current period')),
      }
    }
  }

  return {
    net: Number(summary.net_monthly_cashflow ?? 0),
    periodLabel: formatPeriodLabel(summary.active_period, 'current month'),
  }
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

  const assets = assetsQuery.data?.items ?? []
  const assetNetStatusQuery = useQuery({
    queryKey: [...queryKeys.dashboard.lens(lensScope), 'asset-net-status', assets.map((asset) => asset.id)],
    enabled: assets.length > 0,
    queryFn: async () => Promise.all(assets.map((asset) => apiRequest<NetStatusResponse>(`/items/${asset.id}/net-status`))),
  })

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
    const overdueEvents = attentionEvents.filter((event) => Date.parse(event.due_date) < now)
    const upcomingEvents = attentionEvents.filter((event) => {
      const due = Date.parse(event.due_date)
      if (Number.isNaN(due)) {
        return false
      }

      return due >= now
    }).length
    const upcomingAmount = attentionEvents.reduce((total, event) => {
      if (Date.parse(event.due_date) < now) {
        return total
      }

      return total + Number(event.amount ?? 0)
    }, 0)
    const dueRange = formatDateRange(attentionEvents.map((event) => event.due_date))
    const activityRows = completedEvents.slice(0, 5)
    const manualOverrideCount = activityRows.filter((event) => event.is_manual_override).length
    const netSummaries = assetNetStatusQuery.data ?? []
    const resolvedNetSummaries = netSummaries.map((entry) => resolveNetSummary(entry.summary))
    const netCashflow = resolvedNetSummaries.reduce((total, entry) => total + entry.net, 0)
    const netPeriodLabel = resolvedNetSummaries[0]?.periodLabel ?? t('dashboard.currentMonthFallback')

    return {
      netCashflow,
      netPeriodLabel,
      totalDue: upcomingEvents,
      overdue: overdueEvents.length,
      upcomingAmount,
      dueRange,
      completedActivity: completedEvents.length,
      activityRows: activityRows.length,
      manualOverrideCount,
    }
  }, [assetNetStatusQuery.data, attentionEvents, completedEvents, t])

  const metricCards = [
    {
      key: 'netCashflow',
      label: t('dashboard.summaryCards.netCashflow.label'),
      value: formatCurrency(metrics.netCashflow),
      description: t('dashboard.summaryCards.netCashflow.support', { period: metrics.netPeriodLabel }),
      to: '/items?filter=assets',
      linkLabel: t('dashboard.viewAllItems'),
      valueClassName: metrics.netCashflow < 0 ? 'text-destructive' : undefined,
    },
    {
      key: 'upcomingDue',
      label: t('dashboard.summaryCards.upcomingDue.label'),
      value: formatCurrency(metrics.upcomingAmount),
      description: metrics.dueRange
        ? t('dashboard.summaryCards.upcomingDue.support', { count: metrics.totalDue, range: metrics.dueRange })
        : t('dashboard.summaryCards.upcomingDue.supportMissing', { count: metrics.totalDue }),
      to: '/events',
      linkLabel: t('dashboard.openEvents'),
    },
    {
      key: 'overdue',
      label: t('dashboard.summaryCards.overdue.label'),
      value: metrics.overdue,
      description: t('dashboard.summaryCards.overdue.support', { count: metrics.overdue }),
      to: '/events',
      linkLabel: t('dashboard.openEvents'),
      valueClassName: 'text-destructive',
    },
    {
      key: 'completedActivity',
      label: t('dashboard.summaryCards.completedActivity.label'),
      value: metrics.completedActivity,
      description: t('dashboard.summaryCards.completedActivity.support', {
        count: metrics.activityRows,
        manualCount: metrics.manualOverrideCount,
      }),
      to: '/events',
      linkLabel: t('events.historyTitle'),
    },
  ]

  if (eventsQuery.isLoading || recentActivityQuery.isLoading || assetsQuery.isLoading || itemLookupQuery.isLoading || (assets.length > 0 && assetNetStatusQuery.isLoading)) {
    return <DashboardSkeleton />
  }

  if (eventsQuery.isError || recentActivityQuery.isError || assetsQuery.isError || itemLookupQuery.isError || assetNetStatusQuery.isError) {
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
        <DashboardSection
          title={t('dashboard.sections.needsAttention.title')}
          description={t('dashboard.sections.needsAttention.description')}
          action={
            <Button asChild size="sm" variant="ghost">
              <Link to="/events">{t('dashboard.openEvents')}</Link>
            </Button>
          }
          data-dashboard-section="needs-attention"
        >
          {attentionEvents.length === 0 ? (
            <DashboardEmptyState />
          ) : (
            <DashboardNeedsAttention
              events={attentionEvents}
              itemById={itemById}
              itemNameById={itemNameById}
              returnTo={location.pathname + location.search}
              labels={{
                overdue: t('dashboard.attention.overdue'),
                dueSoon: t('dashboard.attention.dueSoon'),
                dueDate: t('dashboard.attention.dueDate'),
                amount: t('dashboard.attention.amount'),
                linkedItem: t('dashboard.attention.linkedItem'),
                amountPending: t('dashboard.amountPending'),
                itemLabel: (itemId) => t('dashboard.itemLabel', { itemId }),
              }}
            />
          )}
        </DashboardSection>

        <DashboardSection
          title={t('dashboard.sections.recentActivity.title')}
          description={t('dashboard.sections.recentActivity.description')}
          data-dashboard-section="recent-activity"
        >
          <DataCard as="section" cardClassName="bg-card" contentClassName="space-y-3">
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
      </DashboardBody>

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
      </DashboardSection>
    </DashboardLayout>
  )
}
