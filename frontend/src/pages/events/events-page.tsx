import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { MotionPanelList } from '@/components/ui/motion-panel-list'
import { ReconcileLedgerAction } from '../../features/events/reconcile-ledger-action'
import { useAdminScope } from '../../features/admin-scope/admin-scope-context'
import { apiRequest } from '../../lib/api-client'
import { formatNullableCurrency } from '../../lib/currency'
import { compareByNearestDue } from '../../lib/date-ordering'
import { getItemDisplayName, isIncomeItem } from '../../lib/item-display'
import { panelItemVariants } from '../../lib/motion'
import { eventListParams, lensScopeToParams, queryKeys } from '../../lib/query-keys'

type EventRow = {
  id: string
  item_id: string
  type: string
  amount: number | null
  actual_amount?: number | null
  actual_date?: string | null
  due_date: string
  status: string
  updated_at: string
  source_state?: 'projected' | 'persisted' | string
  is_projected?: boolean
  is_exception?: boolean
  is_manual_override?: boolean
  completed_at?: string | null
}

type EventsMeta = {
  suppressed_invalid_projected_count?: number
}

type EventGroup = {
  due_date: string
  events: EventRow[]
}

type EventsResponse = {
  groups: EventGroup[]
  total_count: number
  meta?: EventsMeta
}

type ItemRow = {
  id: string
  item_type: string
  frequency?: string | null
  status?: string | null
  title?: string | null
  type?: string | null
  attributes: Record<string, unknown>
  updated_at?: string
}

type ItemsResponse = {
  items: ItemRow[]
}

type LedgerTab = 'upcoming' | 'history'

type UpcomingBucketKey = 'overdue' | 'thisWeek' | 'laterThisMonth' | 'future'

type HistoryGroup = {
  key: string
  label: string
  events: EventRow[]
}

type LocalCompletionState = {
  event: EventRow
  completedAt: string
  phase: 'acknowledged' | 'history'
  isSyncing: boolean
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0')
}

function toDateKey(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return `${parsed.getFullYear()}-${padDatePart(parsed.getMonth() + 1)}-${padDatePart(parsed.getDate())}`
}

function fromDateKey(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return null
  }

  const [, year, month, day] = match
  return new Date(Number(year), Number(month) - 1, Number(day))
}

function addDays(dateKey: string, days: number) {
  const base = fromDateKey(dateKey)
  if (!base) {
    return dateKey
  }

  base.setDate(base.getDate() + days)
  return `${base.getFullYear()}-${padDatePart(base.getMonth() + 1)}-${padDatePart(base.getDate())}`
}

function getTodayDateKey() {
  const now = new Date()
  return `${now.getFullYear()}-${padDatePart(now.getMonth() + 1)}-${padDatePart(now.getDate())}`
}

function getMonthEndDateKey(dateKey: string) {
  const base = fromDateKey(dateKey)
  if (!base) {
    return dateKey
  }

  return `${base.getFullYear()}-${padDatePart(base.getMonth() + 1)}-${padDatePart(new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate())}`
}

