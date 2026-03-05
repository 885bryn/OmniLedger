import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { useAdminScope } from '../../features/admin-scope/admin-scope-context'
import { ItemFilters, type AssetTypeOption, type ItemFilterValue, type ItemSortValue } from '../../features/items/item-filters'
import { ItemSoftDeleteDialog } from '../../features/items/item-soft-delete-dialog'
import { ApiClientError, apiRequest } from '../../lib/api-client'
import { getFinancialSubtype, getItemDisplayName, getItemTypeLabel, isIncomeItem } from '../../lib/item-display'
import { lensScopeToParams, queryKeys } from '../../lib/query-keys'

type ItemRow = {
  id: string
  user_id?: string
  item_type: string
  title?: string | null
  type?: string | null
  default_amount?: number | null
  linked_asset_item_id?: string | null
  attributes: Record<string, unknown>
  parent_item_id?: string | null
  updated_at: string
}

type ItemsResponse = {
  items: ItemRow[]
  total_count: number
}

type NetStatusResponse = {
  child_commitments: ItemRow[]
}

type CreateItemType = 'FinancialItem' | 'Vehicle' | 'RealEstate'

function isAssetItemType(itemType: string) {
  return itemType === 'RealEstate' || itemType === 'Vehicle'
}

function getAssetTypeLabel(t: (key: string, options?: Record<string, unknown>) => string, itemType: string) {
  return t(`items.filters.assetTypes.types.${itemType}`, { defaultValue: itemType })
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
  if (item.item_type !== 'FinancialItem') {
    return null
  }

  const candidate = item.default_amount ?? item.attributes?.nextPaymentAmount ?? item.attributes?.amount
  const parsed = Number(candidate)
  return Number.isFinite(parsed) ? parsed : null
}

