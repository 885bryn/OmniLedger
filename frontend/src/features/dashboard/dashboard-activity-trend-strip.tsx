type DashboardActivityTrendItem = {
  id: string
  label: string
  value: string
  detail: string
  hint: string
  tone?: 'warning' | 'neutral' | 'positive'
}

type DashboardActivityTrendStripProps = {
  title: string
  description: string
  items: DashboardActivityTrendItem[]
}

const TONE_CLASS_NAMES: Record<NonNullable<DashboardActivityTrendItem['tone']>, string> = {
  warning: 'border-red-200/80 bg-red-50/70',
  neutral: 'border-border/70 bg-muted/20',
  positive: 'border-emerald-200/80 bg-emerald-50/70',
}

export function DashboardActivityTrendStrip({
  title,
  description,
  items,
}: DashboardActivityTrendStripProps) {
  return (
    <section
      aria-label={title}
      className="space-y-3"
      data-testid="dashboard-activity-trend-strip"
    >
      <div className="space-y-1">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {title}
        </p>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.id}
            className={[
              'rounded-xl border px-3 py-3',
              TONE_CLASS_NAMES[item.tone ?? 'neutral'],
            ].join(' ')}
          >
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {item.label}
            </p>
            <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">{item.value}</p>
            <p className="mt-1 text-sm font-medium text-foreground">{item.detail}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.hint}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
