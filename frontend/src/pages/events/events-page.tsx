import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { MotionPanelList } from '@/components/ui/motion-panel-list'
import { CompleteEventRowAction } from '../../features/events/complete-event-row-action'
import { EditEventRowAction } from '../../features/events/edit-event-row-action'
import { useAdminScope } from '../../features/admin-scope/admin-scope-context'
import { apiRequest } from '../../lib/api-client'
import { compareByNearestDue, compareGroupsByNearestDue } from '../../lib/date-ordering'
import { getItemDisplayName, isIncomeItem } from '../../lib/item-display'
import { panelItemVariants } from '../../lib/motion'
import { eventListParams, lensScopeToParams, queryKeys } from '../../lib/query-keys'

type EventRow = {
  id: string
  item_id: string
  type: string
  amount: number | null
  due_date: string
  status: string
  updated_at: string
  source_state?: 'projected' | 'persisted' | string
  is_projected?: boolean
  is_exception?: boolean
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
    return null
  }

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatEventAmount(event: EventRow, item: ItemRow | undefined) {
  const formatted = formatCurrency(event.amount)
  if (!formatted) {
    return null
  }

  return item && isIncomeItem(item) ? `+${formatted}` : formatted
}

function toGroupedEvents(events: EventRow[]): EventGroup[] {
  const groups = new Map<string, EventRow[]>()

  events.forEach((event) => {
    const key = new Date(event.due_date).toISOString().slice(0, 10)
    const current = groups.get(key) ?? []
    current.push(event)
    groups.set(key, current)
  })

  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([due_date, groupedEvents]) => ({ due_date, events: groupedEvents.sort(compareByNearestDue) }))
}

function toStartOfTodayUtc() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime()
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

function isOverdueEvent(event: EventRow, todayStart: number) {
  return isCompletedEvent(event) === false && new Date(event.due_date).getTime() < todayStart
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
  const { t } = useTranslation()

  return (
    <section className="rounded-2xl border border-dashed border-border bg-card/70 p-8 text-center">
      <h1 className="text-lg font-semibold">{t('events.noPendingTitle')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('events.noPendingDescription')}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link to="/items/create/wizard" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          {t('events.createItem')}
        </Link>
        <Link to="/dashboard" className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground">
          {t('events.returnDashboard')}
        </Link>
      </div>
    </section>
  )
}