function resolveParentItemId(item: ItemRow) {
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

export function ItemListPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { mode, lensUserId } = useAdminScope()

  const [searchInput, setSearchInput] = useState('')
  const [filter, setFilter] = useState<ItemFilterValue>('assets')
  const [selectedAssetType, setSelectedAssetType] = useState<string | null>(null)
  const [createItemType, setCreateItemType] = useState<CreateItemType>('FinancialItem')
  const [sort, setSort] = useState<ItemSortValue>('recently_updated')
  const [deleteTarget, setDeleteTarget] = useState<ItemRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [selectedCascadeIds, setSelectedCascadeIds] = useState<string[]>([])
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
      if (filter === 'deleted') {
        params.set('include_deleted', 'true')
      }
      Object.entries(lensParams).forEach(([key, value]) => params.set(key, value))

      return apiRequest<ItemsResponse>(`/items?${params.toString()}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async ({ itemId, cascadeDeleteIds }: { itemId: string; cascadeDeleteIds: string[] }) => {
      return apiRequest<{ id: string }>(`/items/${itemId}`, {
        method: 'DELETE',
        body: { cascade_delete_ids: cascadeDeleteIds },
      })
    },
    onSuccess: async (_, variables) => {
      const itemId = variables.itemId
      const parentItemId = deleteTarget?.parent_item_id || null
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.items.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(itemId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.activity(itemId) }),
        ...variables.cascadeDeleteIds.map((childId) => queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(childId) })),
        ...variables.cascadeDeleteIds.map((childId) => queryClient.invalidateQueries({ queryKey: queryKeys.items.activity(childId) })),
        ...(parentItemId ? [queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(parentItemId) })] : []),
        ...(parentItemId ? [queryClient.invalidateQueries({ queryKey: queryKeys.items.activity(parentItemId) })] : []),
        queryClient.invalidateQueries({ queryKey: queryKeys.events.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ])
      setDeleteTarget(null)
      setDeleteError(null)
      setSelectedCascadeIds([])
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

  const restoreMutation = useMutation({
    mutationFn: async ({ itemId }: { itemId: string }) =>
      apiRequest<ItemRow>(`/items/${itemId}/restore`, {
        method: 'PATCH',
      }),
    onSuccess: async (restoredItem, variables) => {
      const itemId = variables.itemId
      const parentItemId = resolveParentItemId(restoredItem)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.items.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(itemId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.items.activity(itemId) }),
        ...(parentItemId ? [queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(parentItemId) })] : []),
        ...(parentItemId ? [queryClient.invalidateQueries({ queryKey: queryKeys.items.activity(parentItemId) })] : []),
        queryClient.invalidateQueries({ queryKey: queryKeys.events.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ])

      setSearchInput('')
      setSort('recently_updated')
      const subtype = getFinancialSubtype(restoredItem)
      if (subtype === 'Income') {
        setFilter('income')
        setSelectedAssetType(null)
      } else if (subtype === 'Commitment') {
        setFilter('commitments')
        setSelectedAssetType(null)
      } else if (restoredItem.item_type === 'RealEstate' || restoredItem.item_type === 'Vehicle') {
        setFilter('assets')
        setSelectedAssetType(restoredItem.item_type)
      } else {
        setFilter('all')
        setSelectedAssetType(null)
      }
    },
  })

  const deleteDependenciesQuery = useQuery({
    queryKey: queryKeys.items.detail(`${deleteTarget?.id ?? 'none'}-delete-dependencies`),
    enabled: Boolean(deleteTarget && isAssetItemType(deleteTarget.item_type)),
    queryFn: async () => apiRequest<NetStatusResponse>(`/items/${deleteTarget?.id}/net-status`),
  })

  useEffect(() => {
    if (!deleteTarget || !isAssetItemType(deleteTarget.item_type)) {
      setSelectedCascadeIds([])
      return
    }

    const linkedCommitmentIds = (deleteDependenciesQuery.data?.child_commitments ?? []).map((child) => child.id)
    setSelectedCascadeIds(linkedCommitmentIds)
  }, [deleteDependenciesQuery.data?.child_commitments, deleteTarget])

  const relatedDeleteItems = useMemo(() => {
    if (!deleteTarget || !isAssetItemType(deleteTarget.item_type)) {
      return []
    }

    return (deleteDependenciesQuery.data?.child_commitments ?? []).map((child) => ({
      id: child.id,
      label: getItemDisplayName(child),
      checked: selectedCascadeIds.includes(child.id),
    }))
  }, [deleteDependenciesQuery.data?.child_commitments, deleteTarget, selectedCascadeIds])

  const items = listQuery.data?.items ?? []
  const assetTypeOptions = useMemo<AssetTypeOption[]>(() => {
    const preferred = ['RealEstate', 'Vehicle']
    const discovered = items.filter((item) => isAssetItemType(item.item_type)).map((item) => item.item_type)
    const unique = Array.from(new Set([...preferred, ...discovered]))

    return unique.map((value) => ({
      value,
      label: getAssetTypeLabel(t, value),
    }))
  }, [items, t])

  const visibleItems = useMemo(() => {
    if (filter !== 'assets' || !selectedAssetType) {
      return items
    }

    return items.filter((item) => item.item_type === selectedAssetType)
  }, [filter, items, selectedAssetType])

  const totalCount = filter === 'assets' && selectedAssetType ? visibleItems.length : listQuery.data?.total_count ?? 0
  const hasFilters = Boolean(debouncedSearch) || filter !== 'assets' || sort !== 'recently_updated' || selectedAssetType !== null
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

  useEffect(() => {
    if (filter !== 'assets' && selectedAssetType !== null) {
      setSelectedAssetType(null)
    }
  }, [filter, selectedAssetType])

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
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.createPicker.label')}</span>
            <select
              value={createItemType}
              onChange={(event) => setCreateItemType(event.target.value as CreateItemType)}
              className="rounded-lg border border-border bg-background px-2 py-2 text-sm"
            >
              <option value="FinancialItem">{t('items.createPicker.types.FinancialItem')}</option>
              <option value="Vehicle">{t('items.createPicker.types.Vehicle')}</option>
              <option value="RealEstate">{t('items.createPicker.types.RealEstate')}</option>
            </select>
          </label>
          <Link to={`/items/create?item_type=${createItemType}`} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
            {t('items.createAction')}
          </Link>
        </div>
      </header>

      <ItemFilters
        search={searchInput}
        filter={filter}
        sort={sort}
        assetTypeOptions={assetTypeOptions}
        selectedAssetType={selectedAssetType}
        sortOptions={sortOptions}
        onSearchChange={setSearchInput}
        onFilterChange={(value) => {
          setFilter(value)
          if (value !== 'assets') {
            setSelectedAssetType(null)
          }
        }}
        onAssetTypeChange={setSelectedAssetType}
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

      {!listQuery.isLoading && !listQuery.isError && visibleItems.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-border bg-card/70 p-8 text-center text-sm text-muted-foreground">{emptyMessage}</section>
      ) : null}

      {!listQuery.isLoading && !listQuery.isError && visibleItems.length > 0 ? (
        <section className="space-y-2">
          {visibleItems.map((item) => {
            const financialAmount = getFinancialAmount(item)
            const subtype = getFinancialSubtype(item)

            return (
              <article key={item.id} className="hover-lift animate-fade-up flow-card flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
                <div>
                  <Link to={`/items/${item.id}`} state={{ from: location.pathname + location.search }} className="text-sm font-semibold text-primary underline-offset-2 hover:underline">
                    {getItemDisplayName(item)}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{getItemTypeLabel(item)}</span>
                    {subtype ? <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground">{subtype}</span> : null}
                    <span>-</span>
                    <span>{t('items.updatedLabel', { date: formatDate(item.updated_at) })}</span>
                  </div>
                  {financialAmount !== null ? (
                    <p className="mt-1 text-xs font-medium text-foreground/80">{isIncomeItem(item) ? `+${formatCurrency(financialAmount)}` : formatCurrency(financialAmount)}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/items/${item.id}`} state={{ from: location.pathname + location.search }} className="rounded-lg border border-border px-3 py-2 text-xs font-medium">
                    {t('items.viewAction')}
                  </Link>
                  <Link to={`/items/${item.id}/edit`} className="rounded-lg border border-border px-3 py-2 text-xs font-medium">
                    {t('items.editAction')}
                  </Link>
                  {filter === 'deleted' ? (
                    <button
                      type="button"
                      disabled={restoreMutation.isPending}
                      onClick={() => {
                        restoreMutation.mutate({ itemId: item.id })
                      }}
                      className="rounded-lg border border-emerald-600/30 px-3 py-2 text-xs font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {restoreMutation.isPending ? t('items.edit.saving', { defaultValue: 'Restoring...' }) : t('items.restoreAction', { defaultValue: 'Restore' })}
                    </button>
                  ) : null}
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
        relatedItems={relatedDeleteItems}
        onToggleRelatedItem={(itemId, checked) => {
          setSelectedCascadeIds((previous) => {
            if (checked) {
              return previous.includes(itemId) ? previous : [...previous, itemId]
            }

            return previous.filter((id) => id !== itemId)
          })
        }}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) {
            return
          }

          deleteMutation.mutate({ itemId: deleteTarget.id, cascadeDeleteIds: selectedCascadeIds })
        }}
      />
    </section>
  )
}
