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
        <ul className="space-y-2.5" aria-label="Financial snapshot list">
          {rows.map((row) => (
            <li
              key={row.itemId}
              data-testid="dashboard-financial-snapshot-row"
              className="rounded-lg border border-border/70 bg-background/80 p-3.5"
            >
              <div className="flex items-start justify-between gap-3" data-testid="dashboard-financial-snapshot-status">
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

                <div className="shrink-0 space-y-1 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{labels.statusColumn}</p>
                  <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusToneClasses(row.statusTone)}`}>
                    {row.statusLabel}
                  </span>
                </div>
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{labels.dueColumn}</p>
                  <p className="text-sm leading-5 text-muted-foreground">{row.dueLabel}</p>
                </div>

                <div className="min-w-0 space-y-0.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{labels.amountColumn}</p>
                  <p className="text-sm font-medium leading-5 text-foreground">{row.amountLabel}</p>
                </div>
              </div>

              <div className="mt-2 flex justify-end border-t border-border/60 pt-2" data-testid="dashboard-financial-snapshot-action">
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
      )}
    </DataCard>
  )
}
