import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { useAdminScope } from '../../features/admin-scope/admin-scope-context'
import { ItemFilters, type ItemFilterValue, type ItemSortValue } from '../../features/items/item-filters'
import { ItemSoftDeleteDialog } from '../../features/items/item-soft-delete-dialog'
import { ApiClientError, apiRequest } from '../../lib/api-client'
import { getItemDisplayName } from '../../lib/item-display'
import { lensScopeToParams, queryKeys } from '../../lib/query-keys'

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
  total_count: number
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timeout)
  }, [delayMs, value])

  return debounced
}

function formatDate(value: string) {
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function getFinancialAmount(item: ItemRow) {
  if (!['FinancialCommitment', 'FinancialIncome'].includes(item.item_type)) {
    return null
  }

  const candidate = item.attributes?.nextPaymentAmount ?? item.attributes?.amount
  const parsed = Number(candidate)
  return Number.isFinite(parsed) ? parsed : null
}

export function ItemListPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { mode, lensUserId } = useAdminScope()

  const [searchInput, setSearchInput] = useState('')
  const [filter, setFilter] = useState<ItemFilterValue>('assets')
  const [sort, setSort] = useState<ItemSortValue>('recently_updated')
  const [deleteTarget, setDeleteTarget] = useState<ItemRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const debouncedSearch = useDebouncedValue(searchInput, 350)
  const lensScope = useMemo(
    () => ({ mode, lensUserId: mode === 'owner' ? lensUserId : null }),
    [lensUserId, mode],
  )
  const lensParams = useMemo(() => lensScopeToParams(lensScope), [lensScope])

  const listQuery = useQuery({
    queryKey: queryKeys.items.list({ search: debouncedSearch, filter, sort, ...lensParams }),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debouncedSearch) {
        params.set('search', debouncedSearch)
      }
      params.set('filter', filter)
      params.set('sort', sort)
      Object.entries(lensParams).forEach(([key, value]) => params.set(key, value))

      return apiRequest<ItemsResponse>(`/items?${params.toString()}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async ({ itemId }: { itemId: string }) =>
      apiRequest<{ id: string }>(`/items/${itemId}`, {
        method: 'DELETE',
      }),
    onSuccess: async (_, variables) => {
      const itemId = variables.itemId
      const parentItemId = deleteTarget?.parent_item_id || null
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.items.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(itemId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.activity(itemId) }),
        ...(parentItemId ? [queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(parentItemId) })] : []),
        ...(parentItemId ? [queryClient.invalidateQueries({ queryKey: queryKeys.items.activity(parentItemId) })] : []),
        queryClient.invalidateQueries({ queryKey: queryKeys.events.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ])
      setDeleteTarget(null)
      setDeleteError(null)
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

  const items = listQuery.data?.items ?? []
  const totalCount = listQuery.data?.total_count ?? 0
  const hasFilters = Boolean(debouncedSearch) || filter !== 'assets' || sort !== 'recently_updated'
  const sortOptions = useMemo<ItemSortValue[]>(() => {
    const base: ItemSortValue[] = ['recently_updated', 'oldest_updated', 'due_soon', 'alphabetical']

    if (filter === 'commitments' || filter === 'income') {
      return [...base, 'amount_high_to_low', 'amount_low_to_high']
    }

    return base
  }, [filter])

  useEffect(() => {
    if ((filter === 'commitments' || filter === 'income') === false && (sort === 'amount_high_to_low' || sort === 'amount_low_to_high')) {
      setSort('recently_updated')
    }
  }, [filter, sort])

  const emptyMessage = useMemo(() => {
    if (hasFilters) {
      return t('items.emptyFiltered')
    }

    return t('items.empty')
  }, [hasFilters, t])

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold">{t('items.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('items.subtitle', { total: totalCount })}</p>
        </div>
        <Link to="/items/create/wizard" className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
          {t('items.createAction')}
        </Link>
      </header>

      <ItemFilters
        search={searchInput}
        filter={filter}
        sort={sort}
        sortOptions={sortOptions}
        onSearchChange={setSearchInput}
        onFilterChange={setFilter}
        onSortChange={setSort}
      />

      {listQuery.isLoading ? (
        <section className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-sm" aria-label="Loading items">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-xl bg-muted/80" />
          ))}
        </section>
      ) : null}

      {listQuery.isError ? (
        <section className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {t('items.loadError')}
        </section>
      ) : null}

      {!listQuery.isLoading && !listQuery.isError && items.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-border bg-card/70 p-8 text-center text-sm text-muted-foreground">{emptyMessage}</section>
      ) : null}

      {!listQuery.isLoading && !listQuery.isError && items.length > 0 ? (
        <section className="space-y-2">
          {items.map((item) => {
            const financialAmount = getFinancialAmount(item)

            return (
              <article key={item.id} className="hover-lift animate-fade-up flow-card flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
                <div>
                  <Link to={`/items/${item.id}`} state={{ from: location.pathname + location.search }} className="text-sm font-semibold text-primary underline-offset-2 hover:underline">
                    {getItemDisplayName(item)}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.item_type} - {t('items.updatedLabel', { date: formatDate(item.updated_at) })}
                  </p>
                  {financialAmount !== null ? <p className="mt-1 text-xs font-medium text-foreground/80">{formatCurrency(financialAmount)}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/items/${item.id}`} state={{ from: location.pathname + location.search }} className="rounded-lg border border-border px-3 py-2 text-xs font-medium">
                    {t('items.viewAction')}
                  </Link>
                  <Link to={`/items/${item.id}/edit`} className="rounded-lg border border-border px-3 py-2 text-xs font-medium">
                    {t('items.editAction')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null)
                      setDeleteTarget(item)
                    }}
                    className="rounded-lg border border-destructive/40 px-3 py-2 text-xs font-medium text-destructive"
                  >
                    {t('items.deleteAction')}
                  </button>
                </div>
              </article>
            )
          })}
        </section>
      ) : null}

      <ItemSoftDeleteDialog
        open={Boolean(deleteTarget)}
        itemLabel={deleteTarget ? getItemDisplayName(deleteTarget) : ''}
        pending={deleteMutation.isPending}
        errorText={deleteError}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) {
            return
          }

          deleteMutation.mutate({ itemId: deleteTarget.id })
        }}
      />
    </section>
  )
}
