import { DataCard } from './data-card'

export type DashboardExceptionNotice = {
  id: string
  eyebrow: string
  title: string
  description: string
  tone: 'warning' | 'neutral' | 'clear'
}

type DashboardExceptionNoticesProps = {
  notices: DashboardExceptionNotice[]
}

function noticeToneClasses(tone: DashboardExceptionNotice['tone']) {
  if (tone === 'warning') {
    return 'border-amber-300 bg-[linear-gradient(135deg,rgba(255,251,235,0.98),rgba(255,255,255,0.98))]'
  }

  if (tone === 'neutral') {
    return 'border-border/70 bg-card/95'
  }

  return 'border-emerald-300/60 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(255,255,255,0.98))]'
}

export function DashboardExceptionNotices({ notices }: DashboardExceptionNoticesProps) {
  return (
    <DataCard as="section" cardClassName="bg-card" contentClassName="space-y-3 pt-0" data-testid="dashboard-exception-notices">
      <ul className="space-y-3" aria-label="Dashboard exception notices">
        {notices.map((notice) => (
          <li key={notice.id}>
            <article className={`rounded-2xl border px-4 py-4 shadow-sm ${noticeToneClasses(notice.tone)}`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{notice.eyebrow}</p>
              <h3 className="mt-2 text-sm font-semibold text-foreground">{notice.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{notice.description}</p>
            </article>
          </li>
        ))}
      </ul>
    </DataCard>
  )
}
