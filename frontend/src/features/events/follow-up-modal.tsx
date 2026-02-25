import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

type FollowUpModalProps = {
  open: boolean
  onScheduleNow: () => void
  onNotNow: () => void
}

export function FollowUpModal({ open, onScheduleNow, onNotNow }: FollowUpModalProps) {
  const { t } = useTranslation()
  const scheduleButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    scheduleButtonRef.current?.focus()
  }, [open])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
        <h3 className="text-lg font-semibold">{t('events.followUp.title')}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{t('events.followUp.description')}</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground"
            onClick={onNotNow}
          >
            {t('events.followUp.notNow')}
          </button>
          <button
            ref={scheduleButtonRef}
            type="button"
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            onClick={onScheduleNow}
          >
            {t('events.followUp.scheduleNow')}
          </button>
        </div>
      </div>
    </div>
  )
}
