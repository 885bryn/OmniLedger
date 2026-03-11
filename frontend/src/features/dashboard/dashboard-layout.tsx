import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type DashboardLayoutProps = ComponentPropsWithoutRef<'section'>

type DashboardSectionProps = ComponentPropsWithoutRef<'section'> & {
  action?: ReactNode
  description?: ReactNode
  title: ReactNode
}

export function DashboardLayout({ className, ...props }: DashboardLayoutProps) {
  return <section className={cn('space-y-6 lg:space-y-7', className)} {...props} />
}

export function DashboardHeader({ className, ...props }: ComponentPropsWithoutRef<'header'>) {
  return <header className={cn('space-y-2', className)} {...props} />
}

export function DashboardEyebrow({ className, ...props }: ComponentPropsWithoutRef<'p'>) {
  return <p className={cn('text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground', className)} {...props} />
}

export function DashboardTitle({ className, ...props }: ComponentPropsWithoutRef<'h1'>) {
  return <h1 className={cn('text-2xl font-semibold tracking-tight text-foreground md:text-3xl', className)} {...props} />
}

export function DashboardDescription({ className, ...props }: ComponentPropsWithoutRef<'p'>) {
  return <p className={cn('max-w-3xl text-sm leading-6 text-muted-foreground', className)} {...props} />
}

export function DashboardSummaryBand({ className, ...props }: ComponentPropsWithoutRef<'section'>) {
  return <section className={cn('grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-4', className)} {...props} />
}

export function DashboardBody({ className, ...props }: ComponentPropsWithoutRef<'section'>) {
  return <section className={cn('grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.95fr)] xl:items-start', className)} {...props} />
}

export function DashboardSection({ action, className, description, title, children, ...props }: DashboardSectionProps) {
  return (
    <section className={cn('space-y-4', className)} {...props}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  )
}
