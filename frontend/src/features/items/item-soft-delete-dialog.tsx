import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Pressable } from '@/components/ui/pressable'
import { useAuth } from '../../auth/auth-context'
import { useAdminScope } from '../admin-scope/admin-scope-context'
import { TargetUserChip, resolveTargetUserAttribution } from '../admin-scope/target-user-chip'
import { isOwnershipPolicyMessage } from '../../lib/api-client'
import { useToast } from '../ui/toast-provider'

type ItemSoftDeleteDialogProps = {
  open: boolean
  itemLabel: string
  pending?: boolean
  errorText?: string | null
  relatedItems?: Array<{ id: string; label: string; checked: boolean }>
  onToggleRelatedItem?: (itemId: string, checked: boolean) => void
  onCancel: () => void
  onConfirm: () => void
}

export function ItemSoftDeleteDialog({
  open,
  itemLabel,
  pending = false,
  errorText = null,
  relatedItems = [],
  onToggleRelatedItem,
  onCancel,
  onConfirm,
}: ItemSoftDeleteDialogProps) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const { isAdmin, mode, lensUserId, users } = useAdminScope()
  const { pushSafetyToast } = useToast()
  const [localErrorText, setLocalErrorText] = useState<string | null>(null)
  const hasInvalidLensSelection = isAdmin && mode === 'owner' && (!lensUserId || !users.some((user) => user.id === lensUserId))

  const attribution = resolveTargetUserAttribution({
    isAdmin,
    mode,
    lensUserId,
    users,
    actorUsername: session?.username,
    actorEmail: session?.email,
  })

  useEffect(() => {
    if (open) {
      setLocalErrorText(null)
    }
  }, [open])

  const normalizedExternalError = isOwnershipPolicyMessage(errorText) ? t('safety.policyDenied') : errorText
  const displayErrorText = localErrorText ?? normalizedExternalError

  if (!open) {
    return null
  }

  return createPortal(
    <div className="dialog-overlay fixed inset-0 z-[90] grid place-items-center bg-black/15 p-4" role="dialog" aria-modal="true">
      <Card className="dialog-card w-full max-w-xl border border-border bg-card shadow-[var(--shadow-surface-strong)]">
        <CardHeader className="gap-2 border-b border-border/70">
          <CardTitle className="text-lg leading-tight">{t('items.deleteDialog.title')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('items.deleteDialog.description', { itemLabel })}</p>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          {relatedItems.length > 0 ? (
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('items.deleteDialog.relatedTitle', { defaultValue: 'Also delete linked commitments' })}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('items.deleteDialog.relatedDescription', {
                  defaultValue: 'Select which linked commitments to delete together with this item. Unchecked commitments will be kept.',
                })}
              </p>
              <ul className="mt-2 space-y-1">
                {relatedItems.map((related) => (
                  <li key={related.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm hover:bg-muted/60">
                      <input
                        type="checkbox"
                        checked={related.checked}
                        onChange={(event) => onToggleRelatedItem?.(related.id, event.target.checked)}
                        disabled={pending}
                        className="h-4 w-4"
                      />
                      <span>{related.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {attribution ? <TargetUserChip actorLabel={attribution.actorLabel} lensLabel={attribution.lensLabel} className="mt-3" /> : null}
          {displayErrorText ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{displayErrorText}</p> : null}
        </CardContent>
        <CardFooter className="mt-0 justify-end gap-2 border-t border-border/70 bg-muted/30">
          <Pressable whileTap={pending ? { scale: 1 } : undefined}>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLocalErrorText(null)
                onCancel()
              }}
              disabled={pending}
            >
              {t('items.deleteDialog.cancel')}
            </Button>
          </Pressable>
          <Pressable whileTap={pending ? { scale: 1 } : undefined}>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (hasInvalidLensSelection) {
                  const message = t('safety.invalidLens')
                  setLocalErrorText(message)
                  pushSafetyToast('invalid_lens')
                  return
                }

                setLocalErrorText(null)
                onConfirm()
              }}
              disabled={pending}
            >
              {pending ? t('items.deleteDialog.pending') : t('items.deleteDialog.confirm')}
            </Button>
          </Pressable>
        </CardFooter>
      </Card>
    </div>,
    document.body,
  )
}
