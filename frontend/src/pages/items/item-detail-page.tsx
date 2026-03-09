import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { MotionPanelList } from '@/components/ui/motion-panel-list'
import { Pressable } from '@/components/ui/pressable'
import { useAdminScope } from '../../features/admin-scope/admin-scope-context'
import { ItemActivityTimeline } from '../../features/audit/item-activity-timeline'
import { CompleteEventRowAction } from '../../features/events/complete-event-row-action'
import { EditEventRowAction } from '../../features/events/edit-event-row-action'
import { ItemSoftDeleteDialog } from '../../features/items/item-soft-delete-dialog'
import { useToast } from '../../features/ui/toast-provider'
import { ApiClientError, apiRequest } from '../../lib/api-client'
import { compareByNearestDue } from '../../lib/date-ordering'
import { getFinancialSubtype, getItemDisplayName, getItemTypeLabel, isHiddenAttributeKey, isIncomeItem } from '../../lib/item-display'
import { motionSpring, panelItemVariants, pressScale } from '../../lib/motion'
import { eventListParams, lensScopeToParams, queryKeys } from '../../lib/query-keys'

type ItemRow = {
  id: string
  user_id?: string
  item_type: string
  title?: string | null
  type?: string | null
  frequency?: string | null
  status?: string | null
  default_amount?: number | null
  linked_asset_item_id?: string | null
  attributes: Record<string, unknown>
  parent_item_id?: string | null
  updated_at: string
}

type ItemsResponse = {
  items: ItemRow[]
}

type NetStatusResponse = ItemRow & {
  child_commitments: ItemRow[]
  summary: {
    monthly_obligation_total: number
    monthly_income_total: number
    net_monthly_cashflow: number
    excluded_row_count: number
    active_period?: {
      cadence?: string
      start_date?: string
      end_date?: string
      reference_date?: string
      boundary?: string
      label?: string
    }
    one_time_rule?: {
      frequency?: string
      inclusion?: string
      boundary?: string
      excludes?: string[]
      description?: string
    }
    cadence_totals?: {
      recurring?: {
        obligations?: {
          weekly?: number
          monthly?: number
          yearly?: number
        }
        income?: {
          weekly?: number
          monthly?: number
          yearly?: number
        }
        net_cashflow?: {
          weekly?: number
          monthly?: number
          yearly?: number
        }
        net?: {
          weekly?: number
          monthly?: number
          yearly?: number
        }
      }
      one_time_period?: {
        net_monthly_cashflow?: number
      }
    }
  }
}

type SummaryCadence = 'weekly' | 'monthly' | 'yearly'

type ResolvedCadenceTotals = {
  obligations: number
  income: number
  net: number
}

type RecurringCadenceProjection = {
  obligations: number
  income: number
  netCashflow: number
}

function roundToCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

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

type DetailTab = 'overview' | 'commitments' | 'activity'
type FinancialEventsTab = 'present' | 'history'
type ItemDetailLocationState = {
  from?: string
  highlightItemId?: string
  highlightSource?: 'created' | 'restored'
}

const HIGHLIGHT_DURATION_MS = 1600
const SUMMARY_CADENCE_OPTIONS: SummaryCadence[] = ['weekly', 'monthly', 'yearly']

