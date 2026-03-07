import { type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

type ConfirmationDialogProps = {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel: string
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  if (!open) {
    return null
  }

  return createPortal(
    <div className="dialog-overlay fixed inset-0 z-[95] grid place-items-center bg-black/25 p-4" role="dialog" aria-modal="true">
      <Card className="dialog-card w-full max-w-md border border-border/80 bg-card shadow-[var(--shadow-surface-strong)]">
        <CardHeader className="gap-2 border-b border-border/70">
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="pt-5 text-sm text-muted-foreground">{description}</CardContent>
        <CardFooter className="justify-end gap-2 border-t border-border/70 bg-muted/30">
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button type="button" onClick={onConfirm} disabled={pending}>
            {confirmLabel}
          </Button>
        </CardFooter>
      </Card>
    </div>,
    document.body,
  )
}
