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
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto] gap-4 border-b border-border/70 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:grid">
            <span>{labels.itemColumn}</span>
            <span>{labels.statusColumn}</span>
            <span>{labels.dueColumn}</span>
            <span>{labels.amountColumn}</span>
            <span className="text-right">{labels.openItem}</span>
          </div>

          <ul className="space-y-2.5" aria-label="Financial snapshot list">
            {rows.map((row) => (
              <li
                key={row.itemId}
                data-testid="dashboard-financial-snapshot-row"
                className="grid grid-cols-1 gap-3 rounded-lg border border-border/70 bg-background/80 p-3.5 sm:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto] sm:items-center sm:gap-4 sm:p-4"
              >
                <div className="min-w-0 space-y-1">
                  <Link to={`/items/${row.itemId}`} state={{ from: returnTo }} className="truncate text-sm font-semibold leading-5 text-primary underline-offset-2 hover:underline sm:text-[0.95rem]">
                    {row.itemName}
                  </Link>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      {row.subtype}
                    </span>
                    {row.nextEventType ? <span className="text-xs text-muted-foreground">{row.nextEventType}</span> : null}
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:hidden">{labels.statusColumn}</p>
                  <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusToneClasses(row.statusTone)}`}>
                    {row.statusLabel}
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:hidden">{labels.dueColumn}</p>
                  <p className="text-sm leading-5 text-muted-foreground">{row.dueLabel}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:hidden">{labels.amountColumn}</p>
                  <p className="text-sm font-medium leading-5 text-foreground">{row.amountLabel}</p>
                </div>

                <div className="text-left sm:text-right">
                  <Link
                    to={`/items/${row.itemId}`}
                    state={{ from: returnTo }}
                    className="inline-flex rounded-md border border-border/80 px-2 py-1 text-xs font-medium text-primary underline-offset-2 hover:bg-muted/40 hover:underline"
                  >
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
