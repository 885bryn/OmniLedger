import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { apiRequest } from '../../lib/api-client'
import { queryKeys } from '../../lib/query-keys'
import { FollowUpModal } from './follow-up-modal'

type CompletionPayload = {
  id: string
  prompt_next_date: boolean
}

type CompleteEventRowActionProps = {
  eventId: string
}

export function CompleteEventRowAction({ eventId }: CompleteEventRowActionProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showSuccess, setShowSuccess] = useState(false)
  const [showFollowUp, setShowFollowUp] = useState(false)

  const completionMutation = useMutation({
    mutationFn: async () => apiRequest<CompletionPayload>(`/events/${eventId}/complete`, { method: 'PATCH' }),
    onSuccess: async (payload) => {
      setShowSuccess(true)
      setShowFollowUp(payload.prompt_next_date === true)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.events.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ])
    },
  })

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={completionMutation.isPending}
        onClick={() => {
          if (!window.confirm(t('events.completeAction.confirm'))) {
            return
          }

          completionMutation.mutate()
        }}
        className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        {completionMutation.isPending ? t('events.completeAction.pending') : t('events.completeAction.button')}
      </button>

      {showSuccess ? <p className="text-xs font-medium text-emerald-600">{t('events.completeAction.completed')}</p> : null}
      {completionMutation.isError ? <p className="text-xs font-medium text-destructive">{t('events.completeAction.failed')}</p> : null}

      <FollowUpModal
        open={showFollowUp}
        onNotNow={() => {
          setShowFollowUp(false)
        }}
        onScheduleNow={() => {
          setShowFollowUp(false)
        }}
      />
    </div>
  )
}
