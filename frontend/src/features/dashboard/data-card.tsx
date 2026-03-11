import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type DataCardProps = ComponentPropsWithoutRef<'div'> & {
  action?: ReactNode
  as?: 'article' | 'div' | 'section'
  cardClassName?: string
  contentClassName?: string
  description?: ReactNode
  eyebrow?: ReactNode
  headerClassName?: string
  titleClassName?: string
  descriptionClassName?: string
  title?: ReactNode
  value?: ReactNode
  valueClassName?: string
}

export function DataCard({
  action,
  as: Comp = 'div',
  children,
  className,
  cardClassName,
  contentClassName,
  description,
  descriptionClassName,
  eyebrow,
  headerClassName,
  title,
  titleClassName,
  value,
  valueClassName,
  ...props
}: DataCardProps) {
  return (
    <Comp className={className} {...props}>
      <Card className={cn('h-full border border-border bg-card/95 shadow-sm shadow-black/5 dark:bg-card dark:shadow-none', cardClassName)}>
        {eyebrow || title || description || action || value ? (
          <CardHeader className={cn('gap-3', headerClassName)}>
            {(eyebrow || action) && (
              <div className="flex items-center justify-between gap-3">
                {eyebrow ? <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p> : <span />}
                {action ? <CardAction>{action}</CardAction> : null}
              </div>
            )}
            {title ? <CardTitle className={titleClassName}>{title}</CardTitle> : null}
            {description ? <CardDescription className={descriptionClassName}>{description}</CardDescription> : null}
            {value ? <div className={cn('text-3xl font-semibold tracking-tight text-foreground', valueClassName)}>{value}</div> : null}
          </CardHeader>
        ) : null}
        {children ? <CardContent className={cn(title || description || value || eyebrow || action ? 'pt-0' : '', contentClassName)}>{children}</CardContent> : null}
      </Card>
    </Comp>
  )
}
