import { useTranslation } from 'react-i18next'

export type ItemFilterValue = 'all' | 'assets' | 'commitments' | 'active' | 'deleted'
export type ItemSortValue = 'recently_updated' | 'oldest_updated' | 'due_soon'

type ItemFiltersProps = {
  search: string
  filter: ItemFilterValue
  sort: ItemSortValue
  onSearchChange: (value: string) => void
  onFilterChange: (value: ItemFilterValue) => void
  onSortChange: (value: ItemSortValue) => void
}

const FILTER_CHIPS: ItemFilterValue[] = ['all', 'assets', 'commitments', 'active', 'deleted']
const SORT_OPTIONS: ItemSortValue[] = ['recently_updated', 'oldest_updated', 'due_soon']

export function ItemFilters({ search, filter, sort, onSearchChange, onFilterChange, onSortChange }: ItemFiltersProps) {
  const { t } = useTranslation()

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <label className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.filters.searchLabel')}</span>
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t('items.filters.searchPlaceholder')}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('items.filters.sortLabel')}</span>
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as ItemSortValue)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {SORT_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`items.filters.sortOptions.${value}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTER_CHIPS.map((value) => {
          const active = filter === value

          return (
            <button
              key={value}
              type="button"
              onClick={() => onFilterChange(value)}
              className={[
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
              ].join(' ')}
            >
              {t(`items.filters.chips.${value}`)}
            </button>
          )
        })}
      </div>
    </section>
  )
}
