import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import { useAuth } from '../../auth/auth-context'
import { useAdminScope } from '../admin-scope/admin-scope-context'
import { TargetUserChip, resolveTargetUserAttribution } from '../admin-scope/target-user-chip'

type ItemSoftDeleteDialogProps = {
  open: boolean
  itemLabel: string
  pending?: boolean
  errorText?: string | null
  onCancel: () => void
  onConfirm: () => void
}

export function ItemSoftDeleteDialog({ open, itemLabel, pending = false, errorText = null, onCancel, onConfirm }: ItemSoftDeleteDialogProps) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const { isAdmin, mode, lensUserId, users } = useAdminScope()

  const attribution = resolveTargetUserAttribution({
    isAdmin,
    mode,
    lensUserId,
    users,
    actorUsername: session?.username,
    actorEmail: session?.email,
  })

  if (!open) {
    return null
  }

  return createPortal(
    <div className="dialog-overlay fixed inset-0 z-[90] grid place-items-center bg-black/15 p-4" role="dialog" aria-modal="true">
      <div className="dialog-card w-full max-w-xl rounded-2xl border border-border bg-white p-6 text-foreground shadow-[0_24px_60px_-28px_rgba(15,23,42,0.45)]">
        <h2 className="text-lg font-semibold leading-tight">{t('items.deleteDialog.title')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('items.deleteDialog.description', { itemLabel })}</p>
        {attribution ? <TargetUserChip actorLabel={attribution.actorLabel} lensLabel={attribution.lensLabel} className="mt-3" /> : null}
        {errorText ? <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{errorText}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-lg border border-border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('items.deleteDialog.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-lg bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? t('items.deleteDialog.pending') : t('items.deleteDialog.confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