export function EventsPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const { mode, lensUserId } = useAdminScope()
  const [activeTab, setActiveTab] = useState<'present' | 'history'>('present')

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
  })

  const itemsQuery = useQuery({
    queryKey: queryKeys.items.list({ scope: 'events-item-lookup', filter: 'all', sort: 'recently_updated', ...lensParams }),
    queryFn: async () => {
      const params = new URLSearchParams({ filter: 'all', sort: 'recently_updated', ...lensParams })
      return apiRequest<ItemsResponse>(`/items?${params.toString()}`)
    },
  })

  const groupedSections = useMemo(() => {
    const source = eventsQuery.data?.groups ?? []
    const merged = source.flatMap((group) => group.events)
    const present = merged.filter((event) => isCompletedEvent(event) === false)
    const history = merged.filter((event) => isCompletedEvent(event))

    return {
      present: toGroupedEvents(present).sort(compareGroupsByNearestDue),
      history: toGroupedEvents(history).sort((left, right) => right.due_date.localeCompare(left.due_date)),
    }
  }, [eventsQuery.data])

  const presentCount = useMemo(() => groupedSections.present.reduce((total, group) => total + group.events.length, 0), [groupedSections.present])
  const historyCount = useMemo(() => groupedSections.history.reduce((total, group) => total + group.events.length, 0), [groupedSections.history])
  const todayStart = useMemo(() => toStartOfTodayUtc(), [])

  const itemById = useMemo(() => {
    const rows = itemsQuery.data?.items ?? []
    return new Map(rows.map((item) => [item.id, item]))
  }, [itemsQuery.data?.items])

  const itemNameById = useMemo(() => {
    const rows = itemsQuery.data?.items ?? []
    return new Map(rows.map((item) => [item.id, getItemDisplayName(item)]))
  }, [itemsQuery.data?.items])

  const nextDueByItemId = useMemo(() => {
    const source = eventsQuery.data?.groups ?? []
    const merged = source.flatMap((group) => group.events)
    const todayStart = toStartOfTodayUtc()
    const upcoming = merged
      .filter((event) => isCompletedEvent(event) === false)
      .filter((event) => new Date(event.due_date).getTime() >= todayStart)
      .sort((left, right) => left.due_date.localeCompare(right.due_date))

    const map = new Map<string, string>()
    upcoming.forEach((event) => {
      if (!map.has(event.item_id)) {
        map.set(event.item_id, event.due_date)
      }
    })

    return map
  }, [eventsQuery.data])

  if (eventsQuery.isLoading || itemsQuery.isLoading) {
    return <EventsSkeleton />
  }

  if (eventsQuery.isError || itemsQuery.isError) {
    return (
        <section className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
        {t('events.loadError')}
      </section>
    )
  }

  if (groupedSections.present.length === 0 && groupedSections.history.length === 0) {
    return <EventsEmptyState />
  }

  return (
    <section className="space-y-4">
      <motion.header
        initial="initial"
        animate="animate"
        exit="exit"
        variants={panelItemVariants}
        data-events-header="true"
        className="rounded-2xl border border-border bg-card p-4 shadow-sm"
      >
        <h1 className="text-xl font-semibold">{t('events.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('events.subtitle')}</p>
        <div className="mt-3 inline-flex rounded-lg border border-border bg-background p-1 text-sm">
          <button
            type="button"
            onClick={() => setActiveTab('present')}
            className={`rounded-md px-3 py-1 font-medium ${
              activeTab === 'present' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('events.upcomingTitle')} ({presentCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`rounded-md px-3 py-1 font-medium ${
              activeTab === 'history' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('events.historyTitle')} ({historyCount})
          </button>
        </div>
      </motion.header>

      {activeTab === 'present' ? <section className="space-y-3">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('events.upcomingTitle')}</h2>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>{t('events.stateLegend.label')}</span>
            <span className="rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 font-medium text-sky-700">{t('events.stateLegend.projected')}</span>
            <span className="rounded-full border border-border bg-background px-2 py-0.5 font-medium text-foreground">{t('events.stateLegend.persisted')}</span>
            <span className="rounded-full border border-red-300 bg-red-50 px-2 py-0.5 font-medium text-red-700">{t('dashboard.overdue')}</span>
          </div>
        </div>
        {groupedSections.present.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground">{t('events.noUpcoming')}</p>
        ) : (
          <MotionPanelList
            items={groupedSections.present}
            getItemKey={(group) => `upcoming-${group.due_date}`}
            className="space-y-3"
            itemClassName="rounded-2xl"
            renderItem={(group) => (
              <section data-event-group-id={`upcoming-${group.due_date}`} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground">{formatDueLabel(group.due_date)}</h3>
                <MotionPanelList
                  items={group.events}
                  getItemKey={(event) => event.id}
                  className="mt-3 space-y-2"
                  itemClassName="overflow-hidden rounded-xl"
                  renderItem={(event) => {
                    const projected = isProjectedEvent(event)
                    const overdue = isOverdueEvent(event, todayStart)

                    return (
                      <li
                        data-event-row-id={event.id}
                        className={`hover-lift flex list-none flex-col gap-2 rounded-xl border p-3 md:flex-row md:items-center md:justify-between ${
                          overdue
                            ? 'border-red-300 bg-red-50/45'
                            : projected
                              ? 'border-sky-200 bg-sky-50/25'
                              : 'border-border bg-background/70'
                        }`}
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{event.type}</p>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                projected
                                  ? 'border-sky-300 bg-sky-50 text-sky-700'
                                  : 'border-border bg-background text-foreground'
                              }`}
                            >
                              {projected ? t('events.stateLegend.projected') : t('events.stateLegend.persisted')}
                            </span>
                            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium">{event.status}</span>
                            {overdue ? (
                              <span className="rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                                {t('dashboard.overdue')}
                              </span>
                            ) : null}
                            {event.is_exception ? (
                              <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                                {t('events.stateLegend.editedOccurrence')}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            <Link to={`/items/${event.item_id}`} state={{ from: location.pathname + location.search }} className="text-primary underline-offset-2 hover:underline">
                              {itemNameById.get(event.item_id) ?? t('events.itemLabel', { itemId: event.item_id })}
                            </Link>
                          </p>
                          {getRecurrenceText(itemById.get(event.item_id), event, nextDueByItemId, t) ? (
                            <p className="mt-1 text-xs text-muted-foreground">{getRecurrenceText(itemById.get(event.item_id), event, nextDueByItemId, t)}</p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">{formatEventAmount(event, itemById.get(event.item_id)) ?? t('events.amountPending')}</div>
                          <EditEventRowAction
                            eventId={event.id}
                            itemId={event.item_id}
                            eventStatus={event.status}
                            dueDate={event.due_date}
                            amount={event.amount}
                            isProjected={projected}
                          />
                          <CompleteEventRowAction eventId={event.id} itemId={event.item_id} eventStatus={event.status} />
                        </div>
                      </li>
                    )
                  }}
                />
              </section>
            )}
          />
        )}
      </section> : null}

      {activeTab === 'history' ? <section className="space-y-3">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('events.historyTitle')}</h2>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>{t('events.stateLegend.label')}</span>
            <span className="rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 font-medium text-sky-700">{t('events.stateLegend.projected')}</span>
            <span className="rounded-full border border-border bg-background px-2 py-0.5 font-medium text-foreground">{t('events.stateLegend.persisted')}</span>
          </div>
        </div>
        {groupedSections.history.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground">{t('events.noHistory')}</p>
        ) : (
          <MotionPanelList
            items={groupedSections.history}
            getItemKey={(group) => `history-${group.due_date}`}
            className="space-y-3"
            itemClassName="rounded-2xl"
            renderItem={(group) => (
              <section data-event-group-id={`history-${group.due_date}`} className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground">{formatDueLabel(group.due_date)}</h3>
                <MotionPanelList
                  items={group.events}
                  getItemKey={(event) => event.id}
                  className="mt-3 space-y-2"
                  itemClassName="overflow-hidden rounded-xl"
                  renderItem={(event) => {
                    const projected = isProjectedEvent(event)

                    return (
                      <li
                        data-event-row-id={event.id}
                        className={`hover-lift flex list-none flex-col gap-2 rounded-xl border p-3 md:flex-row md:items-center md:justify-between ${
                          projected ? 'border-sky-200 bg-sky-50/20' : 'border-border bg-background/65'
                        }`}
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{event.type}</p>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                projected
                                  ? 'border-sky-300 bg-sky-50 text-sky-700'
                                  : 'border-border bg-background text-foreground'
                              }`}
                            >
                              {projected ? t('events.stateLegend.projected') : t('events.stateLegend.persisted')}
                            </span>
                            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium">{event.status}</span>
                            {event.is_exception ? (
                              <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                                {t('events.stateLegend.editedOccurrence')}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            <Link to={`/items/${event.item_id}`} state={{ from: location.pathname + location.search }} className="text-primary underline-offset-2 hover:underline">
                              {itemNameById.get(event.item_id) ?? t('events.itemLabel', { itemId: event.item_id })}
                            </Link>
                          </p>
                          {getRecurrenceText(itemById.get(event.item_id), event, nextDueByItemId, t) ? (
                            <p className="mt-1 text-xs text-muted-foreground">{getRecurrenceText(itemById.get(event.item_id), event, nextDueByItemId, t)}</p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">{formatEventAmount(event, itemById.get(event.item_id)) ?? t('events.amountPending')}</div>
                          <EditEventRowAction
                            eventId={event.id}
                            itemId={event.item_id}
                            eventStatus={event.status}
                            dueDate={event.due_date}
                            amount={event.amount}
                            isProjected={projected}
                          />
                          <CompleteEventRowAction eventId={event.id} itemId={event.item_id} eventStatus={event.status} />
                        </div>
                      </li>
                    )
                  }}
                />
              </section>
            )}
          />
        )}
      </section> : null}
    </section>
  )
}
