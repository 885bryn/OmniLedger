import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ItemActivityTimeline } from '../../features/audit/item-activity-timeline'
import { ItemSoftDeleteDialog } from '../../features/items/item-soft-delete-dialog'
import { ApiClientError, apiRequest } from '../../lib/api-client'
import { getItemDisplayName } from '../../lib/item-display'
import { queryKeys } from '../../lib/query-keys'

type ItemRow = {
  id: string
  user_id?: string
  item_type: string
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
  }
}

type DetailTab = 'overview' | 'commitments' | 'activity'

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
  'nextPaymentAmount',
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

    if (
      key === 'amount' ||
      key === 'monthlyRent' ||
      key === 'estimatedValue' ||
      key === 'originalPrincipal' ||
      key === 'remainingBalance' ||
      key === 'nextPaymentAmount'
    ) {
      return formatCurrency(value)
    }

    return String(value)
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  return String(value)
}

function getDisplayEntries(attributes: Record<string, unknown>) {
  const preferred = DETAIL_KEY_ORDER.filter((key) => key in attributes)
  const extras = Object.keys(attributes)
    .filter((key) => !DETAIL_KEY_ORDER.includes(key as (typeof DETAIL_KEY_ORDER)[number]))
    .filter((key) => !key.startsWith('_'))
    .sort()

  return [...preferred, ...extras].map((key) => ({ key, value: attributes[key] }))
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function toNumberOrZero(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
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
      const amount = Number((attrs.amount ?? attrs.nextPaymentAmount) ?? 0)
      const normalizedAmount = Number.isFinite(amount) ? amount : 0

      if (commitment.item_type === 'FinancialIncome') {
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
    },
  )
}

function isNetStatusItem(item: NetStatusResponse | ItemRow | null): item is NetStatusResponse {
  return item !== null && 'child_commitments' in item && 'summary' in item
}