const DETAIL_KEY_ORDER = [
  'name',
  'description',
  'address',
  'city',
  'province',
  'postalCode',
  'vin',
  'make',
  'model',
  'year',
  'monthlyRent',
  'estimatedValue',
  'lender',
  'interestRate',
  'originalPrincipal',
  'remainingBalance',
  'trackingStartingRemainingBalance',
  'trackingCompletedTotal',
  'trackingCompletedCount',
  'trackingLastCompletedDate',
  'nextPaymentAmount',
  'collectedTotal',
  'trackingStartingCollectedTotal',
  'lastCollectedAmount',
  'lastCollectedDate',
  'amount',
  'dueDate',
  'billingCycle',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toFriendlyValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  if (typeof value === 'number') {
    if (key.toLowerCase().includes('rate')) {
      return `${value}%`
    }

    if (isMoneyField(key)) {
      return formatCurrency(value)
    }

    return String(value)
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  return String(value)
}

function isMoneyField(key: string) {
  return [
    'amount',
    'monthlyRent',
    'estimatedValue',
    'originalPrincipal',
    'remainingBalance',
    'nextPaymentAmount',
    'trackingStartingRemainingBalance',
    'trackingCompletedTotal',
    'collectedTotal',
    'trackingStartingCollectedTotal',
    'lastCollectedAmount',
    'lastPaymentAmount',
  ].includes(key)
}

function getDisplayEntries(attributes: Record<string, unknown>) {
  const preferred = DETAIL_KEY_ORDER.filter((key) => key in attributes)
  const extras = Object.keys(attributes)
    .filter((key) => !DETAIL_KEY_ORDER.includes(key as (typeof DETAIL_KEY_ORDER)[number]))
    .filter((key) => !isHiddenAttributeKey(key))
    .sort()

  return [...preferred, ...extras]
    .filter((key) => !isHiddenAttributeKey(key))
    .map((key) => ({ key, value: attributes[key] }))
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatSignedFixedAmount(value: number) {
  const numericValue = Number.isFinite(value) ? value : 0
  const sign = numericValue > 0 ? '+' : numericValue < 0 ? '-' : ''
  return `${sign}${Math.abs(numericValue).toFixed(2)}`
}

function toNumberOrZero(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatDateLabel(value: string) {
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed)
}

function formatPeriodDate(value: string) {
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) {
    return null
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(parsed)
}

function resolveActivePeriodLabel(summary: NetStatusResponse['summary'] | null | undefined, t: (key: string, options?: Record<string, unknown>) => string) {
  const activePeriod = summary?.active_period

  if (activePeriod?.label && activePeriod.label.trim().length > 0) {
    return activePeriod.label
  }

  const start = typeof activePeriod?.start_date === 'string' ? formatPeriodDate(activePeriod.start_date) : null
  const end = typeof activePeriod?.end_date === 'string' ? formatPeriodDate(activePeriod.end_date) : null

  if (start && end) {
    return `${start} - ${end}`
  }

  return t('items.detail.summaryPeriodFallback')
}

function formatEventAmount(event: EventRow, item: ItemRow | undefined) {
  if (event.amount === null || Number.isNaN(event.amount)) {
    return null
  }

  const formatted = formatCurrency(event.amount)
  return item && isIncomeItem(item) ? `+${formatted}` : formatted
}

function getSignedLedgerAmount(event: EventRow, item: ItemRow | undefined) {
  if (event.amount === null || Number.isNaN(event.amount)) {
    return 0
  }

  return item && isIncomeItem(item) ? event.amount : -Math.abs(event.amount)
}

function summarizeLedgerSection(events: EventRow[], commitmentById: Map<string, ItemRow>) {
  return events.reduce(
    (summary, event) => {
      summary.count += 1
      summary.total += getSignedLedgerAmount(event, commitmentById.get(event.item_id))
      return summary
    },
    { count: 0, total: 0 },
  )
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

function isOverduePendingEvent(event: EventRow, todayStart: number) {
  return isCompletedEvent(event) === false && Date.parse(event.due_date) < todayStart
}

function recurrenceFrequencyLabel(frequency: string | null | undefined, t: (key: string) => string) {
  switch (frequency) {
    case 'weekly':
      return t('items.detail.recurrence.weekly')
    case 'biweekly':
      return t('items.detail.recurrence.biweekly')
    case 'monthly':
      return t('items.detail.recurrence.monthly')
    case 'quarterly':
      return t('items.detail.recurrence.quarterly')
    case 'yearly':
      return t('items.detail.recurrence.yearly')
    case 'one_time':
      return t('items.detail.recurrence.oneTime')
    default:
      return t('items.detail.recurrence.custom')
  }
}

function resolveFinancialFrequency(item: ItemRow | null, attributes: Record<string, unknown>) {
  if (item?.frequency && item.frequency.length > 0) {
    return item.frequency
  }

  const attributeFrequency = attributes.billingCycle ?? attributes.frequency
  return typeof attributeFrequency === 'string' && attributeFrequency.length > 0 ? attributeFrequency : null
}

function resolveFinancialStatus(item: ItemRow | null, attributes: Record<string, unknown>) {
  if (item?.status && item.status.length > 0) {
    return item.status
  }

  const attributeStatus = attributes.status
  return typeof attributeStatus === 'string' && attributeStatus.length > 0 ? attributeStatus : null
}

function resolveParentLinkId(item: ItemRow | null) {
  if (!item) {
    return null
  }

  if (item.parent_item_id) {
    return item.parent_item_id
  }

  if (item.linked_asset_item_id) {
    return item.linked_asset_item_id
  }

  const attributes = isRecord(item.attributes) ? item.attributes : {}
  const attrParentId = attributes.parentItemId
  if (typeof attrParentId === 'string' && attrParentId.length > 0) {
    return attrParentId
  }

  const attrLinkedId = attributes.linkedAssetItemId
  return typeof attrLinkedId === 'string' && attrLinkedId.length > 0 ? attrLinkedId : null
}

function getDeletedAtFromAttributes(attributes: Record<string, unknown> | undefined) {
  if (!attributes || typeof attributes._deleted_at !== 'string') {
    return null
  }

  const parsed = Date.parse(attributes._deleted_at)
  return Number.isNaN(parsed) ? null : attributes._deleted_at
}

function isSoftDeletedItem(item: ItemRow) {
  return Boolean(getDeletedAtFromAttributes(isRecord(item.attributes) ? item.attributes : undefined))
}

function deriveSummaryFromCommitments(commitments: ItemRow[]) {
  return commitments.reduce(
    (summary, commitment) => {
      const attrs = isRecord(commitment.attributes) ? commitment.attributes : {}
      const amount = Number((attrs.amount ?? attrs.nextPaymentAmount ?? commitment.default_amount) ?? 0)
      const normalizedAmount = Number.isFinite(amount) ? amount : 0

      if (getFinancialSubtype(commitment) === 'Income') {
        summary.monthly_income_total += normalizedAmount
      } else {
        summary.monthly_obligation_total += normalizedAmount
      }

      summary.net_monthly_cashflow = summary.monthly_income_total - summary.monthly_obligation_total
      return summary
    },
    {
      monthly_obligation_total: 0,
      monthly_income_total: 0,
      net_monthly_cashflow: 0,
      excluded_row_count: 0,
      cadence_totals: {
        one_time_period: {
          net_monthly_cashflow: 0,
        },
      },
    },
  )
}

function resolveCadenceSummaryTotals(summary: NetStatusResponse['summary'], cadence: SummaryCadence): ResolvedCadenceTotals {
  const recurringTotals = summary.cadence_totals?.recurring
  const recurringCadenceProjection: RecurringCadenceProjection = {
    obligations: Number(recurringTotals?.obligations?.[cadence]),
    income: Number(recurringTotals?.income?.[cadence]),
    netCashflow: Number(recurringTotals?.net_cashflow?.[cadence] ?? recurringTotals?.net?.[cadence]),
  }

  if (
    Number.isFinite(recurringCadenceProjection.obligations)
    && Number.isFinite(recurringCadenceProjection.income)
  ) {
    const derivedRecurringNet = roundToCents(recurringCadenceProjection.income - recurringCadenceProjection.obligations)
    const normalizedRecurringNet = Number.isFinite(recurringCadenceProjection.netCashflow)
      ? roundToCents(recurringCadenceProjection.netCashflow)
      : derivedRecurringNet

    return {
      obligations: recurringCadenceProjection.obligations,
      income: recurringCadenceProjection.income,
      net: normalizedRecurringNet === derivedRecurringNet ? normalizedRecurringNet : derivedRecurringNet,
    }
  }

  return {
    obligations: summary.monthly_obligation_total,
    income: summary.monthly_income_total,
    net: summary.net_monthly_cashflow,
  }
}

function hasFiniteCadenceTotals(totals: ResolvedCadenceTotals) {
  return Number.isFinite(totals.obligations) && Number.isFinite(totals.income) && Number.isFinite(totals.net)
}

function isNetStatusItem(item: NetStatusResponse | ItemRow | null): item is NetStatusResponse {
  return item !== null && 'child_commitments' in item && 'summary' in item
}

export function ItemDetailPage() {
  const { t } = useTranslation()
  const { push } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { mode, lensUserId } = useAdminScope()
  const params = useParams<{ itemId: string }>()
  const itemId = params.itemId || ''

  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const [activeFinancialEventsTab, setActiveFinancialEventsTab] = useState<FinancialEventsTab>('present')
  const [selectedCadence, setSelectedCadence] = useState<SummaryCadence>('monthly')
  const [displayCadence, setDisplayCadence] = useState<SummaryCadence>('monthly')
  const [isCadenceTransitionPending, setIsCadenceTransitionPending] = useState(false)
  const [cadenceTransitionError, setCadenceTransitionError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [showTechnical, setShowTechnical] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [selectedParentCascadeIds, setSelectedParentCascadeIds] = useState<string[]>([])
  const [childDeleteTarget, setChildDeleteTarget] = useState<ItemRow | null>(null)
  const [childDeleteError, setChildDeleteError] = useState<string | null>(null)
  const cadenceTransitionVersionRef = useRef(0)
  const cadenceTransitionTimerRef = useRef<number | null>(null)
  const locationState = (typeof location.state === 'object' && location.state !== null ? location.state : null) as ItemDetailLocationState | null
  const returnTo = String(locationState?.from ?? '')
  const [highlightHeader, setHighlightHeader] = useState(locationState?.highlightItemId === itemId)
  const lensScope = useMemo(
    () => ({ mode, lensUserId: mode === 'owner' ? lensUserId : null }),
    [lensUserId, mode],
  )
  const ledgerListParams = useMemo(() => eventListParams(lensScope, 'all'), [lensScope])
  const detailLookupParams = useMemo(
    () => ({
      filter: 'all',
      sort: 'recently_updated',
      ...lensScopeToParams(lensScope),
    }),
    [lensScope],
  )

  const netStatusQuery = useQuery({
    queryKey: queryKeys.items.detail(itemId, lensScope),
    enabled: Boolean(itemId),
    queryFn: async () => apiRequest<NetStatusResponse>(`/items/${itemId}/net-status`),
  })

  const itemsLookupQuery = useQuery({
    queryKey: queryKeys.items.list({ scope: 'detail-lookup', itemId, ...detailLookupParams }),
    enabled: Boolean(itemId),
    queryFn: async () => {
      const params = new URLSearchParams(detailLookupParams)
      return apiRequest<ItemsResponse>(`/items?${params.toString()}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async ({ cascadeDeleteIds }: { cascadeDeleteIds: string[] }) => {
      return apiRequest(`/items/${itemId}`, {
        method: 'DELETE',
        body: { cascade_delete_ids: cascadeDeleteIds },
      })
    },
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.items.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(itemId, lensScope) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.activity(itemId) }),
        ...variables.cascadeDeleteIds.map((childId) => queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(childId, lensScope) })),
        ...variables.cascadeDeleteIds.map((childId) => queryClient.invalidateQueries({ queryKey: queryKeys.items.activity(childId) })),
        queryClient.invalidateQueries({ queryKey: queryKeys.events.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ])
      if (returnTo && returnTo !== location.pathname + location.search) {
        navigate(returnTo, { replace: true })
        return
      }

      if (window.history.length > 1) {
        navigate(-1)
        return
      }

      navigate('/items', { replace: true })
    },
    onError: (error) => {
      if (error instanceof ApiClientError) {
        const suffix = error.category || error.code
        setDeleteError(`${error.message}${suffix ? ` (${suffix})` : ''}`)
        return
      }

      setDeleteError(t('items.deleteDialog.failed'))
    },
  })

  const childDeleteMutation = useMutation({
    mutationFn: async (target: ItemRow) =>
      apiRequest(`/items/${target.id}`, {
        method: 'DELETE',
      }),
    onSuccess: async (_, target) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.items.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(itemId, lensScope) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(target.id, lensScope) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.activity(itemId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.activity(target.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.events.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ])
      setChildDeleteTarget(null)
      setChildDeleteError(null)
    },
    onError: (error) => {
      if (error instanceof ApiClientError) {
        const suffix = error.category || error.code
        setChildDeleteError(`${error.message}${suffix ? ` (${suffix})` : ''}`)
        return
      }

      setChildDeleteError(t('items.deleteDialog.failed'))
    },
  })

  const wrongRootType = netStatusQuery.error instanceof ApiClientError && netStatusQuery.error.category === 'wrong_root_type'
  const lookupRows = itemsLookupQuery.data?.items ?? []
  const lookupItem = lookupRows.find((item) => item.id === itemId) ?? null
  const detail = netStatusQuery.data ?? lookupItem
  const tabs: DetailTab[] = ['overview', 'commitments', 'activity']
  const subtype = detail ? getFinancialSubtype(detail) : null
  const isFinancialDetail = detail?.item_type === 'FinancialItem'

  const commitments = useMemo<ItemRow[]>(() => {
    if (!isNetStatusItem(detail)) {
      return []
    }

    return detail.child_commitments
      .filter((commitment) => !isSoftDeletedItem(commitment))
      .filter((commitment) => (detail.user_id ? commitment.user_id === detail.user_id : true))
  }, [detail])

  const financialTimelineEventsQuery = useQuery({
    queryKey: queryKeys.items.itemLedger(itemId, ledgerListParams),
    enabled: Boolean(itemId) && activeTab === 'commitments' && isFinancialDetail,
    queryFn: async () => {
      const params = new URLSearchParams(ledgerListParams)
      return apiRequest<EventsResponse>(`/events?${params.toString()}`)
    },
  })

  const financialTimelineSections = useMemo(() => {
    const allEvents = (financialTimelineEventsQuery.data?.groups ?? []).flatMap((group) => group.events)
    const relevantEvents = allEvents
      .filter((event) => event.item_id === itemId)
      .sort(compareByNearestDue)

    return relevantEvents.reduce(
      (acc, event) => {
        if (isCompletedEvent(event)) {
          acc.history.push(event)
        } else {
          acc.present.push(event)
        }

        return acc
      },
      { present: [] as EventRow[], history: [] as EventRow[] },
    )
  }, [financialTimelineEventsQuery.data?.groups, itemId])

  const financialTimelineCounts = useMemo(
    () => ({
      present: financialTimelineSections.present.length,
      history: financialTimelineSections.history.length,
    }),
    [financialTimelineSections.history.length, financialTimelineSections.present.length],
  )

  const detailAsItem = detail ? (detail as ItemRow) : undefined
  const financialTimelineSummary = useMemo(
    () => ({
      present: summarizeLedgerSection(financialTimelineSections.present, new Map(detailAsItem ? [[detailAsItem.id, detailAsItem]] : [])),
      history: summarizeLedgerSection(financialTimelineSections.history, new Map(detailAsItem ? [[detailAsItem.id, detailAsItem]] : [])),
    }),
    [detailAsItem, financialTimelineSections.history, financialTimelineSections.present],
  )

  useEffect(() => {
    if (!deleteOpen || !detail || (detail.item_type !== 'RealEstate' && detail.item_type !== 'Vehicle')) {
      setSelectedParentCascadeIds([])
      return
    }

    setSelectedParentCascadeIds(commitments.map((commitment) => commitment.id))
  }, [commitments, deleteOpen, detail])

  const parentDeleteRelatedItems = useMemo(() => {
    if (!detail || (detail.item_type !== 'RealEstate' && detail.item_type !== 'Vehicle')) {
      return []
    }

    return commitments.map((commitment) => ({
      id: commitment.id,
      label: getItemDisplayName(commitment),
      checked: selectedParentCascadeIds.includes(commitment.id),
    }))
  }, [commitments, detail, selectedParentCascadeIds])
  const effectiveSummary = useMemo(() => {
    if (!isNetStatusItem(detail)) {
      return {
        monthly_obligation_total: 0,
        monthly_income_total: 0,
        net_monthly_cashflow: 0,
        excluded_row_count: 0,
        cadence_totals: {
          one_time_period: {
            net_monthly_cashflow: 0,
          },
        },
      }
    }

    if (detail.summary) {
      return detail.summary
    }

    return deriveSummaryFromCommitments(commitments)
  }, [commitments, detail])
  const rootAttributes = isRecord(detail?.attributes) ? detail.attributes : {}
  const resolvedFinancialFrequency = resolveFinancialFrequency(detail, rootAttributes)
  const resolvedFinancialStatus = resolveFinancialStatus(detail, rootAttributes)
  const parentLinkId = resolveParentLinkId(detail)
  const recurrenceSummary = useMemo(() => {
    if (!detail || detail.item_type !== 'FinancialItem') {
      return null
    }

    if (resolvedFinancialStatus === 'Closed') {
      return t('items.detail.recurrence.closed')
    }

    const frequencyLabel = recurrenceFrequencyLabel(resolvedFinancialFrequency, t)
    const nextDueRaw = [rootAttributes.nextDueDate, rootAttributes.dueDate].find((value) => typeof value === 'string' && value.length > 0)

    if (typeof nextDueRaw === 'string') {
      return t('items.detail.recurrence.summary', {
        frequency: frequencyLabel,
        date: formatDateLabel(nextDueRaw),
      })
    }

    return t('items.detail.recurrence.summaryNoDate', { frequency: frequencyLabel })
  }, [detail, resolvedFinancialFrequency, resolvedFinancialStatus, rootAttributes.dueDate, rootAttributes.nextDueDate, t])
  const summaryPeriodLabel = useMemo(
    () => resolveActivePeriodLabel(isNetStatusItem(detail) ? detail.summary : null, t),
    [detail, t],
  )
  const oneTimeRuleHint = useMemo(() => {
    if (isNetStatusItem(detail) && typeof detail.summary.one_time_rule?.description === 'string' && detail.summary.one_time_rule.description.length > 0) {
      return detail.summary.one_time_rule.description
    }

    return t('items.detail.summaryRuleHint')
  }, [detail, t])
  const displayedCadenceTotals = useMemo(
    () => resolveCadenceSummaryTotals(effectiveSummary, displayCadence),
    [displayCadence, effectiveSummary],
  )
  const displayedCadenceLabel = t(`items.detail.cadence.options.${displayCadence}`)
  const oneTimeImpact = Number(effectiveSummary.cadence_totals?.one_time_period?.net_monthly_cashflow ?? 0)
  const oneTimeImpactLabel = t('items.detail.summaryOneTimeImpact', { defaultValue: 'One-time impact (separate from recurring net)' })
  const oneTimeImpactValue = formatSignedFixedAmount(oneTimeImpact)

  function handleCadenceChange(nextCadence: SummaryCadence) {
    if (selectedCadence === nextCadence && displayCadence === nextCadence && !isCadenceTransitionPending) {
      return
    }

    setSelectedCadence(nextCadence)
    setCadenceTransitionError(null)
    setIsCadenceTransitionPending(true)

    const transitionVersion = cadenceTransitionVersionRef.current + 1
    cadenceTransitionVersionRef.current = transitionVersion

    if (cadenceTransitionTimerRef.current !== null) {
      window.clearTimeout(cadenceTransitionTimerRef.current)
    }

    cadenceTransitionTimerRef.current = window.setTimeout(() => {
      if (cadenceTransitionVersionRef.current !== transitionVersion) {
        return
      }

      try {
        const nextTotals = resolveCadenceSummaryTotals(effectiveSummary, nextCadence)
        if (!hasFiniteCadenceTotals(nextTotals)) {
          throw new Error('Invalid cadence totals')
        }

        setDisplayCadence(nextCadence)
      } catch {
        const feedback = t('items.detail.loadError')
        setCadenceTransitionError(feedback)
        push({ message: feedback, dedupeKey: 'item-detail-cadence-transition-failed' })
      } finally {
        if (cadenceTransitionVersionRef.current === transitionVersion) {
          cadenceTransitionTimerRef.current = null
          setIsCadenceTransitionPending(false)
        }
      }
    }, 120)
  }

  const parentItem = useMemo(() => {
    const parentId = parentLinkId
    if (!parentId) {
      return null
    }

    return lookupRows.find((item) => item.id === parentId) ?? null
  }, [lookupRows, parentLinkId])

  const siblingItems = useMemo(() => {
    const parentId = parentLinkId
    if (!parentId) {
      return []
    }

    return lookupRows.filter((item) => resolveParentLinkId(item) === parentId && item.id !== detail?.id)
  }, [detail?.id, lookupRows, parentLinkId])

  useEffect(() => {
    if (cadenceTransitionTimerRef.current !== null) {
      window.clearTimeout(cadenceTransitionTimerRef.current)
      cadenceTransitionTimerRef.current = null
    }

    setActiveTab('overview')
    setActiveFinancialEventsTab('present')
    setSelectedCadence('monthly')
    setDisplayCadence('monthly')
    setIsCadenceTransitionPending(false)
    setCadenceTransitionError(null)
    cadenceTransitionVersionRef.current += 1
  }, [itemId])

  useEffect(() => {
    setHighlightHeader(locationState?.highlightItemId === itemId)
  }, [itemId, locationState?.highlightItemId])

  useEffect(() => {
    if (!highlightHeader) {
      return
    }

    const timeoutId = window.setTimeout(() => setHighlightHeader(false), HIGHLIGHT_DURATION_MS)
    return () => window.clearTimeout(timeoutId)
  }, [highlightHeader])

  useEffect(() => {
    return () => {
      if (cadenceTransitionTimerRef.current !== null) {
        window.clearTimeout(cadenceTransitionTimerRef.current)
      }
    }
  }, [])

  if (netStatusQuery.isLoading || itemsLookupQuery.isLoading) {
    return (
      <motion.section layout className="rounded-2xl border border-border bg-card p-5 shadow-sm" aria-label="Loading item detail">
        <div className="space-y-3">
          <div className="h-6 w-52 animate-pulse rounded bg-muted" />
          <div className="h-14 animate-pulse rounded-xl bg-muted/80" />
          <div className="h-14 animate-pulse rounded-xl bg-muted/80" />
        </div>
      </motion.section>
    )
  }

  if ((netStatusQuery.isError && !wrongRootType) || !detail) {
    return (
      <motion.section layout className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
        {t('items.detail.loadError')}
      </motion.section>
    )
  }

  return (
    <motion.section layout className="space-y-4">
      <motion.header
        layout
        initial="initial"
        animate={highlightHeader ? 'highlight' : 'animate'}
        variants={panelItemVariants}
        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm"
        data-highlighted={highlightHeader ? 'true' : 'false'}
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{detail ? getItemDisplayName(detail) : ''}</h1>
            {subtype ? <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium text-foreground">{subtype}</span> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{detail ? getItemTypeLabel(detail) : t('items.detail.commitmentFallbackTitle')}</p>
          {recurrenceSummary ? <p className="mt-1 text-xs text-muted-foreground">{recurrenceSummary}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Pressable className="rounded-lg">
            <motion.button
              type="button"
              onClick={() => setShowTechnical((value) => !value)}
              transition={motionSpring}
              whileTap={{ scale: pressScale }}
              className="rounded-lg border border-border px-3 py-2 text-xs font-medium"
            >
              {showTechnical ? t('items.detail.hideTechnical') : t('items.detail.showTechnical')}
            </motion.button>
          </Pressable>
          <Pressable className="rounded-lg">
            <motion.div whileTap={{ scale: pressScale }} transition={motionSpring}>
              <Link to={`/items/${itemId}/edit`} className="block rounded-lg border border-border px-3 py-2 text-xs font-medium">
                {t('items.editAction')}
              </Link>
            </motion.div>
          </Pressable>
          <Pressable className="rounded-lg">
            <motion.button
              type="button"
              onClick={() => {
                setDeleteError(null)
                setDeleteOpen(true)
              }}
              transition={motionSpring}
              whileTap={{ scale: pressScale }}
              className="rounded-lg border border-destructive/40 px-3 py-2 text-xs font-medium text-destructive"
            >
              {t('items.deleteAction')}
            </motion.button>
          </Pressable>
        </div>
      </motion.header>

      <motion.nav layout className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Pressable key={tab} className="rounded-full">
            <motion.button
              layout
              type="button"
              onClick={() => setActiveTab(tab)}
              transition={motionSpring}
              whileTap={{ scale: pressScale }}
              className={[
                'rounded-full border px-3 py-1 text-xs font-medium',
                activeTab === tab ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground',
              ].join(' ')}
            >
              {t(`items.detail.tabs.${tab}`)}
            </motion.button>
          </Pressable>
        ))}
      </motion.nav>

      {activeTab === 'overview' ? (
        wrongRootType ? (
          <motion.div layout className="space-y-3">
            <motion.section layout className="grid gap-3 md:grid-cols-3">
              <motion.article layout className="hover-lift rounded-2xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {isFinancialDetail ? t('items.fields.amount') : t('items.fields.nextPaymentAmount')}
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {formatCurrency(
                    toNumberOrZero(
                      isFinancialDetail
                        ? detail?.default_amount ?? rootAttributes.amount ?? rootAttributes.nextPaymentAmount
                        : rootAttributes.nextPaymentAmount ?? rootAttributes.amount,
                    ),
                  )}
                </p>
              </motion.article>
              <motion.article layout className="hover-lift rounded-2xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {isFinancialDetail ? t('items.fields.billingCycle') : t('items.fields.remainingBalance')}
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {isFinancialDetail
                    ? recurrenceFrequencyLabel(resolvedFinancialFrequency, t)
                    : formatCurrency(toNumberOrZero(rootAttributes.remainingBalance))}
                </p>
              </motion.article>
              <motion.article layout className="hover-lift rounded-2xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('items.fields.dueDate')}</p>
                <p className="mt-2 text-2xl font-semibold">{String(rootAttributes.dueDate ?? rootAttributes.nextDueDate ?? '-')}</p>
              </motion.article>
            </motion.section>

            <motion.section layout className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <h2 className="text-sm font-semibold">{t('items.detail.keyDetails')}</h2>
              <motion.dl layout className="mt-3 grid gap-2 sm:grid-cols-2">
                {getDisplayEntries(rootAttributes).map((entry) => (
                  <motion.div layout key={entry.key} className="rounded-lg border border-border bg-background/80 px-3 py-2">
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{t(`items.fields.${entry.key}`, { defaultValue: entry.key })}</dt>
                    <dd className="mt-1 text-sm font-medium text-foreground">{toFriendlyValue(entry.key, entry.value)}</dd>
                  </motion.div>
                ))}
              </motion.dl>
            </motion.section>

            <motion.section layout className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <h2 className="text-sm font-semibold">{t('items.detail.linkedItemsTitle')}</h2>

              {parentItem ? (
                <div className="mt-3">
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{t('items.detail.linkedParentLabel')}</p>
                  <Pressable className="w-full rounded-xl">
                    <motion.div whileTap={{ scale: pressScale }} transition={motionSpring}>
                      <Link
                        to={`/items/${parentItem.id}`}
                        state={{ from: location.pathname + location.search }}
                        className="block rounded-xl border border-border bg-background/80 px-3 py-3 text-sm font-medium text-foreground shadow-sm"
                      >
                        <span className="text-primary underline-offset-2 hover:underline">{getItemDisplayName(parentItem)}</span>
                      </Link>
                    </motion.div>
                  </Pressable>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">{t('items.detail.noLinkedParent')}</p>
              )}

              {siblingItems.length > 0 ? (
                <div className="mt-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('items.detail.relatedCommitments')}</p>
                  <MotionPanelList
                    items={siblingItems}
                    getItemKey={(sibling) => sibling.id}
                    className="mt-2 space-y-2"
                    renderItem={(sibling) => (
                      <Pressable className="w-full rounded-xl">
                        <motion.div whileTap={{ scale: pressScale }} transition={motionSpring}>
                          <Link
                            to={`/items/${sibling.id}`}
                            state={{ from: location.pathname + location.search }}
                            className="block rounded-xl border border-border bg-background/80 px-3 py-3 text-sm font-medium text-primary underline-offset-2 hover:underline"
                          >
                            {getItemDisplayName(sibling)}
                          </Link>
                        </motion.div>
                      </Pressable>
                    )}
                  />
                </div>
              ) : null}

              {showTechnical ? (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.detail.technicalTitle')}</p>
                  <pre className="overflow-x-auto rounded-lg border border-border bg-background p-3 text-xs text-foreground">{JSON.stringify(rootAttributes, null, 2)}</pre>
                </div>
              ) : null}
            </motion.section>
          </motion.div>
        ) : (
          <motion.div layout className="space-y-3">
            <motion.section layout className="rounded-2xl border border-border bg-card p-2 shadow-sm">
              <div
                className="inline-flex w-full rounded-lg border border-border bg-background p-1"
                role="group"
                aria-label={t('items.detail.cadence.ariaLabel')}
              >
                {SUMMARY_CADENCE_OPTIONS.map((cadenceOption) => {
                  const isSelected = selectedCadence === cadenceOption

                  return (
                    <button
                      key={cadenceOption}
                      type="button"
                      onClick={() => handleCadenceChange(cadenceOption)}
                      disabled={isCadenceTransitionPending && selectedCadence === cadenceOption}
                      className={[
                        'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                        isSelected ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                      ].join(' ')}
                      aria-pressed={isSelected}
                      aria-label={t('items.detail.cadence.optionSelected', {
                        cadence: t(`items.detail.cadence.options.${cadenceOption}`),
                      })}
                    >
                      {t(`items.detail.cadence.options.${cadenceOption}`)}
                    </button>
                  )
                })}
              </div>
            </motion.section>

            <motion.section
              layout
              aria-live="polite"
              aria-busy={isCadenceTransitionPending}
              className={[
                'space-y-2',
                isCadenceTransitionPending ? 'rounded-2xl border border-border/70 bg-muted/20 p-2' : '',
              ].join(' ')}
            >
              {isCadenceTransitionPending ? (
                <p className="px-2 text-xs text-muted-foreground">{t('common.loading', { defaultValue: 'Updating summary values...' })}</p>
              ) : null}
              {cadenceTransitionError ? <p className="px-2 text-xs font-medium text-destructive">{cadenceTransitionError}</p> : null}
              <div className="grid gap-3 md:grid-cols-4">
              <motion.article layout className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('items.detail.summaryObligationsCadence', { cadence: displayedCadenceLabel, period: summaryPeriodLabel })}
                </p>
                <p className="mt-2 text-2xl font-semibold">{formatCurrency(displayedCadenceTotals.obligations)}</p>
              </motion.article>
              <motion.article layout className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('items.detail.summaryIncomeCadence', { cadence: displayedCadenceLabel, period: summaryPeriodLabel })}
                </p>
                <p className="mt-2 text-2xl font-semibold text-emerald-700">{formatCurrency(displayedCadenceTotals.income)}</p>
              </motion.article>
              <motion.article layout className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('items.detail.summaryNetCadence', { cadence: displayedCadenceLabel, period: summaryPeriodLabel })}
                </p>
                <p className="mt-2 text-2xl font-semibold">{formatCurrency(displayedCadenceTotals.net)}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">{t('items.detail.summaryNetFormulaHintCadence', { cadence: displayedCadenceLabel })}</p>
                <p
                  className={[
                    'mt-2 text-[11px] font-medium',
                    oneTimeImpact > 0 ? 'text-emerald-700' : oneTimeImpact < 0 ? 'text-destructive' : 'text-muted-foreground',
                  ].join(' ')}
                >
                  {`${oneTimeImpactLabel}: ${oneTimeImpactValue}`}
                </p>
              </motion.article>
              <motion.article layout className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('items.detail.summaryLinked')}</p>
                <p className="mt-2 text-2xl font-semibold">{commitments.length}</p>
              </motion.article>
              </div>
            </motion.section>

            <motion.section layout className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">{t('items.detail.summaryPeriodHint', { period: summaryPeriodLabel })}</p>
              <p className="mt-1 text-xs text-muted-foreground">{oneTimeRuleHint}</p>
            </motion.section>

            <motion.section layout className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <h2 className="text-sm font-semibold">{t('items.detail.keyDetails')}</h2>
              <motion.dl layout className="mt-3 grid gap-2 sm:grid-cols-2">
                {getDisplayEntries(rootAttributes).map((entry) => (
                  <motion.div layout key={entry.key} className="rounded-lg border border-border bg-background/80 px-3 py-2">
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{t(`items.fields.${entry.key}`, { defaultValue: entry.key })}</dt>
                    <dd className="mt-1 text-sm font-medium text-foreground">{toFriendlyValue(entry.key, entry.value)}</dd>
                  </motion.div>
                ))}
              </motion.dl>

              {showTechnical ? (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.detail.technicalTitle')}</p>
                  <pre className="overflow-x-auto rounded-lg border border-border bg-background p-3 text-xs text-foreground">{JSON.stringify(rootAttributes, null, 2)}</pre>
                </div>
              ) : null}
            </motion.section>
          </motion.div>
        )
      ) : null}

      {activeTab === 'commitments' ? (
        <motion.section layout className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          {!wrongRootType ? (
            <div className="mb-3 flex flex-wrap justify-end gap-2">
              <Pressable className="rounded-lg">
                <motion.div whileTap={{ scale: pressScale }} transition={motionSpring}>
                  <Link
                    to={`/items/create?item_type=Commitment&parent_item_id=${itemId}`}
                    className="block rounded-lg border border-border px-3 py-2 text-xs font-medium"
                  >
                    {t('items.detail.addLinkedCommitment')}
                  </Link>
                </motion.div>
              </Pressable>
              <Pressable className="rounded-lg">
                <motion.div whileTap={{ scale: pressScale }} transition={motionSpring}>
                  <Link
                    to={`/items/create?item_type=Income&parent_item_id=${itemId}`}
                    className="block rounded-lg border border-border px-3 py-2 text-xs font-medium"
                  >
                    {t('items.detail.addLinkedIncome')}
                  </Link>
                </motion.div>
              </Pressable>
            </div>
          ) : null}

          {!isFinancialDetail && commitments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('items.detail.noCommitments')}</p>
          ) : (
            <motion.div layout className="space-y-4">
              {!isFinancialDetail ? (
                <MotionPanelList
                  items={commitments}
                  getItemKey={(commitment) => commitment.id}
                  className="space-y-2"
                  renderItem={(commitment) => {
                    const attributes = isRecord(commitment.attributes) ? commitment.attributes : {}
                    const frequency = resolveFinancialFrequency(commitment, attributes)
                    const status = resolveFinancialStatus(commitment, attributes)
                    const amount = toNumberOrZero(commitment.default_amount ?? attributes.amount)
                    const dueDate = String(attributes.dueDate ?? attributes.nextDueDate ?? '-')
                    const subtypeLabel = getFinancialSubtype(commitment)

                    return (
                      <div className="rounded-xl border border-border bg-background/80 px-3 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Pressable className="rounded-lg">
                            <motion.div whileTap={{ scale: pressScale }} transition={motionSpring}>
                              <Link to={`/items/${commitment.id}`} state={{ from: location.pathname + location.search }} className="text-sm font-semibold text-primary underline-offset-2 hover:underline">
                                {getItemDisplayName(commitment)}
                              </Link>
                            </motion.div>
                          </Pressable>
                          <div className="flex items-center gap-2">
                            {subtypeLabel ? <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium">{subtypeLabel}</span> : null}
                            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium">{recurrenceFrequencyLabel(frequency, t)}</span>
                            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium">{status || '-'}</span>
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {t('items.fields.amount')}: <span className="font-medium text-foreground">{formatCurrency(amount)}</span>
                          {' · '}
                          {t('items.fields.dueDate')}: <span className="font-medium text-foreground">{formatDateLabel(dueDate)}</span>
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Pressable className="rounded-lg">
                            <motion.div whileTap={{ scale: pressScale }} transition={motionSpring}>
                              <Link to={`/items/${commitment.id}/edit`} className="block rounded-lg border border-border px-3 py-1 text-xs font-medium">
                                {t('items.editAction')}
                              </Link>
                            </motion.div>
                          </Pressable>
                          <Pressable className="rounded-lg">
                            <motion.button
                              type="button"
                              onClick={() => {
                                setChildDeleteError(null)
                                setChildDeleteTarget(commitment)
                              }}
                              transition={motionSpring}
                              whileTap={{ scale: pressScale }}
                              className="rounded-lg border border-destructive/40 px-3 py-1 text-xs font-medium text-destructive"
                            >
                              {t('items.deleteAction')}
                            </motion.button>
                          </Pressable>
                        </div>
                      </div>
                    )
                  }}
                />
              ) : (
                <motion.div layout className="space-y-3">
                  <div className="inline-flex rounded-lg border border-border bg-background p-1 text-sm">
                    <button
                      type="button"
                      onClick={() => setActiveFinancialEventsTab('present')}
                      className={`rounded-md px-3 py-1 font-medium ${
                        activeFinancialEventsTab === 'present' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {t('items.detail.ledger.currentUpcomingTitle')} ({financialTimelineCounts.present})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFinancialEventsTab('history')}
                      className={`rounded-md px-3 py-1 font-medium ${
                        activeFinancialEventsTab === 'history' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {t('items.detail.ledger.historicalTitle')} ({financialTimelineCounts.history})
                    </button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {activeFinancialEventsTab === 'present'
                      ? t('items.detail.ledger.sectionSummary', {
                          count: financialTimelineSummary.present.count,
                          total: formatCurrency(financialTimelineSummary.present.total),
                        })
                      : t('items.detail.ledger.sectionSummary', {
                          count: financialTimelineSummary.history.count,
                          total: formatCurrency(financialTimelineSummary.history.total),
                        })}
                  </p>

                  {((activeFinancialEventsTab === 'present' ? financialTimelineSections.present : financialTimelineSections.history).length === 0) ? (
                    <p className="rounded-xl border border-dashed border-border bg-background/70 px-3 py-2 text-sm text-muted-foreground">
                      {activeFinancialEventsTab === 'present' ? t('items.detail.ledger.currentUpcomingEmpty') : t('items.detail.ledger.historicalEmpty')}
                    </p>
                  ) : (
                    <MotionPanelList
                      items={activeFinancialEventsTab === 'present' ? financialTimelineSections.present : financialTimelineSections.history}
                      getItemKey={(event) => event.id}
                      className="space-y-2"
                      renderItem={(event) => {
                        const projected = isProjectedEvent(event)
                        const overdue = isOverduePendingEvent(event, toStartOfTodayUtc())

                        return (
                          <div
                            className={`rounded-xl border px-3 py-2 ${
                              overdue
                                ? 'border-red-300 bg-red-50/60'
                                : projected
                                  ? 'border-sky-200 bg-sky-50/40'
                                  : 'border-border bg-background/80'
                            }`}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium">{event.type}</p>
                              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${projected ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-border bg-background text-foreground'}`}>
                                {projected ? t('events.stateLegend.projected') : t('events.stateLegend.persisted')}
                              </span>
                              <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium">{event.status}</span>
                              {overdue ? (
                                <span className="rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">{t('dashboard.overdue')}</span>
                              ) : null}
                              {event.is_exception ? (
                                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                                  {t('events.stateLegend.editedOccurrence')}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{formatDateLabel(event.due_date)}</p>
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-sm font-medium">{formatEventAmount(event, detailAsItem) ?? t('events.amountPending')}</span>
                              <div className="flex items-center gap-2">
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
                            </div>
                          </div>
                        )
                      }}
                    />
                  )}
                </motion.div>
              )}
            </motion.div>
          )}
        </motion.section>
      ) : null}

      {activeTab === 'activity' ? <ItemActivityTimeline itemId={itemId} /> : null}

      <ItemSoftDeleteDialog
        open={deleteOpen}
        itemLabel={detail ? getItemDisplayName(detail) : ''}
        pending={deleteMutation.isPending}
        errorText={deleteError}
        relatedItems={parentDeleteRelatedItems}
        onToggleRelatedItem={(itemId, checked) => {
          setSelectedParentCascadeIds((previous) => {
            if (checked) {
              return previous.includes(itemId) ? previous : [...previous, itemId]
            }

            return previous.filter((id) => id !== itemId)
          })
        }}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate({ cascadeDeleteIds: selectedParentCascadeIds })}
      />

      <ItemSoftDeleteDialog
        open={Boolean(childDeleteTarget)}
        itemLabel={childDeleteTarget ? getItemDisplayName(childDeleteTarget) : ''}
        pending={childDeleteMutation.isPending}
        errorText={childDeleteError}
        onCancel={() => setChildDeleteTarget(null)}
        onConfirm={() => {
          if (!childDeleteTarget) {
            return
          }

          childDeleteMutation.mutate(childDeleteTarget)
        }}
      />
    </motion.section>
  )
}