function formatDueLabel(value: string) {
  const normalized = toDateKey(value)
  const date = fromDateKey(normalized)
  if (!date) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatHistoryHeading(value: string) {
  const date = fromDateKey(value)
  if (!date) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatCurrency(value: number | null) {
  return formatNullableCurrency(value)
}

function resolveEventAmount(event: EventRow) {
  if (isCompletedEvent(event) && typeof event.actual_amount === 'number' && Number.isFinite(event.actual_amount)) {
    return event.actual_amount
  }

  return event.amount
}

function formatEventAmount(event: EventRow, item: ItemRow | undefined) {
  const formatted = formatCurrency(resolveEventAmount(event))
  if (!formatted) {
    return null
  }

  return item && isIncomeItem(item) ? `+${formatted}` : formatted
}

function isProjectedEvent(event: EventRow) {
  if (event.source_state === 'projected') {
    return true
  }

  if (event.source_state === 'persisted') {
    return false
  }

  if (typeof event.is_projected === 'boolean') {
    return event.is_projected
  }

  return event.id.startsWith('projected-')
}

function isCompletedEvent(event: EventRow) {
  return event.status.trim().toLowerCase() === 'completed'
}

function isManualOverrideEvent(event: EventRow) {
  return event.is_manual_override === true
}

function getCompletedDateKey(event: EventRow) {
  return toDateKey(event.completed_at || event.updated_at || event.due_date)
}

function getHistoryMonthKey(event: EventRow) {
  const date = fromDateKey(getCompletedDateKey(event))
  if (!date) {
    return getCompletedDateKey(event)
  }

  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-01`
}

function compareCompletedEvents(left: EventRow, right: EventRow) {
  return getCompletedDateKey(right).localeCompare(getCompletedDateKey(left)) || right.updated_at.localeCompare(left.updated_at) || left.id.localeCompare(right.id)
}

function buildHistoryGroups(events: EventRow[]) {
  const groups = new Map<string, EventRow[]>()

  events.forEach((event) => {
    const key = getHistoryMonthKey(event)
    const rows = groups.get(key) ?? []
    rows.push(event)
    groups.set(key, rows)
  })

  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([key, rows]) => ({
      key,
      label: formatHistoryHeading(key),
      events: rows.sort(compareCompletedEvents),
    }))
}

function getFrequencyLabel(value: string | null | undefined, t: (key: string) => string) {
  switch (value) {
    case 'weekly':
      return t('events.recurrence.weekly')
    case 'biweekly':
      return t('events.recurrence.biweekly')
    case 'monthly':
      return t('events.recurrence.monthly')
    case 'quarterly':
      return t('events.recurrence.quarterly')
    case 'yearly':
      return t('events.recurrence.yearly')
    case 'one_time':
      return t('events.recurrence.oneTime')
    default:
      return t('events.recurrence.custom')
  }
}

function getItemStatus(item: ItemRow) {
  if (item.status && item.status.length > 0) {
    return item.status
  }

  const attributeStatus = item.attributes?.status
  return typeof attributeStatus === 'string' && attributeStatus.length > 0 ? attributeStatus : null
}

function getItemFrequency(item: ItemRow) {
  if (item.frequency && item.frequency.length > 0) {
    return item.frequency
  }

  const attributeFrequency = item.attributes?.billingCycle ?? item.attributes?.frequency
  return typeof attributeFrequency === 'string' && attributeFrequency.length > 0 ? attributeFrequency : null
}

function getRecurrenceText(item: ItemRow | undefined, event: EventRow, nextByItemId: Map<string, string>, t: (key: string, options?: Record<string, unknown>) => string) {
  if (!item) {
    return null
  }

  if (getItemStatus(item) === 'Closed') {
    return t('events.recurrence.closed')
  }

  const frequencyLabel = getFrequencyLabel(getItemFrequency(item), t)
  const nextDue = nextByItemId.get(event.item_id)
  if (!nextDue) {
    return t('events.recurrence.summaryNoDate', { frequency: frequencyLabel })
  }

  return t('events.recurrence.summary', {
    frequency: frequencyLabel,
    date: formatDueLabel(nextDue),
  })
}

function getUpcomingBucketKey(dueDate: string, todayDateKey: string, weekEndDateKey: string, monthEndDateKey: string): UpcomingBucketKey {
  const dueDateKey = toDateKey(dueDate)

  if (dueDateKey < todayDateKey) {
    return 'overdue'
  }

  if (dueDateKey <= weekEndDateKey) {
    return 'thisWeek'
  }

  if (dueDateKey <= monthEndDateKey) {
    return 'laterThisMonth'
  }

  return 'future'
}

function buildUpcomingBuckets(events: EventRow[], labels: Record<UpcomingBucketKey, { label: string; hint?: string }>, todayDateKey: string) {
  const weekEndDateKey = addDays(todayDateKey, 6)
  const monthEndDateKey = getMonthEndDateKey(todayDateKey)
  const groups = new Map<UpcomingBucketKey, EventRow[]>([
    ['overdue', []],
    ['thisWeek', []],
    ['laterThisMonth', []],
    ['future', []],
  ])

  events.forEach((event) => {
    const key = getUpcomingBucketKey(event.due_date, todayDateKey, weekEndDateKey, monthEndDateKey)
    groups.get(key)?.push(event)
  })

  return (Object.keys(labels) as UpcomingBucketKey[])
    .map((key) => ({
      key,
      label: labels[key].label,
      hint: labels[key].hint,
      events: (groups.get(key) ?? []).sort(compareByNearestDue),
    }))
    .filter((bucket) => bucket.events.length > 0)
}

function EventsSkeleton() {
  const { t } = useTranslation()

  return (
    <section className="space-y-4" aria-label={t('events.loadingAria')}>
      <div className="sticky top-4 z-30 rounded-3xl border border-border/70 bg-background/95 p-4 shadow-sm backdrop-blur">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="h-10 animate-pulse rounded-2xl bg-muted/80" />
          <div className="h-10 animate-pulse rounded-2xl bg-muted/80" />
        </div>
      </div>
      {Array.from({ length: 3 }).map((_, index) => (
        <section key={index} className="space-y-3">
          <div className="sticky top-28 z-20 rounded-2xl border border-border/60 bg-background/90 px-4 py-3 shadow-sm backdrop-blur">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-3 w-48 animate-pulse rounded bg-muted/70" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((__, row) => (
              <div key={row} className="h-24 animate-pulse rounded-3xl border border-border/60 bg-card/80" />
            ))}
          </div>
        </section>
      ))}
    </section>
  )
}

function UpcomingEmptyState() {
  const { t } = useTranslation()

  return (
    <section className="rounded-3xl border border-dashed border-border/70 bg-card/70 px-6 py-10 text-center shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t('events.upcomingTitle')}</p>
      <h2 className="mt-3 text-2xl font-semibold text-foreground">{t('events.empty.title')}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{t('events.empty.description')}</p>
    </section>
  )
}

function HistoryEmptyState() {
  const { t } = useTranslation()

  return (
    <section className="rounded-3xl border border-dashed border-border/70 bg-card/70 px-6 py-10 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t('events.historyTitle')}</p>
      <h2 className="mt-3 text-2xl font-semibold text-foreground">{t('events.historyEmpty.title')}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{t('events.historyEmpty.description')}</p>
    </section>
  )
}

function PaidAcknowledgementRow({ event }: { event: EventRow }) {
  const { t } = useTranslation()

  return (
    <article
      data-event-row-id={event.id}
      data-paid-acknowledged="true"
      className="rounded-3xl border border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(255,255,255,0.98))] px-4 py-4 shadow-sm"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">{event.type}</h3>
            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
              {t('events.markPaid.paidBadge')}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{t('events.markPaid.acknowledged')}</p>
        </div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{t('events.markPaid.today', { date: formatDueLabel(event.completed_at || event.due_date) })}</p>
      </div>
    </article>
  )
}

function AdminSuppressionNotice({ suppressedCount }: { suppressedCount: number }) {
  const { t } = useTranslation()

  return (
    <section
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-sky-200 bg-[linear-gradient(135deg,rgba(239,246,255,0.94),rgba(255,255,255,0.98))] px-4 py-3 shadow-sm"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">{t('events.adminNotice.eyebrow')}</p>
          <p className="mt-1 text-sm font-medium text-foreground">{t('events.adminNotice.title', { count: suppressedCount })}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('events.adminNotice.description')}</p>
        </div>
        <span className="rounded-full border border-sky-300 bg-white/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
          {t('events.adminNotice.badge', { count: suppressedCount })}
        </span>
      </div>
    </section>
  )
}

function EventsErrorState({ onRetry, isRetrying }: { onRetry: () => void; isRetrying: boolean }) {
  const { t } = useTranslation()

  return (
    <section className="rounded-3xl border border-border/70 bg-card/80 px-6 py-8 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t('events.error.eyebrow')}</p>
      <h2 className="mt-3 text-xl font-semibold text-foreground">{t('events.error.title')}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{t('events.error.description')}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex rounded-2xl border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
      >
        {isRetrying ? t('events.error.retrying') : t('events.error.retry')}
      </button>
    </section>
  )
}

export function EventsPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const { isAdmin, mode, lensUserId } = useAdminScope()
  const [activeTab, setActiveTab] = useState<LedgerTab>('upcoming')
  const [activeReconcileEventId, setActiveReconcileEventId] = useState<string | null>(null)
  const [localCompletions, setLocalCompletions] = useState<Record<string, LocalCompletionState>>({})
  const [highlightedHistoryKeys, setHighlightedHistoryKeys] = useState<string[]>([])
  const acknowledgementTimersRef = useRef<Record<string, number>>({})
  const highlightTimersRef = useRef<Record<string, number>>({})

  const lensScope = useMemo(
    () => ({ mode, lensUserId: mode === 'owner' ? lensUserId : null }),
    [lensUserId, mode],
  )
  const lensParams = useMemo(() => lensScopeToParams(lensScope), [lensScope])
  const listParams = useMemo(() => eventListParams(lensScope, 'all'), [lensScope])

  const eventsQuery = useQuery({
    queryKey: queryKeys.events.list(listParams),
    queryFn: async () => {
      const params = new URLSearchParams(listParams)
      return apiRequest<EventsResponse>(`/events?${params.toString()}`)
    },
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const itemsQuery = useQuery({
    queryKey: queryKeys.items.list({ scope: 'events-item-lookup', filter: 'all', sort: 'recently_updated', ...lensParams }),
    queryFn: async () => {
      const params = new URLSearchParams({ filter: 'all', sort: 'recently_updated', ...lensParams })
      return apiRequest<ItemsResponse>(`/items?${params.toString()}`)
    },
    staleTime: 0,
    refetchOnMount: 'always',
  })

  useEffect(() => {
    void eventsQuery.refetch()
    void itemsQuery.refetch()
  }, [eventsQuery.refetch, itemsQuery.refetch, location.pathname, location.search])

  const itemById = useMemo(() => {
    const rows = itemsQuery.data?.items ?? []
    return new Map(rows.map((item) => [item.id, item]))
  }, [itemsQuery.data?.items])

  const itemNameById = useMemo(() => {
    const rows = itemsQuery.data?.items ?? []
    return new Map(rows.map((item) => [item.id, getItemDisplayName(item)]))
  }, [itemsQuery.data?.items])

  const todayDateKey = useMemo(() => getTodayDateKey(), [])

  useEffect(() => {
    return () => {
      Object.values(acknowledgementTimersRef.current).forEach((timerId) => window.clearTimeout(timerId))
      Object.values(highlightTimersRef.current).forEach((timerId) => window.clearTimeout(timerId))
    }
  }, [])

  const serverCompletedEvents = useMemo(() => {
    const source = eventsQuery.data?.groups ?? []
    return source.flatMap((group) => group.events).filter((event) => isCompletedEvent(event))
  }, [eventsQuery.data])

  const serverCompletedIds = useMemo(() => new Set(serverCompletedEvents.map((event) => event.id)), [serverCompletedEvents])

  useEffect(() => {
    if (serverCompletedIds.size === 0) {
      return
    }

    setLocalCompletions((current) => {
      let changed = false
      const nextEntries = Object.entries(current).map(([eventId, state]) => {
        if (state.phase !== 'history' || !state.isSyncing || !serverCompletedIds.has(eventId)) {
          return [eventId, state] as const
        }

        changed = true
        return [eventId, { ...state, isSyncing: false }] as const
      })

      return changed ? Object.fromEntries(nextEntries) : current
    })
  }, [serverCompletedIds])

  const upcomingEvents = useMemo(() => {
    const source = eventsQuery.data?.groups ?? []
    return source
      .flatMap((group) => group.events)
      .filter((event) => isCompletedEvent(event) === false)
      .filter((event) => localCompletions[event.id]?.phase !== 'history')
  }, [eventsQuery.data, localCompletions])

  const historyGroups = useMemo<HistoryGroup[]>(() => {
    const merged = new Map<string, EventRow>()

    serverCompletedEvents.forEach((event) => {
      merged.set(event.id, event)
    })

    Object.values(localCompletions).forEach((state) => {
      if (state.phase !== 'history') {
        return
      }

      const serverEvent = merged.get(state.event.id)
      merged.set(state.event.id, {
        ...(serverEvent ?? state.event),
        status: 'Completed',
        completed_at: serverEvent?.completed_at || state.completedAt,
        updated_at: serverEvent?.updated_at || state.completedAt,
      })
    })

    return buildHistoryGroups([...merged.values()])
  }, [localCompletions, serverCompletedEvents])

  const nextDueByItemId = useMemo(() => {
    const upcoming = [...upcomingEvents].sort(compareByNearestDue)
    const map = new Map<string, string>()

    upcoming.forEach((event) => {
      if (!map.has(event.item_id)) {
        map.set(event.item_id, event.due_date)
      }
    })

    return map
  }, [upcomingEvents])

  const upcomingBuckets = useMemo(
    () =>
      buildUpcomingBuckets(
        upcomingEvents,
        {
          overdue: { label: t('events.groups.overdue') },
          thisWeek: {
            label: t('events.groups.thisWeek'),
            hint: t('events.groups.thisWeekHint'),
          },
          laterThisMonth: { label: t('events.groups.laterThisMonth') },
          future: { label: t('events.groups.future') },
        },
        todayDateKey,
      ),
    [t, todayDateKey, upcomingEvents],
  )

  const suppressedInvalidProjectedCount = eventsQuery.data?.meta?.suppressed_invalid_projected_count ?? 0
  const showAdminSuppressionNotice = isAdmin && suppressedInvalidProjectedCount > 0

  const hasRenderableEvents = Boolean(eventsQuery.data)
  const hasRenderableItems = Boolean(itemsQuery.data)
  const waitingForEventsRefresh = eventsQuery.isFetching && ((eventsQuery.data?.total_count ?? 0) === 0)
  const waitingForItemsRefresh = itemsQuery.isFetching && !hasRenderableItems
  const isLoading = (eventsQuery.isLoading && !hasRenderableEvents) || (itemsQuery.isLoading && !hasRenderableItems) || waitingForEventsRefresh || waitingForItemsRefresh
  const isError = (!hasRenderableEvents && eventsQuery.isError) || (!hasRenderableItems && itemsQuery.isError)
  const isRetrying = eventsQuery.isFetching || itemsQuery.isFetching

  const retryQueries = () => {
    void eventsQuery.refetch()
    void itemsQuery.refetch()
  }

  const markEventAsPaid = (
    event: EventRow,
    completion?: {
      amount?: number | null
      actual_amount?: number | null
      actual_date?: string | null
      completed_at?: string | null
    },
  ) => {
    const resolvedAmount =
      typeof completion?.actual_amount === 'number' && Number.isFinite(completion.actual_amount)
        ? completion.actual_amount
        : typeof completion?.amount === 'number' && Number.isFinite(completion.amount)
          ? completion.amount
          : event.amount

    return {
      ...event,
      amount: resolvedAmount,
      actual_amount:
        typeof completion?.actual_amount === 'number' && Number.isFinite(completion.actual_amount)
          ? completion.actual_amount
          : event.actual_amount,
      actual_date: completion?.actual_date ?? event.actual_date,
      status: 'Completed',
      completed_at: completion?.completed_at || todayDateKey,
      updated_at: new Date().toISOString(),
    }
  }

  const scheduleHistoryHighlight = (eventId: string) => {
    setHighlightedHistoryKeys((current) => (current.includes(eventId) ? current : [...current, eventId]))

    if (highlightTimersRef.current[eventId]) {
      window.clearTimeout(highlightTimersRef.current[eventId])
    }

    highlightTimersRef.current[eventId] = window.setTimeout(() => {
      setHighlightedHistoryKeys((current) => current.filter((key) => key !== eventId))
      delete highlightTimersRef.current[eventId]
    }, 1400)
  }

  const handleMarkPaidSuccess = (
    event: EventRow,
    completion?: {
      amount?: number | null
      actual_amount?: number | null
      actual_date?: string | null
      completed_at?: string | null
    },
  ) => {
    const nextEvent = markEventAsPaid(event, completion)

    setLocalCompletions((current) => ({
      ...current,
      [event.id]: {
        event: nextEvent,
        completedAt: todayDateKey,
        phase: 'acknowledged',
        isSyncing: true,
      },
    }))

    if (acknowledgementTimersRef.current[event.id]) {
      window.clearTimeout(acknowledgementTimersRef.current[event.id])
    }

    acknowledgementTimersRef.current[event.id] = window.setTimeout(() => {
      setLocalCompletions((current) => {
        const state = current[event.id]
        if (!state) {
          return current
        }

        return {
          ...current,
          [event.id]: {
            ...state,
            phase: 'history',
          },
        }
      })
      scheduleHistoryHighlight(event.id)
      delete acknowledgementTimersRef.current[event.id]
    }, 750)
  }

  return (
    <section className="space-y-4 pb-6">
      <motion.header
        initial="initial"
        animate="animate"
        exit="exit"
        variants={panelItemVariants}
        data-events-header="true"
        className="sticky top-4 z-30 overflow-hidden rounded-3xl border border-border/70 bg-background/95 shadow-sm backdrop-blur"
      >
        <div className="bg-[linear-gradient(135deg,rgba(15,23,42,0.04),rgba(185,28,28,0.06),rgba(15,23,42,0.02))] px-5 py-5">
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('events.eyebrow')}</p>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('events.title')}</h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{t('events.subtitle')}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div
                role="tablist"
                aria-label={t('events.tabs.ariaLabel')}
                className="inline-flex rounded-2xl border border-border bg-card/80 p-1 shadow-sm"
              >
                {([
                  { key: 'upcoming', label: t('events.upcomingTitle') },
                  { key: 'history', label: t('events.historyTitle') },
                ] as Array<{ key: LedgerTab; label: string }>).map((tab) => {
                  const selected = activeTab === tab.key

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-controls={`events-panel-${tab.key}`}
                      onClick={() => setActiveTab(tab.key)}
                      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                        selected
                          ? 'bg-foreground text-background shadow-sm'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs leading-5 text-muted-foreground">{t('events.tabHint')}</p>
            </div>
            {showAdminSuppressionNotice ? <AdminSuppressionNotice suppressedCount={suppressedInvalidProjectedCount} /> : null}
          </div>
        </div>
      </motion.header>

      {isLoading ? <EventsSkeleton /> : null}
      {isError ? <EventsErrorState onRetry={retryQueries} isRetrying={isRetrying} /> : null}

      {isLoading || isError ? null : activeTab === 'upcoming' ? (
        <section id="events-panel-upcoming" role="tabpanel" aria-label={t('events.upcomingTitle')} className="space-y-4">
          {upcomingBuckets.length === 0 ? (
            <UpcomingEmptyState />
          ) : (
            upcomingBuckets.map((bucket) => (
              <section key={bucket.key} data-event-group={bucket.key} className="space-y-3">
                <div
                  data-sticky="true"
                  className="sticky top-28 z-20 rounded-2xl border border-border/70 bg-background/92 px-4 py-3 shadow-sm backdrop-blur"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">{bucket.label}</h2>
                      {bucket.hint ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{bucket.hint}</p> : null}
                    </div>
                    <p className="text-xs text-muted-foreground">{t('events.groupCount', { count: bucket.events.length })}</p>
                  </div>
                </div>

                 <MotionPanelList
                   items={bucket.events}
                   getItemKey={(event) => event.id}
                   className="space-y-2"
                   itemClassName="overflow-hidden rounded-3xl"
                    renderItem={(event) => {
                      const localCompletion = localCompletions[event.id]
                      const item = itemById.get(event.item_id)
                      const projected = isProjectedEvent(event)
                      const recurrence = getRecurrenceText(item, event, nextDueByItemId, t)
                      const overdue = bucket.key === 'overdue'
                      const isAnotherReconcileActive = activeReconcileEventId !== null && activeReconcileEventId !== event.id
                      const isPendingAcknowledgement = localCompletion?.phase === 'acknowledged' || localCompletion?.isSyncing === true
                      const disableReconcile = isAnotherReconcileActive || isPendingAcknowledgement

                     if (localCompletion?.phase === 'acknowledged') {
                       return <PaidAcknowledgementRow event={localCompletion.event} />
                     }

                     return (
                       <article
                        data-event-row-id={event.id}
                        data-overdue={overdue ? 'true' : 'false'}
                        className={`list-none rounded-3xl border px-4 py-4 shadow-sm transition ${
                          overdue
                            ? 'border-red-200 bg-[linear-gradient(135deg,rgba(254,242,242,0.98),rgba(255,255,255,0.98))]'
                            : 'border-border/70 bg-card/90'
                        }`}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold text-foreground">{event.type}</h3>
                              {overdue ? (
                                <span className="rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-700">
                                  {t('events.badges.overdue')}
                                </span>
                              ) : null}
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                  projected
                                    ? 'border-sky-300 bg-sky-50 text-sky-700'
                                    : 'border-border bg-background text-foreground'
                                }`}
                              >
                                {projected ? t('events.stateLegend.projected') : t('events.stateLegend.persisted')}
                              </span>
                              {event.is_exception ? (
                                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                                  {t('events.stateLegend.editedOccurrence')}
                                </span>
                              ) : null}
                            </div>

                            <p className="text-sm text-muted-foreground">
                              <Link
                                to={`/items/${event.item_id}`}
                                state={{ from: location.pathname + location.search }}
                                className="font-medium text-primary underline-offset-2 hover:underline"
                              >
                                {itemNameById.get(event.item_id) ?? t('events.itemLabel', { itemId: event.item_id })}
                              </Link>
                            </p>

                            {recurrence ? <p className="text-xs leading-5 text-muted-foreground">{recurrence}</p> : null}
                          </div>

                           <div className="flex flex-col items-stretch gap-3 lg:items-end">
                             <dl className="grid min-w-[12rem] grid-cols-2 gap-3 text-sm lg:max-w-xs">
                               <div className="rounded-2xl bg-background/70 px-3 py-2">
                                 <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t('events.card.dueDate')}</dt>
                                 <dd className="mt-1 font-medium text-foreground">{formatDueLabel(event.due_date)}</dd>
                               </div>
                               <div className="rounded-2xl bg-background/70 px-3 py-2">
                                 <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t('events.card.amount')}</dt>
                                 <dd className="mt-1 font-medium text-foreground">{formatEventAmount(event, item) ?? t('events.amountPending')}</dd>
                               </div>
                             </dl>
                              <ReconcileLedgerAction
                                eventId={event.id}
                                itemId={event.item_id}
                                projectedAmount={event.amount}
                                projectedDate={event.due_date}
                                disabled={disableReconcile}
                                onOpenChange={(open) => {
                                  setActiveReconcileEventId((current) => {
                                    if (open) {
                                      return event.id
                                    }

                                    return current === event.id ? null : current
                                  })
                                }}
                                onSuccess={(payload) => handleMarkPaidSuccess(event, payload)}
                              />
                            </div>
                         </div>
                       </article>
                     )
                   }}
                />
              </section>
            ))
          )}
        </section>
      ) : (
        <section id="events-panel-history" role="tabpanel" aria-label={t('events.historyTitle')} className="space-y-4">
          {historyGroups.length === 0 ? (
            <HistoryEmptyState />
          ) : (
            historyGroups.map((group) => (
              <section key={group.key} data-history-group={group.key} className="space-y-3">
                <div className="sticky top-28 z-20 rounded-2xl border border-border/70 bg-background/92 px-4 py-3 shadow-sm backdrop-blur">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">{group.label}</h2>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('events.historyGroupHint')}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('events.groupCount', { count: group.events.length })}</p>
                  </div>
                </div>

                <MotionPanelList
                  items={group.events}
                  getItemKey={(event) => event.id}
                  highlightedKeys={highlightedHistoryKeys}
                  className="space-y-2"
                  itemClassName="overflow-hidden rounded-3xl"
                   renderItem={(event) => {
                     const item = itemById.get(event.item_id)
                     const manualOverride = isManualOverrideEvent(event)
                     const isSyncing = localCompletions[event.id]?.phase === 'history' && localCompletions[event.id]?.isSyncing
                     const isHighlighted = highlightedHistoryKeys.includes(event.id)

                     return (
                       <article
                         data-event-row-id={event.id}
                         data-manual-override={manualOverride ? 'true' : 'false'}
                         data-history-highlighted={isHighlighted ? 'true' : 'false'}
                         className={`rounded-3xl border px-4 py-4 shadow-sm ${
                           manualOverride
                             ? 'border-amber-300 bg-[linear-gradient(135deg,rgba(255,251,235,0.98),rgba(255,255,255,0.98))]'
                             : 'border-border/70 bg-card/90'
                         }`}
                       >
                         <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                           <div className="min-w-0 space-y-2">
                             <div className="flex flex-wrap items-center gap-2">
                               <h3 className="text-base font-semibold text-foreground">{event.type}</h3>
                               {manualOverride ? (
                                 <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-900">
                                   {t('events.manualOverride.badge')}
                                 </span>
                               ) : null}
                               <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                                 {t('events.historyPaidBadge')}
                               </span>
                             </div>
                              <p className="text-sm text-muted-foreground">{t('events.historyPaidOn', { date: formatDueLabel(event.completed_at || event.due_date) })}</p>
                             {manualOverride ? <p className="text-sm font-medium leading-6 text-amber-900">{t('events.manualOverride.description')}</p> : null}
                             <p className="text-sm text-muted-foreground">
                               <Link
                                 to={`/items/${event.item_id}`}
                                state={{ from: location.pathname + location.search }}
                                className="font-medium text-primary underline-offset-2 hover:underline"
                              >
                                {itemNameById.get(event.item_id) ?? t('events.itemLabel', { itemId: event.item_id })}
                              </Link>
                            </p>
                            {isSyncing ? <p className="text-xs leading-5 text-muted-foreground">{t('events.markPaid.historyCatchingUp')}</p> : null}
                          </div>

                          <dl className="grid min-w-[12rem] grid-cols-2 gap-3 text-sm lg:max-w-xs">
                            <div className="rounded-2xl bg-background/70 px-3 py-2">
                              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t('events.historyCard.paidDate')}</dt>
                              <dd className="mt-1 font-medium text-foreground">{formatDueLabel(event.completed_at || event.due_date)}</dd>
                            </div>
                            <div className="rounded-2xl bg-background/70 px-3 py-2">
                              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t('events.historyCard.amount')}</dt>
                              <dd className="mt-1 font-medium text-foreground">{formatEventAmount(event, item) ?? t('events.amountPending')}</dd>
                            </div>
                          </dl>
                        </div>
                      </article>
                    )
                  }}
                />
              </section>
            ))
          )}
        </section>
      )}
    </section>
  )
}