export function ItemDetailPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const params = useParams<{ itemId: string }>()
  const itemId = params.itemId || ''

  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [showTechnical, setShowTechnical] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [childDeleteTarget, setChildDeleteTarget] = useState<ItemRow | null>(null)
  const [childDeleteError, setChildDeleteError] = useState<string | null>(null)
  const returnTo = typeof location.state === 'object' && location.state !== null && 'from' in location.state ? String((location.state as { from?: string }).from ?? '') : ''

  const netStatusQuery = useQuery({
    queryKey: queryKeys.items.detail(itemId),
    enabled: Boolean(itemId),
    queryFn: async () => apiRequest<NetStatusResponse>(`/items/${itemId}/net-status`),
  })

  const itemsLookupQuery = useQuery({
    queryKey: queryKeys.items.list({ scope: 'detail-lookup', itemId }),
    enabled: Boolean(itemId),
    queryFn: async () => apiRequest<ItemsResponse>('/items?filter=all&sort=recently_updated'),
  })

  const deleteMutation = useMutation({
    mutationFn: async () =>
      apiRequest(`/items/${itemId}`, {
        method: 'DELETE',
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.items.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(itemId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.activity(itemId) }),
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
        queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(itemId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(target.id) }),
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

  const commitments = useMemo<ItemRow[]>(() => {
    if (!isNetStatusItem(detail)) {
      return []
    }

    return detail.child_commitments
      .filter((commitment) => !isSoftDeletedItem(commitment))
      .filter((commitment) => (detail.user_id ? commitment.user_id === detail.user_id : true))
  }, [detail])
  const effectiveSummary = useMemo(() => {
    if (!isNetStatusItem(detail)) {
      return {
        monthly_obligation_total: 0,
        monthly_income_total: 0,
        net_monthly_cashflow: 0,
        excluded_row_count: 0,
      }
    }

    return deriveSummaryFromCommitments(commitments)
  }, [commitments, detail])
  const rootAttributes = isRecord(detail?.attributes) ? detail.attributes : {}
  const parentItem = useMemo(() => {
    if (!detail?.parent_item_id) {
      return null
    }

    return lookupRows.find((item) => item.id === detail.parent_item_id) ?? null
  }, [detail?.parent_item_id, lookupRows])

  const siblingItems = useMemo(() => {
    if (!detail?.parent_item_id) {
      return []
    }

    return lookupRows.filter((item) => item.parent_item_id === detail.parent_item_id && item.id !== detail.id)
  }, [detail?.id, detail?.parent_item_id, lookupRows])

  useEffect(() => {
    setActiveTab('overview')
  }, [itemId])

  if (netStatusQuery.isLoading || itemsLookupQuery.isLoading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm" aria-label="Loading item detail">
        <div className="space-y-3">
          <div className="h-6 w-52 animate-pulse rounded bg-muted" />
          <div className="h-14 animate-pulse rounded-xl bg-muted/80" />
          <div className="h-14 animate-pulse rounded-xl bg-muted/80" />
        </div>
      </section>
    )
  }

  if ((netStatusQuery.isError && !wrongRootType) || !detail) {
    return (
      <section className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
        {t('items.detail.loadError')}
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <header className="animate-fade-up flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold">{detail ? getItemDisplayName(detail) : ''}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{detail?.item_type ?? t('items.detail.commitmentFallbackTitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowTechnical((value) => !value)}
            className="rounded-lg border border-border px-3 py-2 text-xs font-medium"
          >
            {showTechnical ? t('items.detail.hideTechnical') : t('items.detail.showTechnical')}
          </button>
          <Link to={`/items/${itemId}/edit`} className="rounded-lg border border-border px-3 py-2 text-xs font-medium">
            {t('items.editAction')}
          </Link>
          <button
            type="button"
            onClick={() => {
              setDeleteError(null)
              setDeleteOpen(true)
            }}
            className="rounded-lg border border-destructive/40 px-3 py-2 text-xs font-medium text-destructive"
          >
            {t('items.deleteAction')}
          </button>
        </div>
      </header>

      <nav className="animate-fade-up flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={[
              'rounded-full border px-3 py-1 text-xs font-medium',
              activeTab === tab ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground',
            ].join(' ')}
          >
            {t(`items.detail.tabs.${tab}`)}
          </button>
        ))}
      </nav>

      {activeTab === 'overview' ? (
        wrongRootType ? (
          <div className="animate-fade-up space-y-3">
            <section className="grid gap-3 md:grid-cols-3">
              <article className="hover-lift rounded-2xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('items.fields.nextPaymentAmount')}</p>
                <p className="mt-2 text-2xl font-semibold">{formatCurrency(toNumberOrZero(rootAttributes.nextPaymentAmount ?? rootAttributes.amount))}</p>
              </article>
              <article className="hover-lift rounded-2xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('items.fields.remainingBalance')}</p>
                <p className="mt-2 text-2xl font-semibold">{formatCurrency(toNumberOrZero(rootAttributes.remainingBalance))}</p>
              </article>
              <article className="hover-lift rounded-2xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('items.fields.dueDate')}</p>
                <p className="mt-2 text-2xl font-semibold">{String(rootAttributes.dueDate ?? '-')}</p>
              </article>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <h2 className="text-sm font-semibold">{t('items.detail.keyDetails')}</h2>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                {getDisplayEntries(rootAttributes).map((entry) => (
                  <div key={entry.key} className="rounded-lg border border-border bg-background/80 px-3 py-2">
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{t(`items.fields.${entry.key}`, { defaultValue: entry.key })}</dt>
                    <dd className="mt-1 text-sm font-medium text-foreground">{toFriendlyValue(entry.key, entry.value)}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <h2 className="text-sm font-semibold">{t('items.detail.linkedItemsTitle')}</h2>

              {parentItem ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('items.detail.linkedParentLabel')}{' '}
                  <Link to={`/items/${parentItem.id}`} state={{ from: location.pathname + location.search }} className="font-medium text-primary underline-offset-2 hover:underline">
                    {getItemDisplayName(parentItem)}
                  </Link>
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">{t('items.detail.noLinkedParent')}</p>
              )}

              {siblingItems.length > 0 ? (
                <div className="mt-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('items.detail.relatedCommitments')}</p>
                  <ul className="mt-2 space-y-1">
                    {siblingItems.map((sibling) => (
                      <li key={sibling.id}>
                        <Link to={`/items/${sibling.id}`} state={{ from: location.pathname + location.search }} className="text-sm text-primary underline-offset-2 hover:underline">
                          {getItemDisplayName(sibling)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {showTechnical ? (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.detail.technicalTitle')}</p>
                  <pre className="overflow-x-auto rounded-lg border border-border bg-background p-3 text-xs text-foreground">{JSON.stringify(rootAttributes, null, 2)}</pre>
                </div>
              ) : null}
            </section>
          </div>
        ) : (
          <div className="animate-fade-up space-y-3">
            <section className="grid gap-3 md:grid-cols-4">
              <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('items.detail.summaryMonthly')}</p>
                <p className="mt-2 text-2xl font-semibold">{formatCurrency(effectiveSummary.monthly_obligation_total)}</p>
              </article>
              <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('items.detail.summaryIncome')}</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-700">{formatCurrency(effectiveSummary.monthly_income_total)}</p>
              </article>
              <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('items.detail.summaryNet')}</p>
                <p className="mt-2 text-2xl font-semibold">{formatCurrency(effectiveSummary.net_monthly_cashflow)}</p>
              </article>
              <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('items.detail.summaryLinked')}</p>
                <p className="mt-2 text-2xl font-semibold">{commitments.length}</p>
              </article>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <h2 className="text-sm font-semibold">{t('items.detail.keyDetails')}</h2>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                {getDisplayEntries(rootAttributes).map((entry) => (
                  <div key={entry.key} className="rounded-lg border border-border bg-background/80 px-3 py-2">
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{t(`items.fields.${entry.key}`, { defaultValue: entry.key })}</dt>
                    <dd className="mt-1 text-sm font-medium text-foreground">{toFriendlyValue(entry.key, entry.value)}</dd>
                  </div>
                ))}
              </dl>

              {showTechnical ? (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.detail.technicalTitle')}</p>
                  <pre className="overflow-x-auto rounded-lg border border-border bg-background p-3 text-xs text-foreground">{JSON.stringify(rootAttributes, null, 2)}</pre>
                </div>
              ) : null}
            </section>
          </div>
        )
      ) : null}

      {activeTab === 'commitments' ? (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          {!wrongRootType ? (
            <div className="mb-3 flex flex-wrap justify-end gap-2">
              <Link
                to={`/items/create/wizard?item_type=FinancialCommitment&parent_item_id=${itemId}`}
                className="hover-lift rounded-lg border border-border px-3 py-2 text-xs font-medium"
              >
                {t('items.detail.addLinkedCommitment')}
              </Link>
              <Link
                to={`/items/create/wizard?item_type=FinancialIncome&parent_item_id=${itemId}`}
                className="hover-lift rounded-lg border border-border px-3 py-2 text-xs font-medium"
              >
                {t('items.detail.addLinkedIncome')}
              </Link>
            </div>
          ) : null}

          {commitments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('items.detail.noCommitments')}</p>
          ) : (
            <ul className="space-y-2">
              {commitments.map((commitment) => (
                <li key={commitment.id} className="rounded-xl border border-border bg-background/80 px-3 py-2">
                  <p className="text-sm font-medium">
                    <Link to={`/items/${commitment.id}`} state={{ from: location.pathname + location.search }} className="text-primary underline-offset-2 hover:underline">
                      {getItemDisplayName(commitment)}
                    </Link>
                  </p>
                  {typeof commitment.attributes?.description === 'string' ? <p className="mt-1 text-xs text-muted-foreground">{commitment.attributes.description}</p> : null}

                  <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                    {getDisplayEntries(isRecord(commitment.attributes) ? commitment.attributes : {})
                      .filter((entry) => entry.key !== 'name' && entry.key !== 'description')
                      .map((entry) => (
                        <div key={entry.key}>
                          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{t(`items.fields.${entry.key}`, { defaultValue: entry.key })}</dt>
                          <dd className="text-sm">{toFriendlyValue(entry.key, entry.value)}</dd>
                        </div>
                      ))}
                  </dl>

                  {showTechnical ? (
                    <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-background p-2 text-xs text-foreground">
                      {JSON.stringify(commitment.attributes, null, 2)}
                    </pre>
                  ) : null}

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setChildDeleteError(null)
                        setChildDeleteTarget(commitment)
                      }}
                      className="rounded-lg border border-destructive/40 px-3 py-2 text-xs font-medium text-destructive"
                    >
                      {t('items.deleteAction')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {activeTab === 'activity' ? <ItemActivityTimeline itemId={itemId} /> : null}

      <ItemSoftDeleteDialog
        open={deleteOpen}
        itemLabel={detail ? getItemDisplayName(detail) : ''}
        pending={deleteMutation.isPending}
        errorText={deleteError}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
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
    </section>
  )
}
