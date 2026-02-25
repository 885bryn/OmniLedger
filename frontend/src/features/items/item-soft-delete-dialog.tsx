import { useTranslation } from 'react-i18next'

type ItemSoftDeleteDialogProps = {
  open: boolean
  itemLabel: string
  pending?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ItemSoftDeleteDialog({ open, itemLabel, pending = false, onCancel, onConfirm }: ItemSoftDeleteDialogProps) {
  const { t } = useTranslation()

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="presentation">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
        <h2 className="text-lg font-semibold">{t('items.deleteDialog.title')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('items.deleteDialog.description', { itemLabel })}</p>
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
    </div>
  )
}
