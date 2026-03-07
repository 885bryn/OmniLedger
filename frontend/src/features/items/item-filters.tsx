import { motion } from 'framer-motion'
import { Pressable } from '@/components/ui/pressable'
import { motionSpring, pressScale } from '@/lib/motion'
import { useTranslation } from 'react-i18next'

export type ItemFilterValue = 'all' | 'assets' | 'commitments' | 'income' | 'active' | 'deleted'
export type ItemSortValue = 'recently_updated' | 'oldest_updated' | 'due_soon' | 'alphabetical' | 'amount_high_to_low' | 'amount_low_to_high'

export type AssetTypeOption = {
  value: string
  label: string
}

type ItemFiltersProps = {
  search: string
  filter: ItemFilterValue
  sort: ItemSortValue
  onSearchChange: (value: string) => void
  onFilterChange: (value: ItemFilterValue) => void
  onSortChange: (value: ItemSortValue) => void
  assetTypeOptions: AssetTypeOption[]
  selectedAssetType: string | null
  onAssetTypeChange: (value: string | null) => void
  sortOptions: ItemSortValue[]
}

const PRIMARY_FILTER_CHIPS: ItemFilterValue[] = ['all', 'assets', 'commitments', 'income']
const VISIBILITY_CHIPS: ItemFilterValue[] = ['active', 'deleted']

export function ItemFilters({
  search,
  filter,
  sort,
  onSearchChange,
  onFilterChange,
  onSortChange,
  assetTypeOptions,
  selectedAssetType,
  onAssetTypeChange,
  sortOptions,
}: ItemFiltersProps) {
  const { t } = useTranslation()

  return (
    <motion.section layout className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
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
            {sortOptions.map((value) => (
              <option key={value} value={value}>
                {t(`items.filters.sortOptions.${value}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {PRIMARY_FILTER_CHIPS.map((value) => {
            const active = filter === value

            return (
              <Pressable key={value} className="rounded-full">
                <motion.button
                  layout
                  type="button"
                  onClick={() => onFilterChange(value)}
                  transition={motionSpring}
                  whileTap={{ scale: pressScale }}
                  className={[
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
                  ].join(' ')}
                >
                  {t(`items.filters.chips.${value}`)}
                </motion.button>
              </Pressable>
            )
          })}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {VISIBILITY_CHIPS.map((value) => {
            const active = filter === value

            return (
              <Pressable key={value} className="rounded-full">
                <motion.button
                  layout
                  type="button"
                  onClick={() => onFilterChange(value)}
                  transition={motionSpring}
                  whileTap={{ scale: pressScale }}
                  className={[
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
                  ].join(' ')}
                >
                  {t(`items.filters.chips.${value}`)}
                </motion.button>
              </Pressable>
            )
          })}
        </div>
      </div>

      <motion.div layout className="ui-expand space-y-2 rounded-xl border border-border/70 bg-background/80 p-3" data-open={filter === 'assets'}>
        {filter === 'assets' ? (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('items.filters.assetTypes.label')}</p>
        ) : null}
        {filter === 'assets' ? (
          <div className="flex flex-wrap gap-2">
            <Pressable className="rounded-full">
              <motion.button
                layout
                type="button"
                onClick={() => onAssetTypeChange(null)}
                transition={motionSpring}
                whileTap={{ scale: pressScale }}
                className={[
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  selectedAssetType === null
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
                ].join(' ')}
              >
                {t('items.filters.assetTypes.all')}
              </motion.button>
            </Pressable>
            {assetTypeOptions.map((option) => {
              const active = selectedAssetType === option.value

              return (
                <Pressable key={option.value} className="rounded-full">
                  <motion.button
                    layout
                    type="button"
                    onClick={() => onAssetTypeChange(option.value)}
                    transition={motionSpring}
                    whileTap={{ scale: pressScale }}
                    className={[
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
                    ].join(' ')}
                  >
                    {option.label}
                  </motion.button>
                </Pressable>
              )
            })}
          </div>
        ) : null}
      </motion.div>
    </motion.section>
  )
}
