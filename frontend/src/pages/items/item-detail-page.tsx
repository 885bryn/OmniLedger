import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ItemActivityTimeline } from '../../features/audit/item-activity-timeline'
import { ItemSoftDeleteDialog } from '../../features/items/item-soft-delete-dialog'
import { ApiClientError, apiRequest } from '../../lib/api-client'
import { queryKeys } from '../../lib/query-keys'

type ItemRow = {
  id: string
  item_type: string
  attributes: Record<string, unknown>
  updated_at: string
}

type NetStatusResponse = ItemRow & {
  child_commitments: ItemRow[]
  summary: {
    monthly_obligation_total: number
    excluded_row_count: number
  }
}

type DetailTab = 'overview' | 'commitments' | 'activity'

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function itemLabel(item: ItemRow | null) {
  if (!item) {
    return ''
  }

  if (typeof item.attributes?.address === 'string' && item.attributes.address.trim().length > 0) {
    return item.attributes.address
  }

  if (typeof item.attributes?.vin === 'string' && item.attributes.vin.trim().length > 0) {
    return item.attributes.vin
  }

  return item.item_type
}

export function ItemDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const params = useParams<{ itemId: string }>()
  const itemId = params.itemId || ''

  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const [deleteOpen, setDeleteOpen] = useState(false)

  const netStatusQuery = useQuery({
    queryKey: queryKeys.items.detail(itemId),
    enabled: Boolean(itemId),
    queryFn: async () => apiRequest<NetStatusResponse>(`/items/${itemId}/net-status`),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => apiRequest(`/items/${itemId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.items.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(itemId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.activity(itemId) }),
      ])
      navigate('/items')
    },
  })

  const wrongRootType = netStatusQuery.error instanceof ApiClientError && netStatusQuery.error.category === 'wrong_root_type'
  const detail = netStatusQuery.data ?? null
  const tabs: DetailTab[] = ['overview', 'commitments', 'activity']

  const commitments = useMemo(() => detail?.child_commitments ?? [], [detail])

  if (netStatusQuery.isLoading) {
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

  if (netStatusQuery.isError && !wrongRootType) {
    return (
      <section className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
        {t('items.detail.loadError')}
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold">{itemLabel(detail)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{detail?.item_type ?? t('items.detail.commitmentFallbackTitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/items/${itemId}/edit`} className="rounded-lg border border-border px-3 py-2 text-xs font-medium">
            {t('items.editAction')}
          </Link>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="rounded-lg border border-destructive/40 px-3 py-2 text-xs font-medium text-destructive"
          >
            {t('items.deleteAction')}
          </button>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2">
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
          <section className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
            {t('items.detail.commitmentFallbackBody')}
          </section>
        ) : (
          <section className="grid gap-3 md:grid-cols-3">
            <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('items.detail.summaryMonthly')}</p>
              <p className="mt-2 text-2xl font-semibold">{formatCurrency(detail?.summary.monthly_obligation_total ?? 0)}</p>
            </article>
            <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('items.detail.summaryLinked')}</p>
              <p className="mt-2 text-2xl font-semibold">{commitments.length}</p>
            </article>
            <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('items.detail.summaryExcluded')}</p>
              <p className="mt-2 text-2xl font-semibold">{detail?.summary.excluded_row_count ?? 0}</p>
            </article>
          </section>
        )
      ) : null}

      {activeTab === 'commitments' ? (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          {commitments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('items.detail.noCommitments')}</p>
          ) : (
            <ul className="space-y-2">
              {commitments.map((commitment) => (
                <li key={commitment.id} className="rounded-xl border border-border bg-background/80 px-3 py-2">
                  <p className="text-sm font-medium">{commitment.item_type}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{JSON.stringify(commitment.attributes)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {activeTab === 'activity' ? <ItemActivityTimeline itemId={itemId} /> : null}

      <ItemSoftDeleteDialog
        open={deleteOpen}
        itemLabel={itemLabel(detail)}
        pending={deleteMutation.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
      />
    </section>
  )
}
