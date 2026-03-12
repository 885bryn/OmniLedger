import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { DataCard } from './data-card'

type DashboardSummaryCardProps = {
  label: string
  value: ReactNode
  supportingText: string
  to?: string
  linkState?: Record<string, unknown>
  linkLabel?: string
  valueClassName?: string
}

export function DashboardSummaryCard({
  label,
  value,
  supportingText,
  to,
  linkState,
  linkLabel,
  valueClassName,
}: DashboardSummaryCardProps) {
  return (
    <DataCard
      as="article"
      cardClassName="h-full bg-card"
      className="h-full"
      data-dashboard-metric-card="true"
      description={supportingText}
      descriptionClassName="text-xs leading-5"
      eyebrow={label}
      headerClassName="gap-2"
      value={<span className={valueClassName}>{value}</span>}
      valueClassName="text-2xl md:text-3xl"
    >
      {to && linkLabel ? (
        <div className="flex pt-1">
          <Link
            to={to}
            state={linkState}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            <span>{linkLabel}</span>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      ) : null}
    </DataCard>
  )
}
