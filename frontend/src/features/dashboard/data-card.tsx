import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type DataCardProps = ComponentPropsWithoutRef<'div'> & {
  action?: ReactNode
  as?: 'article' | 'div' | 'section'
  contentClassName?: string
  description?: ReactNode
  eyebrow?: ReactNode
  title?: ReactNode
  value?: ReactNode
}

export function DataCard({
  action,
  as: Comp = 'div',
  children,
  className,
  contentClassName,
  description,
  eyebrow,
  title,
  value,
  ...props
}: DataCardProps) {
  return (
    <Comp className={className} {...props}>
      <Card className="h-full border border-border bg-card/95 shadow-sm shadow-black/5 dark:bg-card dark:shadow-none">
        {eyebrow || title || description || action || value ? (
          <CardHeader className="gap-3">
            {(eyebrow || action) && (
              <div className="flex items-center justify-between gap-3">
                {eyebrow ? <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p> : <span />}
                {action ? <CardAction>{action}</CardAction> : null}
              </div>
            )}
            {title ? <CardTitle>{title}</CardTitle> : null}
            {description ? <CardDescription>{description}</CardDescription> : null}
            {value ? <div className="text-3xl font-semibold tracking-tight text-foreground">{value}</div> : null}
          </CardHeader>
        ) : null}
        {children ? <CardContent className={cn(title || description || value || eyebrow || action ? 'pt-0' : '', contentClassName)}>{children}</CardContent> : null}
      </Card>
    </Comp>
  )
}
