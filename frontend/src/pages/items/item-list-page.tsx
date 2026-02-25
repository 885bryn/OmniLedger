import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ItemFilters, type ItemFilterValue, type ItemSortValue } from '../../features/items/item-filters'
import { ItemSoftDeleteDialog } from '../../features/items/item-soft-delete-dialog'
import { apiRequest } from '../../lib/api-client'
import { queryKeys } from '../../lib/query-keys'

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

function itemLabel(item: ItemRow) {
  if (typeof item.attributes?.address === 'string' && item.attributes.address.trim().length > 0) {
    return item.attributes.address
  }

  if (typeof item.attributes?.vin === 'string' && item.attributes.vin.trim().length > 0) {
    return item.attributes.vin
  }

  return item.item_type
}

export function ItemListPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [searchInput, setSearchInput] = useState('')
  const [filter, setFilter] = useState<ItemFilterValue>('all')
  const [sort, setSort] = useState<ItemSortValue>('recently_updated')
  const [deleteTarget, setDeleteTarget] = useState<ItemRow | null>(null)
  const debouncedSearch = useDebouncedValue(searchInput, 350)

  const listQuery = useQuery({
    queryKey: queryKeys.items.list({ search: debouncedSearch, filter, sort }),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debouncedSearch) {
        params.set('search', debouncedSearch)
      }
      params.set('filter', filter)
      params.set('sort', sort)

      return apiRequest<ItemsResponse>(`/items?${params.toString()}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (itemId: string) => apiRequest<{ id: string }>(`/items/${itemId}`, { method: 'DELETE' }),
    onSuccess: async (_, itemId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.items.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(itemId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.activity(itemId) }),
      ])
      setDeleteTarget(null)
    },
  })

  const items = listQuery.data?.items ?? []
  const totalCount = listQuery.data?.total_count ?? 0
  const hasFilters = Boolean(debouncedSearch) || filter !== 'all' || sort !== 'recently_updated'

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
          {items.map((item) => (
            <article key={item.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold">{itemLabel(item)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.item_type} - {t('items.updatedLabel', { date: formatDate(item.updated_at) })}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to={`/items/${item.id}`} className="rounded-lg border border-border px-3 py-2 text-xs font-medium">
                  {t('items.viewAction')}
                </Link>
                <Link to={`/items/${item.id}/edit`} className="rounded-lg border border-border px-3 py-2 text-xs font-medium">
                  {t('items.editAction')}
                </Link>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(item)}
                  className="rounded-lg border border-destructive/40 px-3 py-2 text-xs font-medium text-destructive"
                >
                  {t('items.deleteAction')}
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      <ItemSoftDeleteDialog
        open={Boolean(deleteTarget)}
        itemLabel={deleteTarget ? itemLabel(deleteTarget) : ''}
        pending={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) {
            return
          }

          deleteMutation.mutate(deleteTarget.id)
        }}
      />
    </section>
  )
}
