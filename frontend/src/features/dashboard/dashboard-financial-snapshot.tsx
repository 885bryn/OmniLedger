import { Link } from 'react-router-dom'
import { DataCard } from './data-card'

export type DashboardFinancialSnapshotRow = {
  itemId: string
  itemName: string
  subtype: string
  nextEventType: string | null
  statusTone: 'overdue' | 'upcoming' | 'clear'
  statusLabel: string
  dueLabel: string
  amountLabel: string
}

type DashboardFinancialSnapshotProps = {
  rows: DashboardFinancialSnapshotRow[]
  returnTo: string
  labels: {
    itemColumn: string
    statusColumn: string
    dueColumn: string
    amountColumn: string
    openItem: string
    empty: string
  }
}

function statusToneClasses(tone: DashboardFinancialSnapshotRow['statusTone']) {
  if (tone === 'overdue') {
    return 'border-destructive/30 bg-destructive/10 text-destructive'
  }

  if (tone === 'upcoming') {
    return 'border-primary/30 bg-primary/10 text-primary'
  }

  return 'border-border bg-muted/50 text-muted-foreground'
}

export function DashboardFinancialSnapshot({ rows, returnTo, labels }: DashboardFinancialSnapshotProps) {
  return (
    <DataCard as="section" cardClassName="bg-card" contentClassName="space-y-3 pt-0" data-testid="dashboard-financial-snapshot">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <>
          <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 border-b border-border/70 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:grid">
            <span>{labels.itemColumn}</span>
            <span>{labels.statusColumn}</span>
            <span>{labels.dueColumn}</span>
            <span>{labels.amountColumn}</span>
            <span className="text-right">{labels.openItem}</span>
          </div>

          <ul className="space-y-2" aria-label="Financial snapshot list">
            {rows.map((row) => (
              <li
                key={row.itemId}
                data-testid="dashboard-financial-snapshot-row"
                className="grid grid-cols-1 gap-2 rounded-lg border border-border/70 bg-background/80 p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-3"
              >
                <div className="min-w-0">
                  <Link to={`/items/${row.itemId}`} state={{ from: returnTo }} className="truncate text-sm font-semibold text-primary underline-offset-2 hover:underline">
                    {row.itemName}
                  </Link>
                  <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">{row.subtype}</p>
                  {row.nextEventType ? <p className="truncate text-xs text-muted-foreground">{row.nextEventType}</p> : null}
                </div>

                <div>
                  <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${statusToneClasses(row.statusTone)}`}>
                    {row.statusLabel}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground sm:text-sm">{row.dueLabel}</p>
                <p className="text-xs font-medium text-foreground sm:text-sm">{row.amountLabel}</p>

                <div className="text-left sm:text-right">
                  <Link to={`/items/${row.itemId}`} state={{ from: returnTo }} className="text-xs font-medium text-primary underline-offset-2 hover:underline">
                    {labels.openItem}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </DataCard>
  )
}
